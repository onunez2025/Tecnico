import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sql from 'mssql';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import { BlobServiceClient } from '@azure/storage-blob';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import Redis from 'ioredis';
import { createHash } from 'crypto';
import { RedisStore } from 'rate-limit-redis';
import axios from 'axios';
import { z } from 'zod';
dotenv.config();
const APP_IDENTIFIER = 'TEC';

const C4C_BASE_URL = process.env.C4C_BASE_URL;
const C4C_AUTH = Buffer.from(`${process.env.C4C_USER || ''}:${process.env.C4C_PASSWORD || ''}`).toString('base64');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// --- TIPOS TIPADOS PARA REQUESTS AUTENTICADOS ---
interface AuthenticatedRequest extends Request {
    user: {
        id: string;
        username: string;
        full_name: string;
        role: string;
        permissions: string[];
    };
}

// --- VALIDACIÓN POR MAGIC BYTES (previene spoofing de MIME) ---
const MAGIC_BYTES: Record<string, number[][]> = {
    'image/jpeg':      [[0xFF, 0xD8, 0xFF]],
    'image/png':       [[0x89, 0x50, 0x4E, 0x47]],
    'image/webp':      [[0x52, 0x49, 0x46, 0x46]],
    'image/gif':       [[0x47, 0x49, 0x46, 0x38]],
    'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
};

async function validateFileMagicBytes(filePath: string, declaredMime: string): Promise<boolean> {
    try {
        const fd = await fs.promises.open(filePath, 'r');
        const buf = Buffer.alloc(8);
        await fd.read(buf, 0, 8, 0);
        await fd.close();
        const sigs = MAGIC_BYTES[declaredMime];
        if (!sigs) return false;
        return sigs.some(sig => sig.every((byte, i) => buf[i] === byte));
    } catch {
        return false;
    }
}

// --- RATE LIMITING ---
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas solicitudes. Intenta más tarde.' },
    store: new RedisStore({ sendCommand: (...args: string[]) => (getRedisClient() as any).call(...args) as any, prefix: 'rl:tec:' }),
});

// Auth rate limiter — starts with safe defaults, overwritten from EBM.AppSessionConfig at startup
// keyGenerator: IP + username — cada usuario tiene su propio contador (evita que IP compartida de oficina bloquee a todos)
const authKeyGenerator = (req: Request) => {
    const username = String(req.body?.username || '').toLowerCase().trim().substring(0, 50);
    return `${req.ip}:${username}`;
};
let authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: authKeyGenerator,
    message: { error: 'Demasiados intentos de inicio de sesión. Intenta más tarde.' },
    store: new RedisStore({ sendCommand: (...args: string[]) => (getRedisClient() as any).call(...args) as any, prefix: 'rl:tec:auth:' }),
});

// --- CACHÉ EN MEMORIA (TTL simple para endpoints estáticos) ---
const _cache = new Map<string, { data: unknown; expiresAt: number }>();
function cacheGet(key: string): unknown | null {
    const entry = _cache.get(key);
    if (entry && entry.expiresAt > Date.now()) return entry.data;
    _cache.delete(key);
    return null;
}
function cacheSet(key: string, data: unknown, ttlMs: number) {
    _cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}
function cacheInvalidate(key: string) { _cache.delete(key); }

// --- CONFIGURACIÓN DE AZURE STORAGE BLOB ---
// [SECURITY] Nunca usar fallback literal con claves reales. Siempre cargar desde variables de entorno.
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
if (!AZURE_STORAGE_CONNECTION_STRING) {
    console.error('❌ FATAL: AZURE_STORAGE_CONNECTION_STRING no está definido en las variables de entorno.');
    process.exit(1);
}
const AZURE_STORAGE_CONTAINER = process.env.AZURE_STORAGE_CONTAINER || 'stecnico';
const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient(AZURE_STORAGE_CONTAINER);

const app = express();
const port = process.env.PORT || 3000;
// [SECURITY] El servidor se niega a iniciar si JWT_SECRET no está definido en el entorno.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('❌ FATAL: JWT_SECRET no está definido en las variables de entorno.');
    process.exit(1);
}
const distPath = path.join(process.cwd(), 'dist');

const cleanApps = (str: string) => [...new Set((str || '').split(',').map(s => s.trim()).filter(Boolean))].join(', ');

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
app.use('/api/auth/login', (req: Request, res: Response, next: NextFunction) => authLimiter(req, res, next));

// [SECURITY] Limitar tamaño de body para prevenir DoS
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.static(distPath));

const dbConfig: sql.config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    server: process.env.DB_SERVER || '',
    port: 1433,
    pool: { max: 30, min: 0, idleTimeoutMillis: 30000 },
    options: { encrypt: true, trustServerCertificate: !IS_PRODUCTION, requestTimeout: 60000 }
};

// --- CONFIGURACIÓN DE MULTER (CARGA DE ARCHIVOS) ---
// [SECURITY] Restringir tipo de archivo y tamaño máximo para evitar uploads maliciosos.
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
const MAX_FILE_SIZE_MB = 10;

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Sanitizar el nombre de archivo original
        const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${Date.now()}-${safeName}`);
    }
});
const multerFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}. Solo se aceptan imágenes y PDF.`));
    }
};
const upload = multer({ storage, fileFilter: multerFileFilter, limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 } });

// --- ESTADO DE IMPORTACIÓN ---
const importProgress: { [key: string]: { current: number; total: number } } = {};

let pool: sql.ConnectionPool | null = null;

async function getDb() {
    if (!pool || !pool.connected) {
        try {
            pool = await new sql.ConnectionPool(dbConfig).connect();
            pool.on('error', (err: Error) => {
                console.error('❌ DB Pool error:', err.message);
                pool = null;
            });
            console.log('✅ Conectado a Azure SQL: ' + dbConfig.database);
        } catch (err: any) {
            console.error('❌ Error de conexión DB:', err.message);
            pool = null;
            throw err;
        }
    }
    return pool;
}

// --- REDIS CLIENT ---
let _redis: Redis | null = null;
function getRedisClient(): Redis {
    if (!_redis) {
        _redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            lazyConnect: true,
            retryStrategy: (times) => Math.min(times * 100, 3000),
        });
        _redis.on('error', (err) => console.error('[Redis] Error:', err.message));
    }
    return _redis;
}
async function isTokenBlacklisted(token: string): Promise<boolean> {
    try {
        const hash = createHash('sha256').update(token).digest('hex');
        return (await getRedisClient().exists(`bl:${hash}`)) === 1;
    } catch { return false; }
}
async function blacklistToken(token: string, exp: number): Promise<void> {
    try {
        const hash = createHash('sha256').update(token).digest('hex');
        const ttl = Math.max(exp - Math.floor(Date.now() / 1000), 0);
        if (ttl > 0) await getRedisClient().set(`bl:${hash}`, '1', 'EX', ttl);
    } catch (err) { console.error('[Redis] Error al blacklistear token:', err); }
}

// --- SECURITY HELPERS (ver CLAUDE.md) ---
const safeError = (err: unknown): string =>
    process.env.NODE_ENV === 'production'
        ? 'Error interno del servidor'
        : err instanceof Error ? err.message : String(err);

const sanitizeLog = (val: unknown, maxLen = 200): string =>
    String(val ?? '').replace(/[\r\n\t\x00-\x1F\x7F]/g, ' ').slice(0, maxLen);

const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token no encontrado' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET as string) as AuthenticatedRequest['user'];
        if (await isTokenBlacklisted(token)) {
            return res.status(401).json({ error: 'Sesión cerrada. Inicia sesión nuevamente.' });
        }
        (req as AuthenticatedRequest).user = decoded;
        next();
    } catch (err: any) {
        if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' });
        res.status(403).json({ error: 'Token inválido' });
    }
};

// [SECURITY] Imágenes estáticas protegidas con autenticación (se registra aquí, después de verifyToken)
if (process.env.IMAGE_STORAGE_PATH) {
    app.use('/api/images', verifyToken, express.static(process.env.IMAGE_STORAGE_PATH));
}

// Helper for Auditing
async function logAudit(req: Request, action: string, entity: string, entityId: string, details: any) {
    try {
        const user = (req as any).user;
        if (!user) return;
        const db = await getDb();
        await db.request()
            .input('uid', sql.NVarChar(sql.MAX), String(user.id))
            .input('un', sql.NVarChar(sql.MAX), user.username)
            .input('acc', sql.NVarChar(sql.MAX), action)
            .input('ent', sql.NVarChar(sql.MAX), entity)
            .input('eid', sql.NVarChar(sql.MAX), entityId)
            .input('det', sql.NVarChar(sql.MAX), JSON.stringify(details))
            .query(`INSERT INTO [dbo].[GAC_APP_TB_AUDIT_LOG] (UsuarioID, UsuarioNombre, Accion, Entidad, EntidadID, Detalle, Fecha)
                    VALUES (@uid, @un, @acc, @ent, @eid, @det, GETDATE())`);
    } catch (err) {
        console.error('❌ Falla en Log de Auditoría:', err);
    }
}

