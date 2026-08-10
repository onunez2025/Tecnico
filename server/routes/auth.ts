import { Router } from 'express';
import type { Request, Response } from 'express';
import sql from 'mssql';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { getReadPool, getWritePool } from '../db';
import { APP_IDENTIFIER } from '../lib/config';
import { dominioCookie } from '../lib/dominioCookie';
import { blacklistToken, invalidateAllUserSessions, isSessionInvalidated, isTokenBlacklisted } from '../lib/redis';
import { safeError } from '../lib/security';
import { clearSharedCookie, verifyToken } from '../middleware/auth';

// La escritura de la cookie compartida NO depende de NODE_ENV: se decide por el dominio derivado
// del Host de cada peticion (ver dominioCookie). Antes dependia de una constante de modulo
// IS_PRODUCTION, que ademas se evaluaba antes que dotenv.config(). Ver server/lib/env.ts.
const JWT_SECRET = process.env.JWT_SECRET;

// Este router se monta en `/` conservando las rutas completas y en la misma posicion en que se
// definian en index.ts.

const router = Router();

// --- AUTH ---
const loginSchema = z.object({
    username: z.string().min(1, 'Usuario requerido').max(255),
    password: z.string().min(1, 'Contraseña requerida').max(255),
    remember: z.boolean().optional(),
});

router.post('/api/auth/login', async (req: Request, res: Response) => {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({ error: 'Datos de login inválidos', details: parseResult.error.issues });
    }
    const { username, password, remember } = parseResult.data;
    try {
        const db = await getWritePool();
        const result = await db.request().input('u', sql.NVarChar(sql.MAX), username).input('app', sql.NVarChar(sql.MAX), APP_IDENTIFIER).query(`
            SELECT u.*, r.Name as RoleName, uc.CASId as cas_id, c.Nombre_CAS as cas_name, LTRIM(RTRIM(c.Abrev_nombre_colaboradores)) as cas_prefijo,
                r.InactivityTimeoutMinutes as role_timeout, r.WarningBeforeMinutes as role_warning,
                m.Name as management_name
            FROM EBM.Users u
            LEFT JOIN EBM.Roles r ON u.RoleId = r.Id
            LEFT JOIN EBM.UserCAS uc ON u.Id = uc.UserId
            LEFT JOIN dbo.GAC_APP_TB_CAS c ON uc.CASId = c.ID_CAS
            LEFT JOIN EBM.Managements m ON u.ManagementId = m.Id
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
                codigo_tecnico: user.CodigoTecnico || null,
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
        // La cookie compartida se escribe cuando la peticion llega bajo un dominio del ecosistema
        // (lo dice dominioCookie), NO cuando NODE_ENV valga 'production'. NODE_ENV es una variable
        // que puede faltar en Dokploy sin que nada avise, y si falta esta cookie no se escribe
        // nunca: se entra a la app pero el salto a cualquier otra pide login. El dominio, en
        // cambio, se deriva del Host de cada peticion y no depende de configuracion.
        const dominioCompartido = dominioCookie(req);
        if (dominioCompartido) {
            res.cookie('token', ssoToken, {
                domain: dominioCompartido,
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
                email: user.Email || '',
                avatar_url: user.AvatarUrl || '',
                full_name: user.FullName,
                codigo_tecnico: user.CodigoTecnico || null,
                role_name: user.RoleName,
                role: user.RoleName,
                permissions: perms,
                perms: perms,
                apps: user.Apps || '',
                management_id: user.ManagementId || null,
                management_name: user.management_name || null,
                requires_password_change: user.RequiresPasswordChange === 1
            },
            sessionConfig: { timeoutMinutes, warningMinutes }
        });
    } catch (err: unknown) {
        console.error('❌ Error en Login:', err);
        res.status(500).json({ error: safeError(err) });
    }
});

router.post('/api/auth/logout', verifyToken, async (req: any, res: any) => {
    const token = req.headers['authorization']!.split(' ')[1];
    await blacklistToken(token, (req.user as any).exp ?? 0);
    // Invalida también cualquier otro token del mismo usuario (ej. re-firmado por otra app del
    // ecosistema vía su propio /auth/me) -- un logout debe cerrar la sesión en todas las apps QA,
    // no solo revocar el token puntual que se usó para llamar a este endpoint.
    await invalidateAllUserSessions((req.user as any).id);
    // Borrar la cookie compartida aquí mismo (Set-Cookie de la respuesta) en vez de depender
    // solo del document.cookie del cliente, que puede no alcanzar a comprometerse antes de que
    // la página navegue tras el logout.
    clearSharedCookie(res, req);
    res.json({ message: 'Sesión cerrada correctamente.' });
});

router.get('/api/auth/me', verifyToken, async (req: Request, res: Response) => {
    try {
        const { id } = (req as any).user;
        const db = await getReadPool();
        const result = await db.request()
            .input('id', sql.UniqueIdentifier, id)
            .input('app', sql.VarChar(20), APP_IDENTIFIER)
            .query(`
            SELECT u.*, r.Name as RoleName, uc.CASId as cas_id, c.Nombre_CAS as cas_name, LTRIM(RTRIM(c.Abrev_nombre_colaboradores)) as cas_prefijo,
                m.Name as management_name
            FROM EBM.Users u
            LEFT JOIN EBM.Roles r ON u.RoleId = r.Id
            LEFT JOIN EBM.UserCAS uc ON u.Id = uc.UserId
            LEFT JOIN dbo.GAC_APP_TB_CAS c ON uc.CASId = c.ID_CAS
            LEFT JOIN EBM.Managements m ON u.ManagementId = m.Id
            WHERE u.Id = @id AND (u.Apps LIKE '%' + @app + '%' OR u.Apps LIKE '%ADMIN%')
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
                codigo_tecnico: user.CodigoTecnico || null,
                permissions: perms,
                apps: user.Apps || '',
                casId: user.cas_id || null,
                casName: user.cas_name || null,
                casPrefijo: user.cas_prefijo || null,
                // Propaga el claim del piloto Casdoor al token regenerado — si el frontend
                // también reescribe la cookie compartida por su cuenta (como en Devoluciones),
                // necesita poder detectar ssoPilot decodificando este freshToken.
                ...((req as any).user?.ssoPilot ? { ssoPilot: true } : {})
            },
            JWT_SECRET as string,
            { expiresIn: '12h' }
        );
        // Los tokens marcados ssoPilot=true no deben reescribir la cookie compartida aquí — hoy eso
        // pasa solo cuando COOKIE_DOMAIN no está configurada (producción real, sin dominio QA propio).
        // Cuando COOKIE_DOMAIN sí está configurada (Fase 20, entorno QA), el callback de Casdoor deja
        // de firmar ssoPilot=true, así que esta cookie sí se escribe y el SSO cruzado real funciona.
        if (!(req as any).user?.ssoPilot) {
            const ssoToken = jwt.sign(
                { id: user.Id, role: user.RoleName, role_name: user.RoleName, username: user.Username, apps: user.Apps || '', casId: user.cas_id || null },
                JWT_SECRET as string,
                { expiresIn: '12h' }
            );
            const dominioCompartido = dominioCookie(req);
            if (dominioCompartido) {
                res.cookie('token', ssoToken, {
                    domain: dominioCompartido,
                    maxAge: 12 * 60 * 60 * 1000,
                    httpOnly: false,
                    secure: true,
                    sameSite: 'lax',
                    path: '/'
                });
            }
        }

        res.json({
            token: freshToken,
            user: {
                id: user.Id,
                username: user.Username,
                email: user.Email || '',
                avatar_url: user.AvatarUrl || '',
                full_name: user.FullName,
                codigo_tecnico: user.CodigoTecnico || null,
                role_name: user.RoleName,
                role: user.RoleName,
                permissions: perms,
                perms: perms,
                apps: user.Apps || '',
                management_id: user.ManagementId || null,
                management_name: user.management_name || null
            }
        });
    } catch (err: unknown) { res.status(500).json({ error: safeError(err) }); }
});

