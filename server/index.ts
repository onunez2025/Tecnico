import './lib/env.js';   // PRIMERO: carga el .env y valida los secretos antes que nada
import { mensajeError, sanitizeLog} from './lib/security.js';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import sql from 'mssql';
import path from 'path';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { RedisStore } from 'rate-limit-redis';
import { safeError } from './lib/security';
import { getDb, getReadPool, getWritePool } from './db';
import { getRedisClient } from './lib/redis';
import { verifyToken } from './middleware/auth';
import sapRouter from './routes/sap';
import configRouter from './routes/config';
import profileRouter from './routes/profile';
import managementsRouter from './routes/managements';
import preferencesRouter from './routes/preferences';
import ssoAuthRouter from './routes/ssoAuth';
import ticketsPagosRouter from './routes/ticketsPagos';
import authRouter from './routes/auth';
import dashboardRouter from './routes/dashboard';
import ticketsRouter from './routes/tickets';
import { syncPaymentCache } from './lib/pagosSync';
import { APP_IDENTIFIER, APPSHEET_PDF_PATH } from './lib/config';
import { JWT_SECRET } from './lib/env.js';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';


// --- RATE LIMITING ---
/**
 * Clave del limitador general.
 *
 * Contar por IP hacia que una oficina entera compartiera un solo cupo: con decenas de
 * personas saliendo por la misma IP, entre login, configuracion y primera pantalla se
 * agotaban las 1.000 peticiones y quedaban bloqueadas TODAS a la vez — incluido el propio
 * login, porque este limitador corre antes que esa ruta.
 *
 * Con sesion iniciada el contador es de esa persona. El token se VERIFICA, no solo se lee:
 * si bastara con leerlo, cualquiera podria inventarse un `id` distinto en cada peticion y
 * saltarse el limite. Sin sesion valida se cuenta por IP, que es la unica identidad que hay.
 */
const claveLimitador = (req: Request): string => {
    const cabecera = req.headers.authorization;
    if (cabecera?.startsWith('Bearer ')) {
        try {
            const datos = jwt.verify(cabecera.slice(7), JWT_SECRET) as { id?: string };
            if (datos?.id) return `u:${datos.id}`;
        } catch {
            // Token invalido o caducado: se cuenta por IP, como cualquier anonimo.
        }
    }
    return `ip:${ipKeyGenerator(req.ip ?? '')}`;
};

/** Deja constancia de quien choco con un limite. Antes no habia forma de saberlo. */
const avisoLimite = (cual: string) => (req: Request, res: Response) => {
    // `rateLimit` lo pone express-rate-limit en la peticion; su tipo no viene aumentado.
    const clave = (req as Request & { rateLimit?: { key?: string } }).rateLimit?.key;
    console.warn(`[RateLimit] ${cual} agotado — clave=${sanitizeLog(clave)} ruta=${sanitizeLog(req.originalUrl)}`);
    res.status(429).json({ error: 'Demasiadas peticiones. Espera unos minutos e intenta de nuevo.' });
};

const limiter = rateLimit({
    keyGenerator: claveLimitador,
    handler: avisoLimite('limite general'),
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({ sendCommand: (...args: string[]) => (getRedisClient() as unknown as { call: (...a: string[]) => Promise<unknown> }).call(...args) as Promise<number>, prefix: 'rl:tec:' }),

    passOnStoreError: true,   // si Redis cae, la app sigue sirviendo (sin limitar) en vez de dar 500
});

// Auth rate limiter — starts with safe defaults, overwritten from EBM.AppSessionConfig at startup
// keyGenerator: IP + username — cada usuario tiene su propio contador (evita que IP compartida de oficina bloquee a todos)
const authKeyGenerator = (req: Request) => {
    const username = String(req.body?.username || '').toLowerCase().trim().substring(0, 50);
    // La IP pasa por `ipKeyGenerator`, que normaliza IPv6 a su subred /56. Con la IP en
    // crudo, un usuario con IPv6 estrena contador con solo cambiar de direccion dentro de su
    // propio bloque —y los bloques domesticos tienen billones—, asi que el limite de intentos
    // de login no le afectaba. Con IPv4 no se nota porque la direccion es una sola.
    return `${ipKeyGenerator(req.ip ?? '')}:${username}`;
};
let authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: authKeyGenerator,
    handler: avisoLimite('limite de login'),
    store: new RedisStore({ sendCommand: (...args: string[]) => (getRedisClient() as unknown as { call: (...a: string[]) => Promise<unknown> }).call(...args) as Promise<number>, prefix: 'rl:tec:auth:' }),

    passOnStoreError: true,   // si Redis cae, la app sigue sirviendo (sin limitar) en vez de dar 500
});