async function syncPaymentCache(id_transaccion: string) {
    try {
        const db = await getDb();
        await db.request().input('id', sql.VarChar(50), id_transaccion).query(`
            DELETE FROM [dbo].[GAC_PAGOS_CACHE] WHERE ID_transaccion = @id;
            
            INSERT INTO [dbo].[GAC_PAGOS_CACHE] (
                ID_transaccion, Fecha_creacion, Fecha_transaccion, Estado, 
                Importe_Texto, Importe_Num, Voucher, Canal, Folio, CodigoAutorizacion, 
                Lote, Codigo_Izipay, Ticket_Original, Observacion, Fecha_recepcion, 
                Fecha_liquidacion, Tecnicos, Clientes, TipoServicio, Distrito, 
                Direccion, FechaVisita, Total_Facturado, Total_Material_Used, 
                Tiene_Factura, Tiene_Materiales, Monto_Discrepante,
                Aprobacion_Comentario, Aprobacion_Por, Aprobacion_El
            )
            SELECT 
                P.ID_transaccion, P.Fecha_creacion, P.Fecha_transaccion, P.Estado,
                P.Importe as Importe_Texto,
                TRY_CAST(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(P.Importe, '0'), 'S/', ''), ',', ''), CHAR(160), ''), ' ', ''), CHAR(9), '') AS DECIMAL(18,2)),
                P.Voucher, P.Canal, P.Folio, P.CodigoAutorizacion, P.Lote, P.Codigo_Izipay,
                P.Ticket, P.Observacion, P.Fecha_recepcion, P.Fecha_liquidacion,
                M.Tecnicos, M.Clientes, M.TiposServicio, M.Distrito_Ref, M.Direccion_Ref,
                M.FechaVisita_Max, M.Total_Facturado, M.Total_Material_Used,
                CASE WHEN M.Total_Facturado > 0 THEN 1 ELSE 0 END,
                CASE WHEN M.Total_Material_Used > 0 THEN 1 ELSE 0 END,
                CASE WHEN ABS(TRY_CAST(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(P.Importe, '0'), 'S/', ''), ',', ''), CHAR(160), ''), ' ', ''), CHAR(9), '') AS DECIMAL(18,2)) - M.Total_Facturado) >= 1.0 THEN 1 ELSE 0 END,
                P.Aprobacion_Comentario, P.Aprobacion_Por, P.Aprobacion_El
            FROM [dbo].[GAC_APP_TB_TICKETS_PAGOS] P
            OUTER APPLY (
                SELECT 
                    STRING_AGG(CAST(ISNULL(F.NombreTecnico + ' ' + F.ApellidoTecnico, 'SIN TECNICO') AS VARCHAR(MAX)), ' | ') as Tecnicos,
                    STRING_AGG(CAST(ISNULL(F.NombreCliente, 'SIN CLIENTE') AS VARCHAR(MAX)), ' | ') as Clientes,
                    STRING_AGG(CAST(ISNULL(TS.Descripcion, 'SIN TIPO') AS VARCHAR(MAX)), ' | ') as TiposServicio,
                    MAX(ISNULL(F.Distrito, '')) as Distrito_Ref,
                    MAX(ISNULL(F.Calle + ' ' + F.NumeroCalle, '')) as Direccion_Ref,
                    MAX(F.FechaVisita) as FechaVisita_Max,
                    SUM(ISNULL(SAP.Total_Facturado, 0)) as Total_Facturado,
                    SUM(ISNULL(PT.Total_Pagado_Ticket, 0)) as Total_Pagado_Contexto,
                    SUM(ISNULL(SMat.Material_Used_Count, 0)) as Total_Material_Used
                FROM (
                    SELECT LTRIM(RTRIM(value)) as TicketID FROM STRING_SPLIT(P.Ticket, ',')
                ) T
                LEFT JOIN [SIATC].[Dashboard_FSM] F ON T.TicketID = F.Ticket
                LEFT JOIN [SIATC].[FSM_TipoServicio] TS ON F.IdServicio = TS.Id
                OUTER APPLY (
                    SELECT SUM(
                        (ISNULL(V.DE_neto, 0) + ISNULL(V.DE_igv, 0)) * CASE 
                            WHEN V.VC_documento_pago_clase IN ('S2', 'ZNCV', 'ZNCD') THEN -1 
                            WHEN V.VC_documento_pago_clase LIKE 'ZTG%' OR V.VC_anulacion_status = 'X' THEN 0
                            ELSE 1 
                        END
                    ) as Total_Facturado
                    FROM [SAP].[SD_VENTAS] V
                    WHERE LTRIM(RTRIM(V.VC_oden_compra_numero)) = T.TicketID
                       OR (TRY_CAST(LTRIM(RTRIM(V.VC_oden_compra_numero)) AS BIGINT) = TRY_CAST(T.TicketID AS BIGINT) AND TRY_CAST(T.TicketID AS BIGINT) IS NOT NULL)
                ) SAP
                OUTER APPLY (
                    SELECT SUM(TRY_CAST(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(P2.Importe, '0'), 'S/', ''), ',', ''), CHAR(160), ''), ' ', ''), CHAR(9), '') AS DECIMAL(18,2))) as Total_Pagado_Ticket
                    FROM [dbo].[GAC_APP_TB_TICKETS_PAGOS] P2
                    WHERE EXISTS (SELECT 1 FROM STRING_SPLIT(P2.Ticket, ',') S2 WHERE LTRIM(RTRIM(S2.value)) = T.TicketID)
                ) PT
                OUTER APPLY (
                    SELECT COUNT(*) as Material_Used_Count
                    FROM [APPGAC].[ServiciosMateriales] sm 
                    WHERE sm.Ticket = T.TicketID AND ISNULL(sm.Catidad_usada, 0) > 0
                ) SMat
            ) M
            WHERE P.ID_transaccion = @id;
        `);
    } catch (err) {
        console.error('❌ Error syncing payment cache:', err);
    }
}

async function syncAllMissingTickets() {
    try {
        console.log('🔄 Iniciando sincronización de tickets faltantes en cache...');
        const db = await getDb();

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

const checkPermission = (permission: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'No autenticado' });
        
        const role = (user.role || '').trim().toLowerCase();
        if (role === 'administrador') return next();
        
        const userPerms = user.permissions || (user as any).perms;
        if (userPerms && userPerms.includes(permission)) {
            return next();
        }

        try {
            const db = await getDb();
            await db.request()
                .input('uid', sql.NVarChar(sql.MAX), String(user.id))
                .input('un', sql.NVarChar(sql.MAX), user.full_name || user.username)
                .input('acc', sql.NVarChar(sql.MAX), 'ACCESO_DENEGADO')
                .input('ent', sql.NVarChar(sql.MAX), `Endpoint: ${req.method} ${req.baseUrl}${req.path}`)
                .input('eid', sql.NVarChar(sql.MAX), permission)
                .input('det', sql.NVarChar(sql.MAX), JSON.stringify({
                    ip: req.ip,
                    userAgent: req.get('user-agent'),
                    params: req.params,
                    query: req.query
                }))
                .query(`
                    INSERT INTO [dbo].[GAC_APP_TB_AUDIT_LOG]
                    (UsuarioID, UsuarioNombre, Accion, Entidad, EntidadID, Detalle)
                    VALUES (@uid, @un, @acc, @ent, @eid, @det)
                `);
        } catch (logErr) {
            console.error('CRITICAL: Failed to log audit event:', logErr);
        }

        res.status(403).json({ error: `Sin permiso para esta acción (${permission})` });
    };
};

// --- AUTH ---
const loginSchema = z.object({
    username: z.string().min(1, 'Usuario requerido').max(255),
    password: z.string().min(1, 'Contraseña requerida').max(255),
    remember: z.boolean().optional(),
});
const createUserSchema = z.object({
    username: z.string().min(1).max(100),
    full_name: z.string().min(1).max(200),
    email: z.email('Email inválido'),
    password_hash: z.string().min(6, 'Mínimo 6 caracteres').max(255),
    role_id: z.union([z.string().min(1), z.number()]),
    apps: z.string().optional(),
    is_active: z.boolean().optional(),
});
const updateUserSchema = z.object({
    full_name: z.string().min(1).max(200),
    email: z.email('Email inválido'),
    role_id: z.union([z.string().min(1), z.number()]),
    apps: z.string().optional(),
    is_active: z.boolean().optional(),
    password_hash: z.string().min(6).max(255).optional(),
});
const roleSchema = z.object({
    name: z.string().min(1, 'El nombre del rol es requerido').max(100),
    permissions: z.array(z.string()).optional(),
    apps: z.string().optional(),
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: 'Datos de login inválidos', details: parseResult.error.issues });
    }
    const { username, password, remember } = parseResult.data;
    try {
        const db = await getDb();
        const result = await db.request().input('u', sql.NVarChar(sql.MAX), username).input('app', sql.NVarChar(sql.MAX), APP_IDENTIFIER).query(`
            SELECT u.*, r.Name as RoleName, uc.CASId as cas_id, c.Nombre_CAS as cas_name, LTRIM(RTRIM(c.Abrev_nombre_colaboradores)) as cas_prefijo,
                r.InactivityTimeoutMinutes as role_timeout, r.WarningBeforeMinutes as role_warning
            FROM EBM.Users u
            LEFT JOIN EBM.Roles r ON u.RoleId = r.Id
            LEFT JOIN EBM.UserCAS uc ON u.Id = uc.UserId
            LEFT JOIN dbo.GAC_APP_TB_CAS c ON uc.CASId = c.ID_CAS
            WHERE (u.Username = @u OR u.Email = @u) AND u.IsActive = 1
              AND (u.Apps LIKE '%' + @app + '%' OR u.Apps LIKE '%ADMIN%')
        `);
        const user = result.recordset[0];
        if (!user || !user.PasswordHash || !(await bcrypt.compare(password, user.PasswordHash))) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const perms = (await db.request().input('rid', sql.UniqueIdentifier, user.RoleId).query("SELECT Permission FROM EBM.RolePermissions WHERE RoleId = @rid")).recordset.map((p: any) => p.Permission);

        const appCfgResult = await db.request().input('appCode', sql.VarChar(20), APP_IDENTIFIER)
            .query('SELECT DefaultInactivityTimeoutMinutes, DefaultWarningBeforeMinutes FROM EBM.AppSessionConfig WHERE UPPER(AppCode) = UPPER(@appCode)');
        const appCfg = appCfgResult.recordset[0];
        const timeoutMinutes: number = user.role_timeout ?? appCfg?.DefaultInactivityTimeoutMinutes ?? 30;
        const warningMinutes: number = user.role_warning ?? appCfg?.DefaultWarningBeforeMinutes ?? 2;

        // [SECURITY] Token "Recuérdame" reducido de 30d a 7d para limitar ventana de compromiso
        const expiresIn = remember ? '7d' : '12h';

        const token = jwt.sign(
            {
                id: user.Id,
                role_id: user.RoleId,
                role: user.RoleName,
                username: user.Username,
                full_name: user.FullName,
                permissions: perms,
                apps: user.Apps || '',
                casId: user.cas_id || null,
                casName: user.cas_name || null,
                casPrefijo: user.cas_prefijo || null
            },
            JWT_SECRET as string,
            { expiresIn }
        );

        // Token SSO mínimo para la cookie (sin permisos — garantiza < 400 bytes sin importar cuántos permisos tenga el rol)
        const ssoToken = jwt.sign(
            { id: user.Id, role: user.RoleName, role_name: user.RoleName, username: user.Username, apps: user.Apps || '', casId: user.cas_id || null },
            JWT_SECRET as string,
            { expiresIn }
        );
        if (IS_PRODUCTION) {
            res.cookie('token', ssoToken, {
                domain: '.siatc.cloud',
                maxAge: (remember ? 7 * 24 * 60 * 60 : 12 * 60 * 60) * 1000,
                httpOnly: false,
                secure: true,
                sameSite: 'lax',
                path: '/'
            });
        }

        res.json({
            token,
            user: {
                id: user.Id,
                username: user.Username,
                full_name: user.FullName,
                role_name: user.RoleName,
                role: user.RoleName,
                permissions: perms,
                perms: perms,
                apps: user.Apps || '',
                requires_password_change: user.RequiresPasswordChange === 1
            },
            sessionConfig: { timeoutMinutes, warningMinutes }
        });
    } catch (err: any) {
        console.error('❌ Error en Login:', err);
        res.status(500).json({ error: safeError(err) });
    }
});

app.post('/api/auth/logout', verifyToken, async (req: any, res: any) => {
    const token = req.headers['authorization']!.split(' ')[1];
    await blacklistToken(token, (req.user as any).exp ?? 0);
    res.json({ message: 'Sesión cerrada correctamente.' });
});

