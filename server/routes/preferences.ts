import type { AuthenticatedRequest } from '../middleware/auth.js';
import { Router } from 'express';
import type { Request, Response } from 'express';
import sql from 'mssql';
import { getReadPool, getWritePool } from '../db';
import { safeError } from '../lib/security';
import { verifyToken } from '../middleware/auth';

// Este router se monta en `/` conservando las rutas completas y en la misma posicion en que se
// definian en index.ts. Express resuelve por orden de registro, asi que esa posicion es parte del
// comportamiento, no un detalle estetico.

const router = Router();

// ─── PREFERENCIAS DE USUARIO ──────────────────────────────────────────────────

router.get('/api/user/preferences', verifyToken, async (req: Request, res: Response) => {
    try {
        const { id } = (req as AuthenticatedRequest).user;
        const db = await getReadPool();
        const result = await db.request().input('uid', sql.Int, id)
            .query(`SELECT Clave as clave, Valor as valor FROM [dbo].[GAC_APP_TB_USER_PREFS] WHERE UsuarioId=@uid`);
        const prefs: Record<string, unknown> = {};
        for (const row of result.recordset) {
            try { prefs[row.clave] = JSON.parse(row.valor); } catch { prefs[row.clave] = row.valor; }
        }
        res.json(prefs);
    } catch {
        res.json({});
    }
});

router.post('/api/user/preferences', verifyToken, async (req: Request, res: Response) => {
    try {
        const { id } = (req as AuthenticatedRequest).user;
        const { clave, valor } = req.body;
        if (!clave) return res.status(400).json({ error: 'clave es requerida' });
        const db = await getWritePool();
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
    } catch (err: unknown) {
        console.error('[POST /api/user/preferences]', err);
        res.status(500).json({ error: safeError(err) });
    }
});

export default router;
