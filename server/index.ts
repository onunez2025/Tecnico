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
import { exchangeCodeForToken, getCasdoorUserInfo, getCasdoorAuthorizeUrl } from './lib/casdoorClient';
import { sendSsoPendingEmail, sendSsoFirstRetryEmail, sendSsoFinalRetryEmail } from './lib/mailer';
import { dominioCookie } from './lib/dominioCookie';
import { safeError, sanitizeLog } from './lib/security';
import { getDb, getReadPool, getWritePool } from './db';
import { getRedisClient, isTokenBlacklisted, blacklistToken, invalidateAllUserSessions, isSessionInvalidated } from './lib/redis';
import type { AuthenticatedRequest } from './middleware/auth';
import { clearSharedCookie, verifyToken, isAdminRole, checkPermission } from './middleware/auth';
import sapRouter from './routes/sap';
import configRouter from './routes/config';
import profileRouter from './routes/profile';
import managementsRouter from './routes/managements';
import preferencesRouter from './routes/preferences';
import ssoAuthRouter from './routes/ssoAuth';
import ticketsPagosRouter from './routes/ticketsPagos';
import authRouter from './routes/auth';
import dashboardRouter from './routes/dashboard';
import { syncPaymentCache } from './lib/pagosSync';
import { logAudit } from './lib/audit';
dotenv.config();
import { APP_IDENTIFIER, APPSHEET_PDF_PATH } from './lib/config';

const C4C_BASE_URL = process.env.C4C_BASE_URL;
const C4C_AUTH = Buffer.from(`${process.env.C4C_USER || ''}:${process.env.C4C_PASSWORD || ''}`).toString('base64');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

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
        } catch (err: any) {
            console.warn(`⚠️ Migration step skipped [${step.name}]:`, err.message);
        }
    }
    console.log('✅ SQL Migrations complete');
}



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

app.use(sapRouter);   // /api/sap/tickets/search -- montado en el mismo punto en que se definia

app.use(ticketsPagosRouter);  // /api/tickets-pagos (4 rutas)