app.get('/api/auth/me', verifyToken, async (req: Request, res: Response) => {
    try {
        const { id } = (req as any).user;
        const db = await getDb();
        const result = await db.request().input('id', sql.UniqueIdentifier, id).query(`
            SELECT u.*, r.Name as RoleName, uc.CASId as cas_id, c.Nombre_CAS as cas_name, LTRIM(RTRIM(c.Abrev_nombre_colaboradores)) as cas_prefijo
            FROM EBM.Users u
            LEFT JOIN EBM.Roles r ON u.RoleId = r.Id
            LEFT JOIN EBM.UserCAS uc ON u.Id = uc.UserId
            LEFT JOIN dbo.GAC_APP_TB_CAS c ON uc.CASId = c.ID_CAS
            WHERE u.Id = @id
        `);
        const user = result.recordset[0];
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        const perms = (await db.request().input('rid', sql.UniqueIdentifier, user.RoleId).query("SELECT Permission FROM EBM.RolePermissions WHERE RoleId = @rid")).recordset.map((p: any) => p.Permission);
        const freshToken = jwt.sign(
            {
                id: user.Id,
                role_id: user.RoleId,
                role: user.RoleName,
                username: user.Username,
                full_name: user.FullName,
                permissions: perms,
                apps: user.Apps || '',
                casId: user.cas_id || null,
                casName: user.cas_name || null,
                casPrefijo: user.cas_prefijo || null
            },
            JWT_SECRET as string,
            { expiresIn: '12h' }
        );
        const ssoToken = jwt.sign(
            { id: user.Id, role: user.RoleName, role_name: user.RoleName, username: user.Username, apps: user.Apps || '', casId: user.cas_id || null },
            JWT_SECRET as string,
            { expiresIn: '12h' }
        );
        if (IS_PRODUCTION) {
            res.cookie('token', ssoToken, {
                domain: '.siatc.cloud',
                maxAge: 12 * 60 * 60 * 1000,
                httpOnly: false,
                secure: true,
                sameSite: 'lax',
                path: '/'
            });
        }

        res.json({
            token: freshToken,
            user: {
                id: user.Id,
                username: user.Username,
                full_name: user.FullName,
                role_name: user.RoleName,
                role: user.RoleName,
                permissions: perms,
                perms: perms,
                apps: user.Apps || ''
            }
        });
    } catch (err: any) { res.status(500).json({ error: safeError(err) }); }
});

app.post('/api/auth/refresh', async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token no encontrado' });
    if (await isTokenBlacklisted(token)) {
        return res.status(401).json({ error: 'Sesión cerrada. Inicia sesión nuevamente.' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET as string, { ignoreExpiration: true }) as any;
        const now = Math.floor(Date.now() / 1000);
        if (decoded.exp && (now - decoded.exp) > 24 * 60 * 60) {
            return res.status(401).json({ error: 'Sesión demasiado antigua. Inicia sesión nuevamente.' });
        }
        const db = await getDb();
        const result = await db.request().input('id', sql.NVarChar(sql.MAX), String(decoded.id)).query(
            `SELECT u.Id, u.Username, u.FullName, u.RoleId, u.IsActive, r.Name as RoleName FROM EBM.Users u LEFT JOIN EBM.Roles r ON u.RoleId = r.Id WHERE u.Id = @id`
        );
        const user = result.recordset[0];
        if (!user || !user.IsActive) return res.status(401).json({ error: 'Usuario inactivo' });
        const perms = (await db.request().input('rid', sql.NVarChar(sql.MAX), String(user.RoleId)).query(
            'SELECT Permission FROM EBM.RolePermissions WHERE RoleId = @rid'
        )).recordset.map((p: any) => p.Permission);
        const newToken = jwt.sign(
            { id: user.Id, username: user.Username, full_name: user.FullName, role: user.RoleName, permissions: perms },
            JWT_SECRET as string,
            { expiresIn: '12h' }
        );
        res.json({ token: newToken });
    } catch {
        res.status(401).json({ error: 'Token inválido' });
    }
});

// --- CONFIGURACIÓN DE RUTAS EXTERNAS ---
const APPSHEET_PDF_PATH = process.env.APPSHEET_PDF_PATH ?? '';
if (!APPSHEET_PDF_PATH) {
    console.warn('⚠️  APPSHEET_PDF_PATH no configurado. El endpoint de PDF de cotizaciones no funcionará.');
}

// --- DASHBOARD ---
app.get('/api/dashboard/stats', verifyToken, checkPermission('tec.dashboard.view'), async (req: Request, res: Response) => {
    try {
        const { search = '', status = '', field = 'all', auth_code = '', date_trans = '', date_visit = '', tipo_servicio = '', month = '', year = '' } = req.query as any;
        const db = await getDb();
        const sqlReq = db.request();
        
        let whereClause = "WHERE Fecha_transaccion >= '2025-01-01'";
        const statusVal = String(status || '').trim().toUpperCase();
        
        if (statusVal && statusVal !== 'ALL' && statusVal !== 'TOTAL') {
            if (statusVal === 'LIQUIDADO') {
                whereClause += " AND Estado = 'LIQUIDADO'";
            } else if (statusVal === 'SIN_FACTURA') {
                whereClause += " AND Tiene_Factura = 0 AND Estado <> 'RECHAZADO'";
            } else if (statusVal === 'SIN_MATERIALES') {
                whereClause += " AND Tiene_Materiales = 0";
            } else if (statusVal === 'LIQUIDADO_OBSERVADO') {
                whereClause += " AND Estado = 'LIQUIDADO' AND (Observacion IS NOT NULL AND LTRIM(RTRIM(CAST(Observacion AS NVARCHAR(MAX)))) <> '')";
            } else {
                whereClause += ' AND Estado = @status';
                sqlReq.input('status', sql.NVarChar(sql.MAX), statusVal);
            }
        }

        if (search) {
            sqlReq.input('search', sql.NVarChar(sql.MAX), `%${search}%`);
            if (field === 'ticket') {
                whereClause += ` AND Ticket_Original LIKE @search`;
            } else if (field === 'vouch') {
                whereClause += ` AND Voucher LIKE @search`;
            } else if (field === 'tec') {
                whereClause += ` AND Tecnicos LIKE @search`;
            } else if (field === 'folio') {
                whereClause += ` AND Folio LIKE @search`;
            } else {
                whereClause += ` AND (Ticket_Original LIKE @search OR ID_transaccion LIKE @search OR Voucher LIKE @search OR Folio LIKE @search OR Tecnicos LIKE @search OR Clientes LIKE @search)`;
            }
        }

        if (auth_code) {
            whereClause += " AND CodigoAutorizacion LIKE @auth";
            sqlReq.input('auth', sql.NVarChar(sql.MAX), `%${auth_code}%`);
        }
        if (date_trans) {
            whereClause += " AND CAST(Fecha_transaccion AS DATE) = @dateTrans";
            sqlReq.input('dateTrans', sql.VarChar(10), date_trans);
        }
        if (date_visit) {
            whereClause += " AND CAST(FechaVisita AS DATE) = @dateVisit";
            sqlReq.input('dateVisit', sql.VarChar(10), date_visit);
        }
        if (tipo_servicio) {
            whereClause += " AND TipoServicio LIKE @tipoServicio";
            sqlReq.input('tipoServicio', sql.NVarChar(sql.MAX), `%${tipo_servicio}%`);
        }
        if (month) {
            whereClause += " AND MONTH(Fecha_transaccion) = @month";
            sqlReq.input('month', sql.Int, parseInt(month));
        }
        if (year) {
            whereClause += " AND YEAR(Fecha_transaccion) = @year";
            sqlReq.input('year', sql.Int, parseInt(year));
        }

        // RLS: usuario CAS solo ve sus propios datos
        const currentUser = (req as any).user;
        if (currentUser.casId) {
            whereClause += ' AND ID_cas = @casId';
            sqlReq.input('casId', sql.VarChar(50), currentUser.casId);
        }

        const query = `
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN Estado = 'NUEVO' THEN 1 ELSE 0 END) as pendientes_recepcionar,
                SUM(CASE WHEN Estado IN ('RECEPCIONADO', 'COTIZACION GENERADA') THEN 1 ELSE 0 END) as liquidados_sap,
                SUM(CASE WHEN Estado = 'RECHAZADO' THEN 1 ELSE 0 END) as rechazados_total,
                SUM(CASE WHEN Estado = 'REVISAR' THEN 1 ELSE 0 END) as alertas_pos,
                SUM(CASE WHEN Estado = 'LIQUIDADO' THEN 1 ELSE 0 END) as por_recepcionar_logistica,
                SUM(CASE WHEN Estado = 'OBSERVADO' THEN 1 ELSE 0 END) as observados_logistica,
                SUM(CASE WHEN Tiene_Factura = 0 AND Estado <> 'RECHAZADO' THEN 1 ELSE 0 END) as sin_factura,
                SUM(CASE WHEN Tiene_Materiales = 1 THEN 0 ELSE 1 END) as sin_materiales,
                SUM(CASE WHEN Estado = 'PENDIENTE_APROBACION' THEN 1 ELSE 0 END) as pendiente_aprobacion,
                SUM(ISNULL(Importe_Num, 0)) as monto_total
            FROM [dbo].[GAC_PAGOS_CACHE] vw
            ${whereClause}
        `;

        const stats = await sqlReq.query(query);
        res.json(stats.recordset[0]);
    } catch (err: any) {
        console.error('❌ ERROR DASHBOARD STATS:', err.message);
        res.status(500).json({ error: safeError(err) });
    }
});

app.get('/api/dashboard/technicians', verifyToken, checkPermission('tec.dashboard.view'), async (req: Request, res: Response) => {
    try {
        const db = await getDb();
        const sqlReq = db.request();
        // RLS: usuario CAS solo ve sus propios datos
        const currentUser = (req as any).user; // eslint-disable-line @typescript-eslint/no-explicit-any
        let techWhere = `WHERE Fecha_transaccion >= '2025-01-01'`;
        if (currentUser?.casId) {
            techWhere += ' AND ID_cas = @casId';
            sqlReq.input('casId', sql.VarChar(50), currentUser.casId);
        }
        const result = await sqlReq.query(`
            SELECT TOP 15
                ISNULL(Tecnicos, 'SIN TECNICO') as tecnico,
                COUNT(*) as total_cobros,
                SUM(CASE WHEN Estado = 'NUEVO' THEN 1 ELSE 0 END) as pendientes_recepcionar,
                SUM(CASE WHEN Estado IN ('RECEPCIONADO', 'COTIZACION GENERADA') THEN 1 ELSE 0 END) as pendientes_liquidar,
                SUM(CASE WHEN Estado = 'RECHAZADO' THEN 1 ELSE 0 END) as rechazados,
                SUM(Importe_Num) as monto_total
            FROM [dbo].[GAC_PAGOS_CACHE]
            ${techWhere}
            GROUP BY Tecnicos
            ORDER BY total_cobros DESC
        `);
        res.json(result.recordset);
    } catch (err: any) { 
        console.error('❌ ERROR SQL (technicians):', err.message);
        res.status(500).json({ error: safeError(err) }); 
    }
});

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
        } catch (err: any) {
            console.warn(`⚠️ Migration step skipped [${step.name}]:`, err.message);
        }
    }
    console.log('✅ SQL Migrations complete');
}