router.post('/api/auth/refresh', async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token no encontrado' });
    if (await isTokenBlacklisted(token)) {
        clearSharedCookie(res, req);
        return res.status(401).json({ error: 'Sesión cerrada. Inicia sesión nuevamente.' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET as string, { ignoreExpiration: true }) as any;
        if (await isSessionInvalidated(decoded.id, decoded.iat)) {
            clearSharedCookie(res, req);
            return res.status(401).json({ error: 'Sesión cerrada. Inicia sesión nuevamente.' });
        }
        const now = Math.floor(Date.now() / 1000);
        if (decoded.exp && (now - decoded.exp) > 24 * 60 * 60) {
            return res.status(401).json({ error: 'Sesión demasiado antigua. Inicia sesión nuevamente.' });
        }
        const db = await getWritePool();
        const result = await db.request()
            .input('id', sql.NVarChar(sql.MAX), String(decoded.id))
            .input('app', sql.VarChar(20), APP_IDENTIFIER)
            .query(
            `SELECT u.Id, u.Username, u.FullName, u.CodigoTecnico, u.RoleId, u.IsActive, r.Name as RoleName FROM EBM.Users u LEFT JOIN EBM.Roles r ON u.RoleId = r.Id WHERE u.Id = @id AND (u.Apps LIKE '%' + @app + '%' OR u.Apps LIKE '%ADMIN%')`
        );
        const user = result.recordset[0];
        if (!user || !user.IsActive) return res.status(401).json({ error: 'Usuario inactivo' });
        const perms = (await db.request().input('rid', sql.NVarChar(sql.MAX), String(user.RoleId)).query(
            'SELECT Permission FROM EBM.RolePermissions WHERE RoleId = @rid'
        )).recordset.map((p: any) => p.Permission);
        const newToken = jwt.sign(
            { id: user.Id, username: user.Username, full_name: user.FullName, codigo_tecnico: user.CodigoTecnico || null, role: user.RoleName, permissions: perms },
            JWT_SECRET as string,
            { expiresIn: '12h' }
        );
        res.json({ token: newToken });
    } catch {
        res.status(401).json({ error: 'Token inválido' });
    }
});

export default router;
