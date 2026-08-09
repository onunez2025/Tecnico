import { Router } from 'express';
import { cacheGet, cacheSet } from '../lib/cache';
import type { Request, Response } from 'express';
import { getReadPool } from '../db';
import { verifyToken } from '../middleware/auth';

// Este router se monta en `/` conservando las rutas completas y en la misma posicion en que se
// definian en index.ts. Express resuelve por orden de registro, asi que esa posicion es parte del
// comportamiento, no un detalle estetico.

const router = Router();

// ─── MANAGEMENTS ──────────────────────────────────────────────────────────────

router.get('/api/managements', verifyToken, async (_req: Request, res: Response) => {
    try {
        const cached = cacheGet('managements');
        if (cached) return res.json(cached);
        const db = await getReadPool();
        const result = await db.request()
            .query(`SELECT Id as id, Name as name, ISNULL(Code, '') as code FROM EBM.Managements ORDER BY Name`);
        const data = result.recordset.map((m: any) => ({ id: String(m.id), name: m.name, code: m.code }));
        cacheSet('managements', data, 10 * 60 * 1000);
        res.json(data);
    } catch {
        res.json([]);
    }
});

export default router;