app.get('/api/dashboard/cas-performance', verifyToken, checkPermission('tec.dashboard.view'), async (req: Request, res: Response) => {
    try {
        const db = await getDb();
        const currentUser = (req as any).user;
        // RLS: usuario CAS siempre ve solo su propia empresa, ignorando query params
        const casId: string = currentUser.casId ?? (req.query.casId as string);
        const zone: string | undefined = currentUser.casId ? undefined : (req.query.zone as string);
        
        let statsQuery = '';
        const sqlReq = db.request();
        const setupQuery = `
            SET NOCOUNT ON;
            DECLARE @Pagos TABLE (Ticket varchar(MAX), ImporteValido decimal(18,2));
            INSERT INTO @Pagos (Ticket, ImporteValido)
            SELECT Ticket, TRY_CAST(REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(Importe, '0'), 'S/', ''), ',', ''), Char(160), ''), ' ', '') as decimal(18,2))
            FROM [dbo].[GAC_APP_TB_TICKETS_PAGOS]
            WHERE Fecha_transaccion >= '2025-01-01' AND Ticket IS NOT NULL;
            DECLARE @ColabMapping TABLE (NombreNormal varchar(200), ID_cas varchar(50));
            INSERT INTO @ColabMapping (NombreNormal, ID_cas)
            SELECT DISTINCT REPLACE(Nombre_FSM, '  ', ' '), CAS FROM [dbo].[GAC_APP_TB_COLABORADORES_CAS] WHERE Nombre_FSM IS NOT NULL;
            DECLARE @Tickets2026 TABLE (Ticket varchar(50), FechaVisita datetime, ID_cas varchar(50));
            INSERT INTO @Tickets2026 (Ticket, FechaVisita, ID_cas)
            SELECT s.Ticket, s.FechaVisita, colab.ID_cas
            FROM [SIATC].[Dashboard_FSM] s
            INNER JOIN @ColabMapping colab ON REPLACE(s.NombreTecnico + ' ' + s.ApellidoTecnico, '  ', ' ') = colab.NombreNormal
            WHERE YEAR(s.FechaVisita) = YEAR(GETDATE());
        `;

        if (casId) {
            sqlReq.input('casId', sql.VarChar(50), casId);
            statsQuery = `${setupQuery} SELECT CHOOSE(MONTH(T.FechaVisita), 'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SET', 'OCT', 'NOV', 'DIC') as name, SUM(ISNULL(P.ImporteValido, 0)) as value, COUNT(P.Ticket) as count FROM @Tickets2026 T LEFT JOIN @Pagos P ON T.Ticket = P.Ticket WHERE T.ID_cas = @casId GROUP BY MONTH(T.FechaVisita) ORDER BY MONTH(T.FechaVisita) ASC;`;
        } else if (zone) {
            sqlReq.input('zone', sql.NVarChar(sql.MAX), zone);
            statsQuery = `${setupQuery} SELECT c.ID_CAS as id_cas, c.Nombre_CAS as name, SUM(ISNULL(p.ImporteValido, 0)) as value, COUNT(p.Ticket) as count FROM [dbo].[GAC_APP_TB_CAS] c INNER JOIN @Tickets2026 T ON c.ID_CAS = T.ID_cas LEFT JOIN @Pagos p ON T.Ticket = p.Ticket WHERE c.Zona_atencion = @zone GROUP BY c.ID_CAS, c.Nombre_CAS ORDER BY value DESC;`;
        } else {
            statsQuery = `${setupQuery} SELECT UPPER(ISNULL(c.Zona_atencion, 'OTRO')) as name, SUM(ISNULL(p.ImporteValido, 0)) as value, COUNT(p.Ticket) as count FROM [dbo].[GAC_APP_TB_CAS] c INNER JOIN @Tickets2026 T ON c.ID_CAS = T.ID_cas LEFT JOIN @Pagos p ON T.Ticket = p.Ticket GROUP BY c.Zona_atencion ORDER BY value DESC;`;
        }
        
        const result = await sqlReq.query(statsQuery);
        res.json(result.recordset);
    } catch (err: any) {
        console.error('❌ ERROR CAS PERFORMANCE:', err.message);
        res.status(500).json({ error: safeError(err) });
    }
});

app.get('/api/dashboard/technician/:name/metrics', verifyToken, checkPermission('tec.dashboard.view'), async (req: Request, res: Response) => {
    try {
        const { name } = req.params;
        const db = await getDb();
        const sqlReq = db.request().input('techName', sql.NVarChar(sql.MAX), name);

        const techQuery = `
            SELECT MONTH(s.FechaVisita) as month, SUM(TRY_CAST(REPLACE(REPLACE(ISNULL(P.Importe, '0'), 'S/', ''), ',', '') as decimal(18,2))) as total FROM [SIATC].[Dashboard_FSM] s LEFT JOIN [dbo].[GAC_APP_TB_TICKETS_PAGOS] P ON P.Ticket = s.Ticket WHERE (s.NombreTecnico + ' ' + s.ApellidoTecnico) = @techName AND YEAR(s.FechaVisita) = YEAR(GETDATE()) GROUP BY MONTH(s.FechaVisita) ORDER BY month ASC;
            SELECT s.Asunto as label, COUNT(*) as count, SUM(TRY_CAST(REPLACE(REPLACE(ISNULL(P.Importe, '0'), 'S/', ''), ',', '') as decimal(18,2))) as total FROM [SIATC].[Dashboard_FSM] s LEFT JOIN [dbo].[GAC_APP_TB_TICKETS_PAGOS] P ON P.Ticket = s.Ticket WHERE (s.NombreTecnico + ' ' + s.ApellidoTecnico) = @techName AND YEAR(s.FechaVisita) = YEAR(GETDATE()) GROUP BY s.Asunto ORDER BY total DESC;
            SELECT TOP 10 D.VC_descripcion as label, COUNT(*) as count, SUM(CAST(D.DC_subtotal as decimal(18,2))) as total FROM [SIATC].[Dashboard_FSM] s INNER JOIN [SAP].[FSM_FLUJO_DETALLE] D ON s.Ticket = D.VC_pedidocliente WHERE (s.NombreTecnico + ' ' + s.ApellidoTecnico) = @techName AND YEAR(s.FechaVisita) = YEAR(GETDATE()) GROUP BY D.VC_descripcion ORDER BY total DESC;
        `;

        const result = await sqlReq.query(techQuery);
        const recordsets = result.recordsets as any;
        res.json({ monthly_trend: recordsets[0], services: recordsets[1], materials: recordsets[2] });
    } catch (err: any) {
        res.status(500).json({ error: safeError(err) });
    }
});

