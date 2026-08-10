import { Router } from 'express';
import type { Request, Response } from 'express';
import sql from 'mssql';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { getWritePool } from '../db';
import { safeError } from '../lib/security';
import { verifyToken } from '../middleware/auth';

// Este router se monta en `/` conservando las rutas completas y en la misma posicion en que se
// definian en index.ts. Express resuelve por orden de registro, asi que esa posicion es parte del
// comportamiento, no un detalle estetico.

// Autoservicio de perfil — deliberadamente separado de updateUserSchema/PUT /api/users/:id
// (endpoint administrativo gateado por tec.config.users). Cualquier usuario autenticado
// puede editar SU PROPIO avatar/contraseña; nunca full_name/email/role_id/apps/is_active
// de otro usuario, y nunca de sí mismo tampoco vía esta ruta (eso sigue siendo de solo
// lectura en ProfilePage, gestionado por un administrador si hace falta cambiarlo).
const updateProfileSchema = z.object({
    avatar_url: z.string().max(500000).optional(),
    password_hash: z.string().min(6, 'Mínimo 6 caracteres').max(255).optional(),
});

const router = Router();

// ─── PERFIL PROPIO (autoservicio) ───────────────────────────────────────────────
// Solo verifyToken — cualquier usuario autenticado puede guardar SU PROPIO avatar
// y/o contraseña. A diferencia de PUT /api/users/:id (abajo), no acepta id por
// parámetro: siempre opera sobre (req as any).user.id, y no permite tocar
// full_name/email/role_id/apps/is_active de nadie.
router.put('/api/profile', verifyToken, async (req: Request, res: Response) => {
    try {
        const { id } = (req as any).user;
        const parsed = updateProfileSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
        const { avatar_url, password_hash: rawPassword } = parsed.data;
        const db = await getWritePool();
        const sqlReq = db.request().input('id', sql.UniqueIdentifier, id);

        const sets: string[] = [];
        if (avatar_url !== undefined) {
            sqlReq.input('avatarUrl', sql.NVarChar(sql.MAX), avatar_url);
            sets.push('AvatarUrl=@avatarUrl');
        }
        if (rawPassword) {
            const hash = await bcrypt.hash(rawPassword, 12);
            sqlReq.input('h', sql.NVarChar(sql.MAX), hash);
            sets.push('PasswordHash=@h', 'RequiresPasswordChange=0');
        }
        if (sets.length > 0) {
            await sqlReq.query(`UPDATE EBM.Users SET ${sets.join(', ')} WHERE Id=@id`);
        }

        const result = await db.request().input('id', sql.UniqueIdentifier, id)
            .query('SELECT FullName, AvatarUrl, RequiresPasswordChange FROM EBM.Users WHERE Id=@id');
        const updated = result.recordset[0];
        res.json({
            full_name: updated?.FullName || '',
            avatar_url: updated?.AvatarUrl || '',
            requires_password_change: updated?.RequiresPasswordChange === true || updated?.RequiresPasswordChange === 1
        });
    } catch (err: unknown) {
        console.error('[PUT /api/profile]', err);
        res.status(500).json({ error: safeError(err) });
    }
});

export default router;