// --- CONFIGURACIÓN DE AZURE STORAGE BLOB ---
// [SECURITY] Nunca usar fallback literal con claves reales. Siempre cargar desde variables de entorno.
if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
    console.error('❌ FATAL: AZURE_STORAGE_CONNECTION_STRING no está definido en las variables de entorno.');
    process.exit(1);
}


const app = express();
const port = process.env.PORT || 3000;
// [SECURITY] El servidor se niega a iniciar si JWT_SECRET no está definido en el entorno.
if (!JWT_SECRET) {
    console.error('❌ FATAL: JWT_SECRET no está definido en las variables de entorno.');
    process.exit(1);
}
const distPath = path.join(process.cwd(), 'dist');


// Nota: la ruta /api/images se registra más abajo, después de verifyToken, para protegerla con autenticación.

// [SECURITY] Proxy de confianza para que express-rate-limit vea la IP real
app.set('trust proxy', 1);

// [SECURITY] CORS — múltiples orígenes desde env, con guard de producción
if (IS_PRODUCTION && !(process.env.ALLOWED_ORIGINS || '').trim()) {
    console.warn('WARNING: ALLOWED_ORIGINS no configurado en producción.');
}
app.use(cors({
    origin: (origin, callback) => {
        if (!IS_PRODUCTION) return callback(null, true);
        const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
        if (!origin || allowed.includes(origin)) callback(null, true);
        else callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));

// [SECURITY] Cabeceras de seguridad via helmet (incluye CSP)
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            formAction: ["'self'"],
            baseUri: ["'self'"],
            upgradeInsecureRequests: [],
        },
    },
    hsts: IS_PRODUCTION ? { maxAge: 31536000, includeSubDomains: true } : false,
}));

app.use(limiter);

// [SECURITY] Limitar tamaño de body para prevenir DoS
app.use(express.json({ limit: '1mb' }));
app.use('/api/auth/login', (req: Request, res: Response, next: NextFunction) => authLimiter(req, res, next));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.static(distPath));



// --- ESTADO DE IMPORTACIÓN ---






// [SECURITY] Imágenes estáticas protegidas con autenticación (se registra aquí, después de verifyToken)
if (process.env.IMAGE_STORAGE_PATH) {
    app.use('/api/images', verifyToken, express.static(process.env.IMAGE_STORAGE_PATH));
}



async function syncAllMissingTickets() {
    try {
        console.log('🔄 Iniciando sincronización de tickets faltantes en cache...');
        const db = await getWritePool();

        const cleanup = await db.request().query(`
            DELETE FROM [dbo].[GAC_PAGOS_CACHE]
            WHERE NOT EXISTS (
                SELECT 1 FROM [dbo].[GAC_APP_TB_TICKETS_PAGOS] P 
                WHERE P.ID_transaccion = [dbo].[GAC_PAGOS_CACHE].ID_transaccion
            )
        `);
        if (cleanup.rowsAffected[0] > 0) {
            console.log(`🧹 Limpieza: Se eliminaron ${cleanup.rowsAffected[0]} registros huérfanos del caché.`);
        }

        const missing = await db.request().query(`
            SELECT ID_transaccion 
            FROM [dbo].[GAC_APP_TB_TICKETS_PAGOS] P
            WHERE Fecha_creacion >= '2025-01-01'
            AND NOT EXISTS (SELECT 1 FROM [dbo].[GAC_PAGOS_CACHE] C WHERE C.ID_transaccion = P.ID_transaccion)
        `);
        
        if (missing.recordset.length === 0) {
            console.log('✅ Cache al día. No hay tickets faltantes.');
            return 0;
        }

        console.log(`⚠️ Se encontraron ${missing.recordset.length} tickets sin cache. Sincronizando...`);
        for (const row of missing.recordset) {
            await syncPaymentCache(row.ID_transaccion);
        }
        console.log(`✅ Sincronización masiva completada.`);
        return missing.recordset.length;
    } catch (err) {
        console.error('❌ Error en sincronización masiva:', err);
        return -1;
    }
}