app.get('/api/tec/tickets/calendar-summary', verifyToken, checkPermission('tec.tickets.view'), async (req: Request, res: Response) => {
    try {
        const { codigo_tecnico, role } = (req as any).user;
        const isAdmin = isAdminRole(role);
        const month = req.query.month as string;
        if (!month || !/^\d{4}-\d{2}$/.test(month)) {
            return res.status(400).json({ error: 'Parámetro month requerido en formato YYYY-MM' });
        }
        const db = await getReadPool();
        const sqlReq = db.request().input('month', sql.VarChar(255), month);
        let query = `SELECT CONVERT(VARCHAR(10), FechaVisita, 23) as date, COUNT(*) as count FROM [APPGAC].[ServiciosViewSQL] WHERE FORMAT(FechaVisita, 'yyyy-MM') = @month`;
        if (!isAdmin) {
            query += ' AND CodigoTecnico = @techCode';
            sqlReq.input('techCode', sql.VarChar(255), codigo_tecnico);
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
        const { codigo_tecnico, role } = (req as any).user;
        const isAdmin = isAdminRole(role);
        const dateStr = req.query.date as string;
        
        const db = await getReadPool();
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
            sqlReq.input('techCode', sql.VarChar(255), codigo_tecnico);
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
        const { username, codigo_tecnico, role } = (req as any).user;
        const isAdmin = isAdminRole(role);

        if (!ticketId) return res.status(400).json({ error: 'ID de ticket es requerido' });

        const db = await getWritePool();
        const ticketResult = await db.request().input('ticketId', sql.VarChar(255), ticketId).query(`SELECT FechaVisita, IdCliente, CodigoTecnico FROM [APPGAC].[ServiciosViewSQL] WHERE Ticket = @ticketId`);

        if (ticketResult.recordset.length === 0) return res.status(404).json({ error: 'Ticket no encontrado' });

        const ticketData = ticketResult.recordset[0];
        if (!isAdmin) {
            if ((ticketData.CodigoTecnico || '').trim().toLowerCase() !== (codigo_tecnico || '').trim().toLowerCase()) return res.status(403).json({ error: 'No tienes permiso' });
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

app.use(configRouter);        // /api/config/rango-horario-limit

app.get('/api/tec/tickets/:ticketId/pagos', verifyToken, checkPermission('tec.tickets.view'), async (req: Request, res: Response) => {
    try {
        const { ticketId } = req.params;
        const { codigo_tecnico, role } = (req as any).user;
        const db = await getReadPool();
        if (!isAdminRole(role)) {
            const assignmentResult = await db.request().input('ticketId', sql.VarChar(255), ticketId).input('techCode', sql.VarChar(255), codigo_tecnico).query(`SELECT 1 FROM [APPGAC].[ServiciosViewSQL] WHERE Ticket = @ticketId AND CodigoTecnico = @techCode`);
            if (assignmentResult.recordset.length === 0) return res.status(403).json({ error: 'No tienes permiso' });
        }
        const paymentsResult = await db.request().input('ticketId', sql.VarChar(255), ticketId).query(`SELECT ID_transaccion, Fecha_creacion, Ticket, Fecha_transaccion, Voucher, Lote, Codigo_Izipay, Importe, Estado, Canal, Observacion, CodigoAutorizacion, Folio, Adjunto FROM [dbo].[GAC_APP_TB_TICKETS_PAGOS] WHERE EXISTS (SELECT 1 FROM STRING_SPLIT(Ticket, ',') WHERE LTRIM(RTRIM(value)) = @ticketId) ORDER BY Fecha_creacion DESC`);
        res.json(paymentsResult.recordset);
    } catch (err: any) { res.status(500).json({ error: safeError(err) }); }
});

app.post('/api/tec/tickets/:ticketId/pago', verifyToken, checkPermission('tec.tickets.view'), upload.single('adjunto'), async (req: Request, res: Response) => {
    const { ticketId } = req.params;
    const { fecha_transaccion, voucher, lote, codigo_izipay, importe, canal, observacion, folio, codigo_autorizacion } = req.body;
    const { codigo_tecnico, role } = (req as any).user;
    try {
        const db = await getWritePool();
        if (!isAdminRole(role)) {
            const assignmentResult = await db.request().input('ticketId', sql.VarChar(255), ticketId).input('techCode', sql.VarChar(255), codigo_tecnico).query(`SELECT 1 FROM [APPGAC].[ServiciosViewSQL] WHERE Ticket = @ticketId AND CodigoTecnico = @techCode`);
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
        const { codigo_tecnico, role } = (req as any).user;
        const db = await getReadPool();
        const sqlReq = db.request();
        let query = `SELECT Ticket as id, Estado, FechaVisita, NombreCliente as Cliente, Distrito, (ISNULL(Calle, '') + ' ' + ISNULL(NumeroCalle, '')) as Direccion, BloqueHorario, Asunto, Celular1 as Contacto FROM [SIATC].[Dashboard_FSM] WHERE CONVERT(DATE, FechaVisita) = CONVERT(DATE, GETDATE())`;
        if (!isAdminRole(role)) { query += " AND CodigoTecnico = @techCode"; sqlReq.input('techCode', sql.VarChar(255), codigo_tecnico); }
        const result = await sqlReq.query(query);
        res.json(result.recordset);
    } catch (err: any) { res.status(500).json({ error: safeError(err) }); }
});

app.get('/api/tec/schedule', verifyToken, checkPermission('tec.tickets.view'), async (req: Request, res: Response) => {
    try {
        const { full_name } = (req as any).user;
        const db = await getReadPool();
        const result = await db.request().input('user', sql.NVarChar(sql.MAX), full_name).query(`SELECT ID_empleado_calendario_labores as id, Fecha_Labor as date, Labor as title, 'Taller/Reunión' as type FROM [dbo].[GAC_APP_TB_EMPLEADOS_CALENDARIO_LABORES] WHERE Empleado = @user AND Fecha_Labor >= CONVERT(DATE, GETDATE()) ORDER BY Fecha_Labor ASC`);
        res.json(result.recordset);
    } catch (err: any) { res.status(500).json({ error: safeError(err) }); }
});

app.post('/api/tec/sales', verifyToken, checkPermission('tec.tickets.view'), async (req: Request, res: Response) => {
    try {
        const { ticket, pedido, observacion, comentarioTecnico } = req.body;
        const { full_name } = (req as any).user;
        const db = await getWritePool();
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
        const db = await getWritePool();
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
            store: new RedisStore({ sendCommand: (...args: string[]) => (getRedisClient() as any).call(...args) as any, prefix: 'rl:tec:auth:' }),
        });
        console.log(`[SessionConfig] Auth limiter: ${cfg.rateLimitMaxAttempts} intentos / ${cfg.rateLimitWindowMinutes} min`);
    }).catch(err => console.error('[SessionConfig] Failed to load rate limit config:', err));
});