// --- INFORME TÉCNICO (C4C OData) ---
app.get('/api/tec/tickets/:ticketId/informe', verifyToken, checkPermission('tec.tickets.view'), async (req: Request, res: Response) => {
    try {
        const { ticketId } = req.params;
        const safeId = String(ticketId).replace(/[^a-zA-Z0-9_-]/g, '');
        if (!safeId) return res.status(400).json({ error: 'Ticket inválido' });

        if (!C4C_BASE_URL || !process.env.C4C_USER || !process.env.C4C_PASSWORD) {
            return res.status(503).json({ error: 'Integración C4C no configurada en el servidor.' });
        }

        // 1. Buscar el Service Request en C4C
        const searchUrl = `${C4C_BASE_URL}/ServiceRequestCollection?$filter=ID eq '${safeId}'&$select=ID,ObjectID`;
        const searchResp = await axios.get(searchUrl, {
            headers: { 'Authorization': `Basic ${C4C_AUTH}` },
            timeout: 15000
        });

        const ticket = searchResp.data?.d?.results?.[0];
        if (!ticket) return res.status(404).json({ error: `Ticket ${safeId} no encontrado en C4C` });

        // 2. Buscar adjuntos del ticket
        let attachments = ticket.ServiceRequestAttachmentFolder?.results;
        if (!attachments || attachments.length === 0) {
            const attUrl = `${C4C_BASE_URL}/ServiceRequestCollection('${ticket.ObjectID}')/ServiceRequestAttachmentFolder`;
            try {
                const attResp = await axios.get(attUrl, {
                    headers: { 'Authorization': `Basic ${C4C_AUTH}` },
                    timeout: 15000
                });
                attachments = attResp.data?.d?.results;
            } catch {
                attachments = [];
            }
        }

        if (!attachments || attachments.length === 0) {
            return res.status(404).json({ error: `El ticket ${safeId} no tiene adjuntos en C4C.` });
        }

        // 3. Buscar el PDF del informe (prioriza nombre "informe" o "report")
        type Attachment = { MimeType: string; Name: string; ObjectID: string };
        let report: Attachment | undefined = attachments.find((a: Attachment) =>
            a.MimeType === 'application/pdf' &&
            (a.Name.toLowerCase().includes('informe') || a.Name.toLowerCase().includes('report'))
        );
        if (!report) {
            report = attachments.find((a: Attachment) => a.MimeType === 'application/pdf');
        }
        if (!report) {
            return res.status(404).json({ error: `No se encontró un PDF de informe para el ticket ${safeId}` });
        }

        // 4. Descargar el binario del PDF
        const downloadUrl = `${C4C_BASE_URL}/ServiceRequestAttachmentFolderCollection('${report.ObjectID}')/Binary/$value`;
        const pdfResp = await axios.get(downloadUrl, {
            headers: { 'Authorization': `Basic ${C4C_AUTH}` },
            responseType: 'arraybuffer',
            timeout: 30000
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${report.Name}"`);
        res.send(pdfResp.data);

    } catch (err: any) {
        const status = err?.response?.status || 500;
        const detail = err?.response?.data?.error?.message?.value || err.message || 'Error desconocido';
        console.error(`[C4C Informe] Error ticket ${sanitizeLog(req.params.ticketId)}:`, detail);
        res.status(status).json({ error: 'No se pudo obtener el informe desde C4C', details: detail });
    }
});

// --- PAGOS MULTI-TICKET ---

// Buscar tickets en SAP/FSM por número o nombre de cliente
app.get('/api/sap/tickets/search', verifyToken, checkPermission('tec.payments.view'), async (req: Request, res: Response) => {
    try {
        const q = String(req.query.q || '').trim();
        if (q.length < 3) return res.json([]);
        const db = await getDb();
        const result = await db.request()
            .input('q', sql.NVarChar(sql.MAX), `%${q}%`)
            .input('qExact', sql.NVarChar(sql.MAX), q)
            .query(`
                SELECT TOP 20
                    F.Ticket as id,
                    ISNULL(F.NombreCliente, 'Sin cliente') as cliente,
                    F.Distrito as distrito,
                    ISNULL(F.Asunto, '') as servicio,
                    TRY_CAST(
                        SUM((ISNULL(V.DE_neto,0) + ISNULL(V.DE_igv,0)) *
                            CASE WHEN V.VC_documento_pago_clase IN ('S2','ZNCV','ZNCD') THEN -1
                                 WHEN V.VC_documento_pago_clase LIKE 'ZTG%' OR V.VC_anulacion_status = 'X' THEN 0
                                 ELSE 1 END)
                    AS DECIMAL(18,2)) as total
                FROM [SIATC].[Dashboard_FSM] F
                LEFT JOIN [SAP].[SD_VENTAS] V
                    ON LTRIM(RTRIM(V.VC_oden_compra_numero)) = F.Ticket
                WHERE F.Ticket LIKE @q OR F.NombreCliente LIKE @q
                GROUP BY F.Ticket, F.NombreCliente, F.Distrito, F.Asunto
                ORDER BY CASE WHEN F.Ticket = @qExact THEN 0 ELSE 1 END, F.Ticket DESC
            `);
        res.json(result.recordset);
    } catch (err: any) {
        console.error('Error en /api/sap/tickets/search:', err);
        res.status(500).json({ error: safeError(err) });
    }
});

// Detalle de ticket para auto-completar importe y folio
app.get('/api/tickets-pagos/:ticketId/details', verifyToken, checkPermission('tec.payments.view'), async (req: Request, res: Response) => {
    try {
        const { ticketId } = req.params;
        const safeTicketId = String(ticketId).replace(/[^a-zA-Z0-9_-]/g, '');
        if (!safeTicketId) return res.status(400).json({ error: 'Ticket inválido' });
        const db = await getDb();
        const result = await db.request()
            .input('ticket', sql.NVarChar(sql.MAX), safeTicketId)
            .query(`
                SELECT TOP 1
                    TRY_CAST(
                        SUM((ISNULL(V.DE_neto,0) + ISNULL(V.DE_igv,0)) *
                            CASE WHEN V.VC_documento_pago_clase IN ('S2','ZNCV','ZNCD') THEN -1
                                 WHEN V.VC_documento_pago_clase LIKE 'ZTG%' OR V.VC_anulacion_status = 'X' THEN 0
                                 ELSE 1 END)
                    AS DECIMAL(18,2)) as Total_documento,
                    MAX(V.VC_referencia) as Folio
                FROM [SAP].[SD_VENTAS] V
                WHERE LTRIM(RTRIM(V.VC_oden_compra_numero)) = @ticket
                    OR (TRY_CAST(LTRIM(RTRIM(V.VC_oden_compra_numero)) AS BIGINT) = TRY_CAST(@ticket AS BIGINT)
                        AND TRY_CAST(@ticket AS BIGINT) IS NOT NULL)
            `);
        res.json({ sap: { header: result.recordset[0] || null } });
    } catch (err: any) {
        console.error('Error en /api/tickets-pagos/:ticketId/details:', err);
        res.status(500).json({ error: safeError(err) });
    }
});

// Listar pagos con paginación y búsqueda (usa cache enriquecida)
app.get('/api/tickets-pagos', verifyToken, checkPermission('tec.payments.view'), async (req: Request, res: Response) => {
    try {
        const page  = Math.max(1, parseInt(String(req.query.page  || '1')));
        const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'))));
        const search = String(req.query.search || '').trim();
        const offset = (page - 1) * limit;
        const db = await getDb();
        const sqlReq = db.request()
            .input('limit',  sql.Int, limit)
            .input('offset', sql.Int, offset)
            .input('search', sql.NVarChar(sql.MAX), `%${search}%`);

        const currentUser = (req as any).user; // eslint-disable-line @typescript-eslint/no-explicit-any
        const conditions: string[] = [];
        if (search) conditions.push(`(C.Ticket_Original LIKE @search OR C.Clientes LIKE @search OR C.CodigoAutorizacion LIKE @search OR C.Voucher LIKE @search)`);

        // RLS por empresa CAS (usuarios externos)
        if (currentUser?.casId) {
            conditions.push('C.ID_cas = @casId');
            sqlReq.input('casId', sql.VarChar(50), currentUser.casId);
        }

        // RLS por técnico: solo ve sus propios pagos salvo que tenga tec.payments.view.all
        const userPerms: string[] = currentUser?.permissions || currentUser?.perms || [];
        const isAdmin = (currentUser?.role || '').trim().toLowerCase() === 'administrador';
        const hasViewAll = isAdmin || userPerms.includes('tec.payments.view.all');
        if (!hasViewAll) {
            conditions.push(`C.Tecnicos LIKE @techName`);
            sqlReq.input('techName', sql.NVarChar(sql.MAX), `%${currentUser.full_name}%`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const data = await sqlReq.query(`
            SELECT
                C.ID_transaccion, C.Fecha_creacion, C.Fecha_transaccion,
                C.Ticket_Original as Ticket, C.Estado, C.Importe_Texto as Importe,
                C.Canal, C.Voucher, C.Lote, C.Codigo_Izipay, C.CodigoAutorizacion,
                C.Folio, C.Clientes as Cliente, C.Tecnicos as Tecnico,
                C.Distrito, C.Direccion, C.FechaVisita, C.Observacion
            FROM [dbo].[GAC_PAGOS_CACHE] C
            ${whereClause}
            ORDER BY C.Fecha_creacion DESC
            OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;

            SELECT COUNT(*) as total FROM [dbo].[GAC_PAGOS_CACHE] C ${whereClause};
        `);

        const recordsets = data.recordsets as any;
        res.json({ data: recordsets[0], total: recordsets[1][0]?.total ?? 0 });
    } catch (err: any) {
        console.error('Error en GET /api/tickets-pagos:', err);
        res.status(500).json({ error: safeError(err) });
    }
});

// Crear pago (soporta uno o varios tickets en una transacción)
app.post('/api/tickets-pagos', verifyToken, checkPermission('tec.payments.register'), async (req: Request, res: Response) => {
    try {
        const { ticket, fecha_transaccion, voucher, lote, codigo_izipay, codigo_autorizacion, folio, importe, canal, observacion } = req.body;
        if (!ticket || String(ticket).trim() === '') return res.status(400).json({ error: 'Debe incluir al menos un ticket' });
        if (!importe) return res.status(400).json({ error: 'Importe requerido' });

        const tickets = String(ticket).split(',').map((t: string) => t.trim()).filter(Boolean);
        if (tickets.length === 0) return res.status(400).json({ error: 'Ticket inválido' });
        const ticketStr = tickets.join(', ');

        const db = await getDb();
        const idTransaccion = uuidv4().toUpperCase();
        await db.request()
            .input('id',       sql.VarChar(50), idTransaccion)
            .input('ticket',   sql.NVarChar(sql.MAX),    ticketStr)
            .input('f_trans',  sql.DateTime,    fecha_transaccion ? new Date(fecha_transaccion) : new Date())
            .input('vouch',    sql.NVarChar(sql.MAX),    voucher || '')
            .input('lote',     sql.NVarChar(sql.MAX),    lote || '')
            .input('izipay',   sql.NVarChar(sql.MAX),    codigo_izipay || '')
            .input('imp',      sql.NVarChar(sql.MAX),    String(importe))
            .input('canal',    sql.NVarChar(sql.MAX),    String(canal || 'POS').toUpperCase())
            .input('obs',      sql.NVarChar(sql.MAX),    observacion || '')
            .input('folio',    sql.NVarChar(sql.MAX),    folio || '')
            .input('auth',     sql.NVarChar(sql.MAX),    codigo_autorizacion || '')
            .query(`
                INSERT INTO [dbo].[GAC_APP_TB_TICKETS_PAGOS]
                    (ID_transaccion, Fecha_creacion, Ticket, Fecha_transaccion,
                     Voucher, Lote, Codigo_Izipay, Importe, Estado, Canal,
                     Observacion, CodigoAutorizacion, Folio)
                VALUES
                    (@id, GETDATE(), @ticket, @f_trans,
                     @vouch, @lote, @izipay, @imp, 'LIQUIDADO', @canal,
                     @obs, @auth, @folio)
            `);
        await logAudit(req, 'TEC:CREATE_PAGO_MULTI', 'TicketPago', idTransaccion, { tickets, canal, importe });
        setImmediate(() => syncPaymentCache(idTransaccion));
        res.status(201).json({ message: 'Pago registrado', id: idTransaccion });
    } catch (err: any) {
        console.error('Error en POST /api/tickets-pagos:', err);
        res.status(500).json({ error: safeError(err) });
    }
});

app.get('/api/tickets-pagos/:id/pdf', verifyToken, checkPermission('tec.payments.view'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const db = await getDb();
        const payment = await db.request()
            .input('id', sql.VarChar(50), id)
            .query("SELECT Ticket FROM [dbo].[GAC_APP_TB_TICKETS_PAGOS] WHERE ID_transaccion = @id");

        if (payment.recordset.length === 0) return res.status(404).json({ error: 'Pago no encontrado' });
        
        const ticketNum = payment.recordset[0].Ticket;
        if (!ticketNum) return res.status(400).json({ error: 'El pago no tiene número de ticket asociado' });
        
        // [SECURITY BE-C5] Sanitizar ticketNum para prevenir path traversal
        const safeTicketNum = path.basename(String(ticketNum)).replace(/[^a-zA-Z0-9_-]/g, '');
        if (!safeTicketNum) return res.status(400).json({ error: 'Número de ticket inválido' });

        // Buscar archivo usando fs.promises (no-blocking) con validación de path
        const files = await fs.promises.readdir(APPSHEET_PDF_PATH);
        const targetFile = files.find(f => f.includes(safeTicketNum) && f.endsWith('.pdf'));

        if (!targetFile) {
            return res.status(404).json({ error: `No se encontró cotización PDF para el ticket ${safeTicketNum}` });
        }

        // Verificar que el path resuelto esté dentro del directorio permitido
        const filePath = path.join(APPSHEET_PDF_PATH, targetFile);
        const resolvedPath = path.resolve(filePath);
        const resolvedBase = path.resolve(APPSHEET_PDF_PATH);
        if (!resolvedPath.startsWith(resolvedBase + path.sep)) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        res.download(filePath, targetFile);
    } catch (err: any) {
        console.error('Error in GET /api/tickets-pagos/:id/pdf:', err);
        res.status(500).json({ error: safeError(err) });
    }
});

app.get('/api/tec/tickets/calendar-summary', verifyToken, checkPermission('tec.tickets.view'), async (req: Request, res: Response) => {
    try {
        const { username, role } = (req as any).user;
        const isAdmin = role?.toLowerCase() === 'administrador';
        const month = req.query.month as string;
        if (!month || !/^\d{4}-\d{2}$/.test(month)) {
            return res.status(400).json({ error: 'Parámetro month requerido en formato YYYY-MM' });
        }
        const db = await getDb();
        const sqlReq = db.request().input('month', sql.VarChar(255), month);
        let query = `SELECT CONVERT(VARCHAR(10), FechaVisita, 23) as date, COUNT(*) as count FROM [APPGAC].[ServiciosViewSQL] WHERE FORMAT(FechaVisita, 'yyyy-MM') = @month`;
        if (!isAdmin) {
            query += ' AND CodigoTecnico = @techCode';
            sqlReq.input('techCode', sql.VarChar(255), username);
        } else if (req.query.techCode) {
            query += ' AND CodigoTecnico = @techCode';
            sqlReq.input('techCode', sql.VarChar(255), req.query.techCode as string);
        }
        query += ' GROUP BY CONVERT(VARCHAR(10), FechaVisita, 23)';
        const result = await sqlReq.query(query);
        const summary: Record<string, number> = {};
        for (const row of result.recordset) { summary[row.date] = row.count; }
        res.json(summary);
    } catch (err: any) {
        console.error('❌ Error in /api/tec/tickets/calendar-summary:', err.message);
        res.status(500).json({ error: safeError(err) });
    }
});

app.get('/api/tec/tickets', verifyToken, checkPermission('tec.tickets.view'), async (req: Request, res: Response) => {
    try {
        const { username, role } = (req as any).user;
        const isAdmin = role?.toLowerCase() === 'administrador';
        const dateStr = req.query.date as string;
        
        const db = await getDb();
        const sqlReq = db.request();
        
        let query = `
            SELECT S.Ticket as id, S.LlamadaFSM, S.Asunto, S.Estado, S.FechaVisita, S.FechaUltimaModificacion, S.IdServicio, S.Servicio, S.IdCliente, S.CodigoExternoCliente, S.NombreCliente as Cliente, S.Email, S.Celular1, S.Celular2, S.Telefono1, S.Calle, S.NumeroCalle, S.Distrito, S.Ciudad, S.Pais, S.CodigoPostal, S.Referencia, S.IdEquipo, S.CodigoExternoEquipo, S.NombreEquipo, S.ComentarioProgramador, S.IdCAS, S.CAS, S.CodigoTecnico, S.NombreTecnico, S.ApellidoTecnico, S.VisitaRealizada, S.TrabajoRealizado, S.SolicitaNuevaVisita, S.MotivoNuevaVisita, S.CodMotivoIncidente, S.FechaModificacionIT, S.ComentarioTecnico, S.CheckOut, S.Latitud, S.Longitud, RH.Rango_horario as RangoHorario, RH.Orden_atención as OrdenAtencion, RH.Comentario as ComentarioHorario,
            CASE WHEN EXISTS (SELECT 1 FROM [dbo].[GAC_APP_TB_TICKETS_PAGOS] P WHERE EXISTS (SELECT 1 FROM STRING_SPLIT(P.Ticket, ',') WHERE LTRIM(RTRIM(value)) = CAST(S.Ticket AS NVARCHAR(50)))) THEN 1 ELSE 0 END as tienePago
            FROM [APPGAC].[ServiciosViewSQL] S
            LEFT JOIN [dbo].[GAC_APP_TB_RANGO_HORARIO] RH ON S.Ticket = RH.ID_Ticket
            WHERE 1=1
        `;

        if (dateStr) {
            query += " AND CONVERT(DATE, S.FechaVisita) = CONVERT(DATE, @date)";
            sqlReq.input('date', sql.VarChar(255), dateStr);
        } else {
            query += " AND CONVERT(DATE, S.FechaVisita) = CONVERT(DATE, GETDATE())";
        }

        if (isAdmin) {
            const techCode = req.query.techCode as string;
            if (techCode) {
                query += " AND S.CodigoTecnico = @techCode";
                sqlReq.input('techCode', sql.VarChar(255), techCode);
            }
        } else {
            query += " AND S.CodigoTecnico = @techCode";
            sqlReq.input('techCode', sql.VarChar(255), username);
        }

        query += " ORDER BY S.FechaVisita ASC";

        const result = await sqlReq.query(query);
        res.json(result.recordset);
    } catch (err: any) {
        console.error('❌ Error in /api/tec/tickets:', err.message);
        res.status(500).json({ error: safeError(err) });
    }
});

app.post('/api/tec/tickets/rango-horario', verifyToken, checkPermission('tec.tickets.view'), async (req: Request, res: Response) => {
    try {
        const { ticketId, rangoHorario, ordenAtencion, comentario, applyToAllClientTickets } = req.body;
        const { username, role } = (req as any).user;
        const isAdmin = role?.toLowerCase() === 'administrador';

        if (!ticketId) return res.status(400).json({ error: 'ID de ticket es requerido' });

        const db = await getDb();
        const ticketResult = await db.request().input('ticketId', sql.VarChar(255), ticketId).query(`SELECT FechaVisita, IdCliente, CodigoTecnico FROM [APPGAC].[ServiciosViewSQL] WHERE Ticket = @ticketId`);

        if (ticketResult.recordset.length === 0) return res.status(404).json({ error: 'Ticket no encontrado' });

        const ticketData = ticketResult.recordset[0];
        if (!isAdmin) {
            if (ticketData.CodigoTecnico !== username) return res.status(403).json({ error: 'No tienes permiso' });
            const limitResult = await db.request().query("SELECT Valor FROM [dbo].[GAC_APP_TB_CONFIG] WHERE Clave = 'HORA_MAXIMA_RANGO_HORARIO'");
            const limitStr = limitResult.recordset[0]?.Valor || '09:30';
            const now = new Date();
            const localDateStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
            const visitDateStr = new Date(ticketData.FechaVisita).toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
            if (visitDateStr < localDateStr) return res.status(400).json({ error: 'No se pueden modificar fechas pasadas' });
            if (visitDateStr === localDateStr) {
                const localTimeStr = now.toLocaleTimeString('en-US', { timeZone: 'America/Lima', hour12: false });
                const [currHour, currMin] = localTimeStr.split(':').map(Number);
                const [limitHour, limitMin] = limitStr.split(':').map(Number);
                if ((currHour > limitHour) || (currHour === limitHour && currMin >= limitMin)) return res.status(400).json({ error: 'Hora limite excedida' });
            }
        }

        let ticketsToUpdate = [ticketId];
        if (applyToAllClientTickets && ticketData.IdCliente) {
            const bulkResult = await db.request().input('idCliente', sql.VarChar(255), ticketData.IdCliente).input('fechaVisita', sql.DateTime, ticketData.FechaVisita).input('codeTec', sql.VarChar(255), ticketData.CodigoTecnico).query(`SELECT Ticket FROM [APPGAC].[ServiciosViewSQL] WHERE IdCliente = @idCliente AND CONVERT(DATE, FechaVisita) = CONVERT(DATE, @fechaVisita) AND CodigoTecnico = @codeTec`);
            ticketsToUpdate = [...new Set([ticketId, ...bulkResult.recordset.map((r: any) => r.Ticket)])];
        }

        for (const tId of ticketsToUpdate) {
            await db.request().input('tId', sql.VarChar(255), tId).input('rango', sql.VarChar(255), rangoHorario || null).input('orden', sql.VarChar(255), ordenAtencion || null).input('coment', sql.VarChar(255), comentario || null).input('user', sql.VarChar(255), username).input('idRango', sql.VarChar(255), uuidv4().substring(0, 8)).query(`MERGE [dbo].[GAC_APP_TB_RANGO_HORARIO] AS target USING (SELECT @tId AS ID_Ticket) AS source ON (target.ID_Ticket = source.ID_Ticket) WHEN MATCHED THEN UPDATE SET Rango_horario = @rango, Orden_atención = @orden, Comentario = @coment, Creado_el = GETDATE(), Creado_por = @user WHEN NOT MATCHED THEN INSERT (ID_Rango_horario, Rango_horario, Orden_atención, Comentario, Creado_el, Creado_por, ID_Ticket) VALUES (@idRango, @rango, @orden, @coment, GETDATE(), @user, @tId);`);
        }
        await logAudit(req, 'TEC:ASSIGN_RANGO_HORARIO', 'TicketRangoHorario', ticketId, { tickets: ticketsToUpdate });
        res.json({ message: 'Rango horario asignado correctamente', updatedTickets: ticketsToUpdate });
    } catch (err: any) {
        console.error('❌ Error in POST /api/tec/tickets/rango-horario:', err.message);
        res.status(500).json({ error: safeError(err) });
    }
});

app.get('/api/config/rango-horario-limit', verifyToken, async (_req: Request, res: Response) => {
    try {
        const cached = cacheGet('rango-horario-limit');
        if (cached) return res.json(cached);
        const db = await getDb();
        const result = await db.request().query("SELECT Valor, Descripcion FROM [dbo].[GAC_APP_TB_CONFIG] WHERE Clave = 'HORA_MAXIMA_RANGO_HORARIO'");
        const data = { limit: result.recordset[0]?.Valor || '09:30', description: result.recordset[0]?.Descripcion || '' };
        cacheSet('rango-horario-limit', data, 5 * 60 * 1000);
        res.json(data);
    } catch (err: any) { res.status(500).json({ error: safeError(err) }); }
});

app.post('/api/config/rango-horario-limit', verifyToken, checkPermission('tec.config.users'), async (req: Request, res: Response) => {
    try {
        const { limit } = req.body;
        if (!limit || !/^\d{2}:\d{2}$/.test(limit)) {
            return res.status(400).json({ error: 'Formato de hora inválido. Use HH:mm (ej: 09:30)' });
        }
        const { username } = (req as any).user;
        const db = await getDb();
        await db.request().input('limit', sql.VarChar(255), limit).input('user', sql.VarChar(255), username).query(`UPDATE [dbo].[GAC_APP_TB_CONFIG] SET Valor = @limit, Actualizado_el = GETDATE(), Actualizado_por = @user WHERE Clave = 'HORA_MAXIMA_RANGO_HORARIO'`);
        cacheInvalidate('rango-horario-limit');
        await logAudit(req, 'TEC:UPDATE_CONFIG_LIMIT', 'SystemConfig', 'HORA_MAXIMA_RANGO_HORARIO', { limit });
        res.json({ message: 'Configuración actualizada' });
    } catch (err: any) { res.status(500).json({ error: safeError(err) }); }
});

app.get('/api/tec/tickets/:ticketId/pagos', verifyToken, checkPermission('tec.tickets.view'), async (req: Request, res: Response) => {
    try {
        const { ticketId } = req.params;
        const { username, role } = (req as any).user;
        const db = await getDb();
        if (role?.toLowerCase() !== 'administrador') {
            const assignmentResult = await db.request().input('ticketId', sql.VarChar(255), ticketId).input('techCode', sql.VarChar(255), username).query(`SELECT 1 FROM [APPGAC].[ServiciosViewSQL] WHERE Ticket = @ticketId AND CodigoTecnico = @techCode`);
            if (assignmentResult.recordset.length === 0) return res.status(403).json({ error: 'No tienes permiso' });
        }
        const paymentsResult = await db.request().input('ticketId', sql.VarChar(255), ticketId).query(`SELECT ID_transaccion, Fecha_creacion, Ticket, Fecha_transaccion, Voucher, Lote, Codigo_Izipay, Importe, Estado, Canal, Observacion, CodigoAutorizacion, Folio, Adjunto FROM [dbo].[GAC_APP_TB_TICKETS_PAGOS] WHERE EXISTS (SELECT 1 FROM STRING_SPLIT(Ticket, ',') WHERE LTRIM(RTRIM(value)) = @ticketId) ORDER BY Fecha_creacion DESC`);
        res.json(paymentsResult.recordset);
    } catch (err: any) { res.status(500).json({ error: safeError(err) }); }
});

app.post('/api/tec/tickets/:ticketId/pago', verifyToken, checkPermission('tec.tickets.view'), upload.single('adjunto'), async (req: Request, res: Response) => {
    const { ticketId } = req.params;
    const { fecha_transaccion, voucher, lote, codigo_izipay, importe, canal, observacion, folio, codigo_autorizacion } = req.body;
    const { username, role } = (req as any).user;
    try {
        const db = await getDb();
        if (role?.toLowerCase() !== 'administrador') {
            const assignmentResult = await db.request().input('ticketId', sql.VarChar(255), ticketId).input('techCode', sql.VarChar(255), username).query(`SELECT 1 FROM [APPGAC].[ServiciosViewSQL] WHERE Ticket = @ticketId AND CodigoTecnico = @techCode`);
            if (assignmentResult.recordset.length === 0) { if (req.file) fs.unlinkSync(req.file.path); return res.status(403).json({ error: 'No tienes permiso' }); }
        }
        let blobUrl = '';
        if (req.file) {
            // [SECURITY] Validar magic bytes reales del archivo (previene spoofing de MIME)
            const isValid = await validateFileMagicBytes(req.file.path, req.file.mimetype);
            if (!isValid) {
                fs.unlinkSync(req.file.path);
                return res.status(400).json({ error: 'El contenido del archivo no coincide con su tipo declarado.' });
            }
            // [SECURITY] Sanitizar nombre del blob igual que en disco para evitar caracteres especiales
            const safeBlobName = path.basename(req.file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
            const blobName = `${Date.now()}-${safeBlobName}`;
            const blockBlobClient = containerClient.getBlockBlobClient(blobName);
            const fileStream = fs.createReadStream(req.file.path);
            await blockBlobClient.uploadStream(fileStream, 4 * 1024 * 1024, 20, { blobHTTPHeaders: { blobContentType: req.file.mimetype } });
            fs.unlinkSync(req.file.path);
            blobUrl = blockBlobClient.url;
        } else if (String(canal || '').toUpperCase() !== 'EFECTIVO') { return res.status(400).json({ error: 'Adjunto obligatorio' }); }

        const idTransaccion = uuidv4().toUpperCase();
        await db.request()
            .input('id', sql.VarChar(50), idTransaccion)
            .input('ticket', sql.NVarChar(sql.MAX), ticketId)
            .input('f_trans', sql.DateTime, fecha_transaccion ? new Date(fecha_transaccion) : new Date())
            .input('vouch', sql.NVarChar(sql.MAX), voucher || '')
            .input('lote', sql.NVarChar(sql.MAX), lote || '')
            .input('izipay', sql.NVarChar(sql.MAX), codigo_izipay || '')
            .input('imp', sql.NVarChar(sql.MAX), importe || '0')
            .input('canal', sql.NVarChar(sql.MAX), String(canal || 'POS').toUpperCase())
            .input('obs', sql.NVarChar(sql.MAX), observacion || '')
            .input('est', sql.NVarChar(sql.MAX), 'LIQUIDADO')
            .input('folio', sql.NVarChar(sql.MAX), folio || '')
            .input('auth', sql.NVarChar(sql.MAX), codigo_autorizacion || '')
            .input('adjunto', sql.NVarChar(sql.MAX), blobUrl || null)
            .query(`INSERT INTO [dbo].[GAC_APP_TB_TICKETS_PAGOS] (ID_transaccion, Fecha_creacion, Ticket, Fecha_transaccion, Voucher, Lote, Codigo_Izipay, Importe, Estado, Canal, Observacion, CodigoAutorizacion, Folio, Adjunto) VALUES (@id, GETDATE(), @ticket, @f_trans, @vouch, @lote, @izipay, @imp, @est, @canal, @obs, @auth, @folio, @adjunto)`);
        setImmediate(() => syncPaymentCache(idTransaccion));
        res.status(201).json({ message: 'Pago registrado', id: idTransaccion });
    } catch (err: any) { if (req.file) fs.unlinkSync(req.file.path); res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/tec/today-tickets', verifyToken, checkPermission('tec.tickets.view'), async (req: Request, res: Response) => {
    try {
        const { full_name, role } = (req as any).user;
        const db = await getDb();
        const sqlReq = db.request();
        let query = `SELECT Ticket as id, Estado, FechaVisita, NombreCliente as Cliente, Distrito, (ISNULL(Calle, '') + ' ' + ISNULL(NumeroCalle, '')) as Direccion, BloqueHorario, Asunto, Celular1 as Contacto FROM [SIATC].[Dashboard_FSM] WHERE CONVERT(DATE, FechaVisita) = CONVERT(DATE, GETDATE())`;
        if (role?.toLowerCase() !== 'administrador') { query += " AND (NombreTecnico + ' ' + ApellidoTecnico) = @userFullName"; sqlReq.input('userFullName', sql.NVarChar(sql.MAX), full_name); }
        const result = await sqlReq.query(query);
        res.json(result.recordset);
    } catch (err: any) { res.status(500).json({ error: safeError(err) }); }
});

app.get('/api/tec/schedule', verifyToken, checkPermission('tec.tickets.view'), async (req: Request, res: Response) => {
    try {
        const { full_name } = (req as any).user;
        const db = await getDb();
        const result = await db.request().input('user', sql.NVarChar(sql.MAX), full_name).query(`SELECT ID_empleado_calendario_labores as id, Fecha_Labor as date, Labor as title, 'Taller/Reunión' as type FROM [dbo].[GAC_APP_TB_EMPLEADOS_CALENDARIO_LABORES] WHERE Empleado = @user AND Fecha_Labor >= CONVERT(DATE, GETDATE()) ORDER BY Fecha_Labor ASC`);
        res.json(result.recordset);
    } catch (err: any) { res.status(500).json({ error: safeError(err) }); }
});

app.post('/api/tec/sales', verifyToken, checkPermission('tec.tickets.view'), async (req: Request, res: Response) => {
    try {
        const { ticket, pedido, observacion, comentarioTecnico } = req.body;
        const { full_name } = (req as any).user;
        const db = await getDb();
        const idVenta = uuidv4().substring(0, 8).toUpperCase();
        await db.request()
            .input('id', sql.VarChar(50), idVenta)
            .input('ticket', sql.NVarChar(sql.MAX), ticket)
            .input('pedido', sql.NVarChar(sql.MAX), pedido)
            .input('obs', sql.NVarChar(sql.MAX), observacion)
            .input('coment', sql.NVarChar(sql.MAX), comentarioTecnico)
            .input('user', sql.NVarChar(sql.MAX), full_name)
            .query(`INSERT INTO [dbo].[GAC_APP_TB_VENTAS] (ID_Venta, Ticket, Nro_pedido_venta, Observacion, Comentario_tecnico, Venta_registrada_por, Venta_registrada_el, Venta_realizada) VALUES (@id, @ticket, @pedido, @obs, @coment, @user, GETDATE(), 'SI')`);
        res.json({ message: 'Oportunidad de venta registrada', id: idVenta });
    } catch (err: any) { res.status(500).json({ error: safeError(err) }); }
});

app.patch('/api/tec/time-range', verifyToken, checkPermission('tec.tickets.view'), async (req: Request, res: Response) => {
    try {
        const { ticket, bloqueHorario } = req.body;
        if (!ticket || !bloqueHorario) {
            return res.status(400).json({ error: 'Parámetros requeridos: ticket, bloqueHorario' });
        }
        const db = await getDb();
        await db.request()
            .input('ticket', sql.NVarChar(sql.MAX), ticket)
            .input('bloque', sql.NVarChar(sql.MAX), bloqueHorario)
            .query(`UPDATE [dbo].[GAC_APP_TB_RANGO_HORARIO] SET Bloque_horario = @bloque WHERE ID_ticket = @ticket`);
        res.json({ message: 'Rango horario actualizado' });
    } catch (err: any) {
        console.error('[PATCH /api/tec/time-range]', err);
        res.status(500).json({ error: safeError(err) });
    }
});

// ─── USUARIOS ─────────────────────────────────────────────────────────────────

app.get('/api/users', verifyToken, checkPermission('tec.config.users'), async (req: Request, res: Response) => {
    try {
        const db = await getDb();
        // SELECT u.* avoids referencing columns that may not exist (e.g. RequiresPasswordChange, CreatedAt)
        // JS-side mapping handles undefined fields gracefully, same pattern as the login endpoint.
        const result = await db.request().query(`
            SELECT u.*, r.Name as RoleName
            FROM EBM.Users u
            LEFT JOIN EBM.Roles r ON u.RoleId = r.Id
            ORDER BY u.FullName
        `);
        const users = await Promise.all(result.recordset.map(async (u: any) => {
            const perms = u.RoleId
                ? (await db.request().input('rid', sql.NVarChar(sql.MAX), String(u.RoleId))
                    .query(`SELECT Permission FROM EBM.RolePermissions WHERE RoleId=@rid`))
                    .recordset.map((p: any) => p.Permission)
                : [];
            return {
                id: String(u.Id),
                username: u.Username,
                full_name: u.FullName,
                email: u.Email ?? '',
                role_id: u.RoleId ? String(u.RoleId) : '',
                role_name: u.RoleName ?? '',
                management_id: '',
                theme: 'light',
                is_active: u.IsActive === true || u.IsActive === 1,
                apps: u.Apps || 'TEC',
                requires_password_change: u.RequiresPasswordChange === true || u.RequiresPasswordChange === 1,
                created_at: u.CreatedAt ? new Date(u.CreatedAt).toISOString() : '',
                permissions: perms,
            };
        }));
        res.json(users);
    } catch (err: any) {
        console.error('[GET /api/users]', err);
        res.status(500).json({ error: safeError(err) });
    }
});

app.post('/api/users', verifyToken, checkPermission('tec.config.users'), async (req: Request, res: Response) => {
    try {
        const parsed = createUserSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
        const { username, full_name, email, password_hash: rawPassword, role_id, apps, is_active = true } = parsed.data;
        const db = await getDb();
        const dup = await db.request().input('u', sql.NVarChar(sql.MAX), username).input('e', sql.NVarChar(sql.MAX), email)
            .query(`SELECT Id FROM EBM.Users WHERE Username=@u OR Email=@e`);
        if (dup.recordset.length > 0) return res.status(409).json({ error: 'El usuario o email ya existe' });
        const hash = await bcrypt.hash(rawPassword, 12);
        const result = await db.request()
            .input('u', sql.NVarChar(sql.MAX), username).input('fn', sql.NVarChar(sql.MAX), full_name)
            .input('e', sql.NVarChar(sql.MAX), email).input('h', sql.NVarChar(sql.MAX), hash)
            .input('rid', sql.Int, Number(role_id)).input('apps', sql.NVarChar(sql.MAX), apps || APP_IDENTIFIER)
            .input('active', sql.Bit, is_active ? 1 : 0)
            .query(`INSERT INTO EBM.Users (Username, FullName, Email, PasswordHash, RoleId, Apps, IsActive)
                    OUTPUT INSERTED.Id VALUES (@u, @fn, @e, @h, @rid, @apps, @active)`);
        const newId = result.recordset[0].Id;
        await logAudit(req, 'CREATE_USER', 'User', String(newId), { username, full_name, email, role_id });
        res.status(201).json({ id: String(newId), username, full_name, email, role_id: String(role_id), apps: apps || APP_IDENTIFIER, is_active });
    } catch (err: any) {
        console.error('[POST /api/users]', err);
        res.status(500).json({ error: safeError(err) });
    }
});

app.put('/api/users/:id', verifyToken, checkPermission('tec.config.users'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const parsed = updateUserSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
        const { full_name, email, role_id, apps, is_active, password_hash: rawPassword } = parsed.data;
        const db = await getDb();
        const sqlReq = db.request()
            .input('id', sql.NVarChar(sql.MAX), String(id)).input('fn', sql.NVarChar(sql.MAX), full_name)
            .input('e', sql.NVarChar(sql.MAX), email).input('rid', sql.NVarChar(sql.MAX), String(role_id))
            .input('apps', sql.NVarChar(sql.MAX), apps || APP_IDENTIFIER).input('active', sql.Bit, is_active ? 1 : 0);
        if (rawPassword) {
            const hash = await bcrypt.hash(rawPassword, 12);
            sqlReq.input('h', sql.NVarChar(sql.MAX), hash);
            await sqlReq.query(`UPDATE EBM.Users SET FullName=@fn, Email=@e, RoleId=@rid, Apps=@apps, IsActive=@active, PasswordHash=@h, RequiresPasswordChange=0 WHERE Id=@id`);
        } else {
            await sqlReq.query(`UPDATE EBM.Users SET FullName=@fn, Email=@e, RoleId=@rid, Apps=@apps, IsActive=@active WHERE Id=@id`);
        }
        await logAudit(req, 'UPDATE_USER', 'User', String(id), { full_name, email, role_id, is_active });
        res.json({ id, full_name, email, role_id: String(role_id), apps, is_active });
    } catch (err: any) {
        console.error('[PUT /api/users/:id]', err);
        res.status(500).json({ error: safeError(err) });
    }
});

app.delete('/api/users/:id', verifyToken, checkPermission('tec.config.users'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { id: myId } = (req as any).user;
        if (String(myId) === String(id)) return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
        const db = await getDb();
        await db.request().input('id', sql.NVarChar(sql.MAX), String(id)).query(`UPDATE EBM.Users SET IsActive=0 WHERE Id=@id`);
        await logAudit(req, 'DEACTIVATE_USER', 'User', String(id), {});
        res.status(204).send();
    } catch (err: any) {
        console.error('[DELETE /api/users/:id]', err);
        res.status(500).json({ error: safeError(err) });
    }
});

// ─── ROLES ────────────────────────────────────────────────────────────────────

app.get('/api/roles', verifyToken, checkPermission('tec.config.roles'), async (req: Request, res: Response) => {
    try {
        const db = await getDb();
        const [rolesRes, permsRes] = await Promise.all([
            db.request().query(`SELECT Id as id, Name as name, ISNULL(Apps, '') as apps FROM EBM.Roles ORDER BY Name`),
            db.request().query(`SELECT RoleId, Permission FROM EBM.RolePermissions`),
        ]);
        const byRole = new Map<string, string[]>();
        for (const p of permsRes.recordset) {
            const k = String(p.RoleId);
            if (!byRole.has(k)) byRole.set(k, []);
            byRole.get(k)!.push(p.Permission);
        }
        res.json(rolesRes.recordset.map((r: any) => ({
            id: String(r.id), name: r.name, apps: r.apps,
            permissions: byRole.get(String(r.id)) ?? [],
        })));
    } catch (err: any) {
        console.error('[GET /api/roles]', err);
        res.status(500).json({ error: safeError(err) });
    }
});

app.post('/api/roles', verifyToken, checkPermission('tec.config.roles'), async (req: Request, res: Response) => {
    try {
        const parsed = roleSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
        const { name, permissions = [], apps = '' } = parsed.data;
        const db = await getDb();
        const dup = await db.request().input('n', sql.NVarChar(sql.MAX), name).query(`SELECT Id FROM EBM.Roles WHERE Name=@n`);
        if (dup.recordset.length > 0) return res.status(409).json({ error: 'Ya existe un rol con ese nombre' });
        const result = await db.request().input('n', sql.NVarChar(sql.MAX), name).input('apps', sql.NVarChar(sql.MAX), apps)
            .query(`INSERT INTO EBM.Roles (Name, Apps) OUTPUT INSERTED.Id VALUES (@n, @apps)`);
        const newId = result.recordset[0].Id;
        for (const perm of (permissions as string[])) {
            await db.request().input('rid', sql.NVarChar(sql.MAX), String(newId)).input('p', sql.NVarChar(sql.MAX), perm)
                .query(`INSERT INTO EBM.RolePermissions (RoleId, Permission) VALUES (@rid, @p)`);
        }
        await logAudit(req, 'CREATE_ROLE', 'Role', String(newId), { name, permissions });
        res.status(201).json({ id: String(newId), name, permissions, apps });
    } catch (err: any) {
        console.error('[POST /api/roles]', err);
        res.status(500).json({ error: safeError(err) });
    }
});

app.put('/api/roles/:id', verifyToken, checkPermission('tec.config.roles'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const parsed = roleSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
        const { name, permissions = [], apps } = parsed.data;
        const db = await getDb();
        const sqlReq = db.request().input('id', sql.NVarChar(sql.MAX), String(id)).input('n', sql.NVarChar(sql.MAX), name);
        if (apps !== undefined) {
            sqlReq.input('apps', sql.NVarChar(sql.MAX), apps);
            await sqlReq.query(`UPDATE EBM.Roles SET Name=@n, Apps=@apps WHERE Id=@id`);
        } else {
            await sqlReq.query(`UPDATE EBM.Roles SET Name=@n WHERE Id=@id`);
        }
        await db.request().input('rid', sql.NVarChar(sql.MAX), String(id)).query(`DELETE FROM EBM.RolePermissions WHERE RoleId=@rid`);
        for (const perm of (permissions as string[])) {
            await db.request().input('rid', sql.NVarChar(sql.MAX), String(id)).input('p', sql.NVarChar(sql.MAX), perm)
                .query(`INSERT INTO EBM.RolePermissions (RoleId, Permission) VALUES (@rid, @p)`);
        }
        await logAudit(req, 'UPDATE_ROLE', 'Role', String(id), { name, permissions });
        res.json({ id, name, permissions, apps });
    } catch (err: any) {
        console.error('[PUT /api/roles/:id]', err);
        res.status(500).json({ error: safeError(err) });
    }
});

app.delete('/api/roles/:id', verifyToken, checkPermission('tec.config.roles'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const db = await getDb();
        const inUse = await db.request().input('rid', sql.NVarChar(sql.MAX), String(id))
            .query(`SELECT COUNT(*) as cnt FROM EBM.Users WHERE RoleId=@rid AND IsActive=1`);
        if (inUse.recordset[0].cnt > 0) return res.status(409).json({ error: 'No se puede eliminar: el rol tiene usuarios activos asignados' });
        await db.request().input('rid', sql.NVarChar(sql.MAX), String(id)).query(`DELETE FROM EBM.RolePermissions WHERE RoleId=@rid`);
        await db.request().input('id', sql.NVarChar(sql.MAX), String(id)).query(`DELETE FROM EBM.Roles WHERE Id=@id`);
        await logAudit(req, 'DELETE_ROLE', 'Role', String(id), {});
        res.status(204).send();
    } catch (err: any) {
        console.error('[DELETE /api/roles/:id]', err);
        res.status(500).json({ error: safeError(err) });
    }
});

// ─── MANAGEMENTS ──────────────────────────────────────────────────────────────

app.get('/api/managements', verifyToken, async (_req: Request, res: Response) => {
    try {
        const cached = cacheGet('managements');
        if (cached) return res.json(cached);
        const db = await getDb();
        const result = await db.request()
            .query(`SELECT Id as id, Name as name, ISNULL(Code, '') as code FROM EBM.Managements ORDER BY Name`);
        const data = result.recordset.map((m: any) => ({ id: String(m.id), name: m.name, code: m.code }));
        cacheSet('managements', data, 10 * 60 * 1000);
        res.json(data);
    } catch {
        res.json([]);
    }
});

// ─── PREFERENCIAS DE USUARIO ──────────────────────────────────────────────────

app.get('/api/user/preferences', verifyToken, async (req: Request, res: Response) => {
    try {
        const { id } = (req as any).user;
        const db = await getDb();
        const result = await db.request().input('uid', sql.Int, id)
            .query(`SELECT Clave as clave, Valor as valor FROM [dbo].[GAC_APP_TB_USER_PREFS] WHERE UsuarioId=@uid`);
        const prefs: Record<string, any> = {};
        for (const row of result.recordset) {
            try { prefs[row.clave] = JSON.parse(row.valor); } catch { prefs[row.clave] = row.valor; }
        }
        res.json(prefs);
    } catch {
        res.json({});
    }
});

app.post('/api/user/preferences', verifyToken, async (req: Request, res: Response) => {
    try {
        const { id } = (req as any).user;
        const { clave, valor } = req.body;
        if (!clave) return res.status(400).json({ error: 'clave es requerida' });
        const db = await getDb();
        const valorStr = typeof valor === 'string' ? valor : JSON.stringify(valor);
        await db.request()
            .input('uid', sql.Int, id).input('c', sql.NVarChar(sql.MAX), clave).input('v', sql.NVarChar(sql.MAX), valorStr)
            .query(`
                IF EXISTS (SELECT 1 FROM [dbo].[GAC_APP_TB_USER_PREFS] WHERE UsuarioId=@uid AND Clave=@c)
                    UPDATE [dbo].[GAC_APP_TB_USER_PREFS] SET Valor=@v, UpdatedAt=GETDATE() WHERE UsuarioId=@uid AND Clave=@c
                ELSE
                    INSERT INTO [dbo].[GAC_APP_TB_USER_PREFS] (UsuarioId, Clave, Valor, CreatedAt, UpdatedAt) VALUES (@uid, @c, @v, GETDATE(), GETDATE())
            `);
        res.json({ ok: true });
    } catch (err: any) {
        console.error('[POST /api/user/preferences]', err);
        res.status(500).json({ error: safeError(err) });
    }
});

// ─── AUDIT LOGS ───────────────────────────────────────────────────────────────

app.get('/api/config/audit-logs', verifyToken, checkPermission('tec.config.audit'), async (req: Request, res: Response) => {
    try {
        const page = Math.max(1, parseInt(String(req.query.page || '1')));
        const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'))));
        const offset = (page - 1) * limit;
        const db = await getDb();
        const sqlReq = db.request().input('lim', sql.Int, limit).input('off', sql.Int, offset);
        let where = '';
        if (req.query.action) { sqlReq.input('act', sql.NVarChar(sql.MAX), `%${req.query.action}%`); where += ' AND Accion LIKE @act'; }
        if (req.query.entity) { sqlReq.input('ent2', sql.NVarChar(sql.MAX), `%${req.query.entity}%`); where += ' AND Entidad LIKE @ent2'; }
        const result = await sqlReq.query(`
            SELECT Id as id, UsuarioID as user_id, UsuarioNombre as username,
                   Accion as action, Entidad as entity, EntidadID as entity_id,
                   Detalle as details, Fecha as created_at
            FROM [dbo].[GAC_APP_TB_AUDIT_LOG]
            WHERE 1=1 ${where}
            ORDER BY Fecha DESC
            OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY
        `);
        res.json({ data: result.recordset, page, limit });
    } catch (err: any) {
        console.error('[GET /api/config/audit-logs]', err);
        res.status(500).json({ error: safeError(err) });
    }
});

// --- APPLICATIONS (AppSwitcher dinámico) ---
app.get('/api/applications', verifyToken, async (req: Request, res: Response) => {
    try {
        const db = await getDb();
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
    } catch (err: any) {
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
        const db = await getDb();
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
            store: new RedisStore({ sendCommand: (...args: string[]) => (getRedisClient() as any).call(...args) as any, prefix: 'rl:tec:auth:' }),
        });
        console.log(`[SessionConfig] Auth limiter: ${cfg.rateLimitMaxAttempts} intentos / ${cfg.rateLimitWindowMinutes} min`);
    }).catch(err => console.error('[SessionConfig] Failed to load rate limit config:', err));
});