app.use(authRouter);          // /api/auth login, logout, me, refresh



app.use(ssoAuthRouter);       // /api/auth/sso/authorize y /callback


// --- CONFIGURACIÓN DE RUTAS EXTERNAS ---
if (!APPSHEET_PDF_PATH) {
    console.warn('⚠️  APPSHEET_PDF_PATH no configurado. El endpoint de PDF de cotizaciones no funcionará.');
}

app.use(dashboardRouter);     // /api/dashboard (4 rutas)


async function runMigrations() {
    const db = await getDb();

    const steps: Array<{ name: string; sql: string }> = [
        {
            name: 'Add Apps to EBM.Roles',
            sql: `IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('EBM.Roles') AND name = 'Apps')
                  BEGIN ALTER TABLE EBM.Roles ADD Apps NVARCHAR(200) NOT NULL DEFAULT 'EBM'; END`
        },
        {
            name: 'Add Apps to EBM.Users',
            sql: `IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('EBM.Users') AND name = 'Apps')
                  BEGIN ALTER TABLE EBM.Users ADD Apps NVARCHAR(200) NULL DEFAULT 'TEC'; END`
        },
        {
            name: 'Add RequiresPasswordChange to EBM.Users',
            sql: `IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('EBM.Users') AND name = 'RequiresPasswordChange')
                  BEGIN ALTER TABLE EBM.Users ADD RequiresPasswordChange BIT NOT NULL DEFAULT 0; END`
        },
        {
            name: 'Add CreatedAt to EBM.Users',
            sql: `IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('EBM.Users') AND name = 'CreatedAt')
                  BEGIN ALTER TABLE EBM.Users ADD CreatedAt DATETIME NULL DEFAULT GETDATE(); END`
        },
        {
            name: 'Update Apps in EBM.Roles for TEC',
            sql: `UPDATE EBM.Roles
                  SET Apps = CASE
                      WHEN Apps IS NULL OR Apps = '' THEN 'TEC'
                      WHEN Apps NOT LIKE '%TEC%' THEN Apps + ', TEC'
                      ELSE Apps
                  END
                  WHERE Id IN (SELECT DISTINCT RoleId FROM EBM.RolePermissions WHERE Permission LIKE 'liq.%')
                  AND (Apps NOT LIKE '%TEC%' OR Apps IS NULL)`
        },
        {
            name: 'Update Apps in EBM.Users for TEC',
            sql: `UPDATE EBM.Users
                  SET Apps = CASE
                      WHEN Apps IS NULL OR Apps = '' THEN 'TEC'
                      WHEN Apps NOT LIKE '%TEC%' THEN Apps + ', TEC'
                      ELSE Apps
                  END
                  WHERE (Apps LIKE '%Liq%' OR Apps LIKE '%LIQ%' OR Apps LIKE '%ADMIN%')
                  AND (Apps NOT LIKE '%TEC%' OR Apps IS NULL)`
        },
        {
            name: 'Add tec.config.* permissions from liq.config.*',
            sql: `INSERT INTO EBM.RolePermissions (RoleId, Permission)
                  SELECT DISTINCT rp.RoleId, REPLACE(rp.Permission, 'liq.config.', 'tec.config.')
                  FROM EBM.RolePermissions rp
                  JOIN EBM.Roles r ON rp.RoleId = r.Id
                  WHERE r.Apps LIKE '%TEC%'
                    AND rp.Permission LIKE 'liq.config.%'
                    AND NOT EXISTS (
                        SELECT 1 FROM EBM.RolePermissions rp2
                        WHERE rp2.RoleId = rp.RoleId
                          AND rp2.Permission = REPLACE(rp.Permission, 'liq.config.', 'tec.config.')
                    )`
        },
        {
            name: 'Add tec.tickets.view permission',
            sql: `INSERT INTO EBM.RolePermissions (RoleId, Permission)
                  SELECT DISTINCT r.Id, 'tec.tickets.view'
                  FROM EBM.Roles r
                  WHERE r.Apps LIKE '%TEC%'
                    AND NOT EXISTS (
                        SELECT 1 FROM EBM.RolePermissions rp2
                        WHERE rp2.RoleId = r.Id AND rp2.Permission = 'tec.tickets.view'
                    )`
        },
        {
            name: 'Create GAC_APP_TB_CONFIG table',
            sql: `IF OBJECT_ID('dbo.GAC_APP_TB_CONFIG', 'U') IS NULL
                  BEGIN
                    CREATE TABLE [dbo].[GAC_APP_TB_CONFIG] (
                      [Clave] NVARCHAR(100) PRIMARY KEY,
                      [Valor] NVARCHAR(255) NOT NULL,
                      [Descripcion] NVARCHAR(500) NULL,
                      [Actualizado_el] DATETIME DEFAULT GETDATE(),
                      [Actualizado_por] NVARCHAR(100) NULL
                    );
                  END`
        },
        {
            name: 'Insert default HORA_MAXIMA_RANGO_HORARIO config',
            sql: `IF NOT EXISTS (SELECT 1 FROM [dbo].[GAC_APP_TB_CONFIG] WHERE [Clave] = 'HORA_MAXIMA_RANGO_HORARIO')
                  BEGIN
                    INSERT INTO [dbo].[GAC_APP_TB_CONFIG] ([Clave], [Valor], [Descripcion], [Actualizado_por])
                    VALUES ('HORA_MAXIMA_RANGO_HORARIO', '09:30', 'Hora maxima limite diaria (HH:mm) para asignar rango horario a tickets de hoy', 'SYSTEM');
                  END`
        },
        {
            name: 'Add tec.payments.view permission to all TEC roles',
            sql: `INSERT INTO EBM.RolePermissions (RoleId, Permission)
                  SELECT DISTINCT r.Id, 'tec.payments.view'
                  FROM EBM.Roles r
                  WHERE r.Apps LIKE '%TEC%'
                    AND NOT EXISTS (
                        SELECT 1 FROM EBM.RolePermissions rp2
                        WHERE rp2.RoleId = r.Id AND rp2.Permission = 'tec.payments.view'
                    )`
        },
        {
            name: 'Add tec.payments.register permission to roles that already have tec.payments.view',
            sql: `INSERT INTO EBM.RolePermissions (RoleId, Permission)
                  SELECT DISTINCT rp.RoleId, 'tec.payments.register'
                  FROM EBM.RolePermissions rp
                  WHERE rp.Permission = 'tec.payments.view'
                    AND NOT EXISTS (
                        SELECT 1 FROM EBM.RolePermissions rp2
                        WHERE rp2.RoleId = rp.RoleId AND rp2.Permission = 'tec.payments.register'
                    )`
        },
    ];

    for (const step of steps) {
        try {
            await db.request().query(step.sql);
        } catch (err: unknown) {
            console.warn(`⚠️ Migration step skipped [${step.name}]:`, mensajeError(err));
        }
    }
    console.log('✅ SQL Migrations complete');
}



