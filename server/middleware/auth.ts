import { nombreError } from '../lib/security.js';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import sql from 'mssql';
import { getWritePool } from '../db';
import { dominioCookie } from '../lib/dominioCookie';
import { isTokenBlacklisted, isSessionInvalidated } from '../lib/redis';

// La comprobacion fatal de JWT_SECRET sigue en index.ts, en su sitio original: moverla aqui la
// adelantaria al momento del import y cambiaria cual de los dos FATAL de arranque se ve primero.
// Aqui solo se lee el valor; si faltara, el proceso ya habria terminado antes de atender nada.
const JWT_SECRET = process.env.JWT_SECRET;

// --- TIPOS TIPADOS PARA REQUESTS AUTENTICADOS ---
interface AuthenticatedRequest extends Request {
    user: {
        id: string;
        username: string;
        full_name: string;
        codigo_tecnico: string | null;
        role: string;
        permissions: string[];
    };
}

// Borra la cookie compartida del lado del servidor (Set-Cookie en la respuesta) cuando se
// detecta un token invalidado/blacklisteado. No depende de que el JS del cliente logre borrarla
// antes de la siguiente navegación -- evita el bucle de recarga infinita que eso puede causar
// (ver bitácora Fase 20: la limpieza vía document.cookie + window.location.href en el mismo
// tick no siempre alcanza a comprometerse antes de que la página navegue).
function clearSharedCookie(res: Response, req?: Request): void {
    // Mismo criterio que al escribirla: se borra si la peticion llega bajo un dominio del
    // ecosistema, no segun NODE_ENV. Si se borrara con un criterio distinto del que la escribe,
    // quedaria una cookie que nadie puede limpiar.
    const dominioCompartido = req ? dominioCookie(req) : process.env.COOKIE_DOMAIN?.trim();
    if (dominioCompartido) {
        res.cookie('token', '', { domain: dominioCompartido, maxAge: 0, httpOnly: false, secure: true, sameSite: 'lax', path: '/' });
    }
}

const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token no encontrado' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET as string) as AuthenticatedRequest['user'];
        if (await isTokenBlacklisted(token)) {
            clearSharedCookie(res, req);
            return res.status(401).json({ error: 'Sesión cerrada. Inicia sesión nuevamente.' });
        }
        if (await isSessionInvalidated((decoded as any).id, (decoded as any).iat)) {
            clearSharedCookie(res, req);
            return res.status(401).json({ error: 'Sesión cerrada. Inicia sesión nuevamente.' });
        }
        (req as AuthenticatedRequest).user = decoded;
        next();
    } catch (err: unknown) {
        if (nombreError(err) === 'TokenExpiredError') return res.status(401).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' });
        res.status(403).json({ error: 'Token inválido' });
    }
};

const ADMIN_ROLE_ALIASES = ['administrador', 'admin', 'console.administrador'];
const isAdminRole = (role?: string | null) => ADMIN_ROLE_ALIASES.includes((role || '').trim().toLowerCase());

const checkPermission = (permission: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'No autenticado' });

        if (isAdminRole(user.role)) return next();
        
        const userPerms = user.permissions || (user as any).perms;
        if (userPerms && userPerms.includes(permission)) {
            return next();
        }

        try {
            const db = await getWritePool();
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

export type { AuthenticatedRequest };
export { clearSharedCookie, verifyToken, isAdminRole, checkPermission };