app.use(ticketsRouter);       // /api/tec/... (10 rutas)

// --- PAGOS MULTI-TICKET ---

app.use(sapRouter);   // /api/sap/tickets/search -- montado en el mismo punto en que se definia

app.use(ticketsPagosRouter);  // /api/tickets-pagos (4 rutas)


app.use(configRouter);        // /api/config/rango-horario-limit


app.use(profileRouter);       // PUT /api/profile

app.use(managementsRouter);   // /api/managements

app.use(preferencesRouter);   // /api/user/preferences

// ─── AUDIT LOGS ───────────────────────────────────────────────────────────────
// El GET quedo huerfano al eliminarse AuditLogPage.tsx local (ya centralizado en SIATC
// Console); logAudit() sigue vivo y sigue alimentando GAC_APP_TB_AUDIT_LOG normalmente.

// --- APPLICATIONS (AppSwitcher dinámico) ---
app.get('/api/applications', verifyToken, async (req: Request, res: Response) => {
    try {
        const db = await getReadPool();
        const activeOnly = req.query.activeOnly === 'true';
        let query = `
            SELECT 
                a.Id as id, 
                a.Code as code, 
                a.Label as label, 
                a.Url as url, 
                a.LogoUrl as logo_url, 
                CAST(a.IsActive AS BIT) as is_active, 
                a.DisplayOrder as display_order, 
                a.CreatedAt as created_at,
                b.FontTitle as font_title,
                b.FontSubtitle as font_subtitle,
                b.FontHeader as font_header,
                b.FontSidebar as font_sidebar,
                b.FontTableData as font_table_data,
                b.BaseFontSize as base_font_size,
                b.SidebarWidth as sidebar_width,
                b.SidebarCollapsedWidth as sidebar_collapsed_width,
                b.SidebarDefaultState as sidebar_default_state,
                CAST(ISNULL(b.SidebarHoverExpand, 1) AS BIT) as sidebar_hover_expand,
                CAST(ISNULL(b.SidebarAllowCollapse, 1) AS BIT) as sidebar_allow_collapse,
                b.HeaderHeight as header_height,
                b.TableRowHeight as table_row_height,
                b.TransitionDuration as transition_duration,
                b.RadiusChip as radius_chip,
                b.RadiusButton as radius_button,
                b.RadiusInput as radius_input,
                b.RadiusCard as radius_card,
                b.RadiusModal as radius_modal,
                b.LightPrimary as light_primary,
                b.LightPrimaryForeground as light_primary_foreground,
                b.LightBg as light_bg,
                b.LightCard as light_card,
                b.LightBorder as light_border,
                b.LightTextPrimary as light_text_primary,
                b.LightTextSecondary as light_text_secondary,
                b.DarkPrimary as dark_primary,
                b.DarkPrimaryForeground as dark_primary_foreground,
                b.DarkBg as dark_bg,
                b.DarkCard as dark_card,
                b.DarkBorder as dark_border,
                b.DarkTextPrimary as dark_text_primary,
                b.DarkTextSecondary as dark_text_secondary,
                b.ShadowLevel1 as shadow_level_1,
                b.ShadowLevel2 as shadow_level_2,
                b.ShadowLevel3 as shadow_level_3,
                b.MobileFontScale as mobile_font_scale,
                b.MobileRadiusCard as mobile_radius_card,
                b.MobileRadiusButton as mobile_radius_button,
                b.MobilePaddingScale as mobile_padding_scale
            FROM [dbo].[GAC_APP_TB_CONSOLE_APPLICATIONS] a
            LEFT JOIN [dbo].[GAC_APP_TB_CONSOLE_APP_BRANDING] b ON a.Id = b.ApplicationId
        `;
        if (activeOnly) {
            query += ' WHERE a.IsActive = 1';
        }
        query += ' ORDER BY a.DisplayOrder ASC';

        const result = await db.request().query(query);
        
        const apps = result.recordset.map(row => ({
            id: row.id,
            code: row.code,
            label: row.label,
            url: row.url,
            logo_url: row.logo_url,
            is_active: row.is_active,
            display_order: row.display_order,
            created_at: row.created_at,
            sidebar_width: row.sidebar_width,
            sidebar_collapsed_width: row.sidebar_collapsed_width,
            sidebar_default_state: row.sidebar_default_state,
            sidebar_hover_expand: row.sidebar_hover_expand,
            sidebar_allow_collapse: row.sidebar_allow_collapse,
            theme_config: row.font_title ? {
                typography: {
                    fontTitle: row.font_title,
                    fontSubtitle: row.font_subtitle,
                    fontHeader: row.font_header,
                    fontSidebar: row.font_sidebar,
                    fontTableData: row.font_table_data,
                    baseFontSize: row.base_font_size,
                },
                border: {
                    radiusChip: row.radius_chip,
                    radiusButton: row.radius_button,
                    radiusCard: row.radius_card,
                    radiusModal: row.radius_modal,
                    radiusInput: row.radius_input,
                },
                light: {
                    primary: row.light_primary,
                    primaryForeground: row.light_primary_foreground,
                    background: row.light_bg,
                    card: row.light_card,
                    border: row.light_border,
                    textPrimary: row.light_text_primary,
                    textSecondary: row.light_text_secondary,
                },
                dark: {
                    primary: row.dark_primary,
                    primaryForeground: row.dark_primary_foreground,
                    background: row.dark_bg,
                    card: row.dark_card,
                    border: row.dark_border,
                    textPrimary: row.dark_text_primary,
                    textSecondary: row.dark_text_secondary,
                },
                layout: {
                    sidebarWidth: row.sidebar_width,
                    headerHeight: row.header_height,
                    tableRowHeight: row.table_row_height,
                    transitionDuration: row.transition_duration,
                },
                shadows: {
                    level1: row.shadow_level_1,
                    level2: row.shadow_level_2,
                    level3: row.shadow_level_3,
                },
                responsive: {
                    mobileFontScale: row.mobile_font_scale,
                    mobileRadiusCard: row.mobile_radius_card,
                    mobileRadiusButton: row.mobile_radius_button,
                    mobilePaddingScale: row.mobile_padding_scale,
                }
            } : null
        }));
        
        res.json(apps);
    } catch (err: unknown) {
        res.status(500).json({ error: safeError(err) });
    }
});

// --- SPA FALLBACK (React Router) ---
// Todas las rutas que NO son /api/* se sirven con index.html
// para que React Router maneje la navegación en el cliente.
app.get(/^(?!\/api\/).*/, (_req: Request, res: Response) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err);
    res.status(500).json({ error: safeError(err) });
});

interface SessionConfig { rateLimitMaxAttempts: number; rateLimitWindowMinutes: number; }

async function fetchSessionConfig(): Promise<SessionConfig> {
    try {
        const db = await getReadPool();
        const result = await db.request().input('code', sql.VarChar(20), APP_IDENTIFIER)
            .query('SELECT RateLimitMaxAttempts, RateLimitWindowMinutes FROM EBM.AppSessionConfig WHERE UPPER(AppCode) = UPPER(@code)');
        if (result.recordset.length > 0) {
            const row = result.recordset[0];
            return { rateLimitMaxAttempts: row.RateLimitMaxAttempts, rateLimitWindowMinutes: row.RateLimitWindowMinutes };
        }
    } catch (err: unknown) {
        console.warn('[SessionConfig] Could not fetch from DB, using defaults:', (err as Error).message);
    }
    return { rateLimitMaxAttempts: 10, rateLimitWindowMinutes: 15 };
}

// --- INICIO DEL SERVIDOR ---
app.listen(port, () => {
    console.log(`🚀 Servidor Gestión Técnica escuchando en puerto ${port}`);
    runMigrations().catch(err => console.error('❌ Migration failed:', err.message));
    setTimeout(() => syncAllMissingTickets(), 15000);
    fetchSessionConfig().then(cfg => {
        authLimiter = rateLimit({
            windowMs: cfg.rateLimitWindowMinutes * 60 * 1000,
            max: cfg.rateLimitMaxAttempts,
            standardHeaders: true,
            legacyHeaders: false,
            skipSuccessfulRequests: true,
            keyGenerator: authKeyGenerator,
            message: { error: `Demasiados intentos de inicio de sesión. Espera ${cfg.rateLimitWindowMinutes} minutos.` },
            store: new RedisStore({ sendCommand: (...args: string[]) => (getRedisClient() as unknown as { call: (...a: string[]) => Promise<unknown> }).call(...args) as Promise<number>, prefix: 'rl:tec:auth:' }),

            passOnStoreError: true,   // si Redis cae, la app sigue sirviendo (sin limitar) en vez de dar 500
        });
        console.log(`[SessionConfig] Auth limiter: ${cfg.rateLimitMaxAttempts} intentos / ${cfg.rateLimitWindowMinutes} min`);
    }).catch(err => console.error('[SessionConfig] Failed to load rate limit config:', err));
});
