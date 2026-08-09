import { Router } from 'express';
import { cacheGet, cacheSet, cacheInvalidate } from '../lib/cache';
import type { Request, Response } from 'express';
import sql from 'mssql';
import { getReadPool, getWritePool } from '../db';
import { logAudit } from '../lib/audit';
import { safeError } from '../lib/security';
import { checkPermission, verifyToken } from '../middleware/auth';

// Este router se monta en `/` conservando las rutas completas y en la misma posicion en que se
// definian en index.ts. Express resuelve por orden de registro, asi que esa posicion es parte del
// comportamiento, no un detalle estetico.

const router = Router();

router.get('/api/config/rango-horario-limit', verifyToken, checkPermission('tec.config.access'), async (_req: Request, res: Response) => {
    try {
        const cached = cacheGet('rango-horario-limit');
        if (cached) return res.json(cached);
        const db = await getReadPool();
        const result = await db.request().query("SELECT Valor, Descripcion FROM [dbo].[GAC_APP_TB_CONFIG] WHERE Clave = 'HORA_MAXIMA_RANGO_HORARIO'");
        const data = { limit: result.recordset[0]?.Valor || '09:30', description: result.recordset[0]?.Descripcion || '' };
        cacheSet('rango-horario-limit', data, 5 * 60 * 1000);
        res.json(data);
    } catch (err: any) { res.status(500).json({ error: safeError(err) }); }
});

router.post('/api/config/rango-horario-limit', verifyToken, checkPermission('tec.config.parameters'), async (req: Request, res: Response) => {
    try {
        const { limit } = req.body;
        if (!limit || !/^\d{2}:\d{2}$/.test(limit)) {
            return res.status(400).json({ error: 'Formato de hora inválido. Use HH:mm (ej: 09:30)' });
        }
        const { username } = (req as any).user;
        const db = await getWritePool();
        await db.request().input('limit', sql.VarChar(255), limit).input('user', sql.VarChar(255), username).query(`UPDATE [dbo].[GAC_APP_TB_CONFIG] SET Valor = @limit, Actualizado_el = GETDATE(), Actualizado_por = @user WHERE Clave = 'HORA_MAXIMA_RANGO_HORARIO'`);
        cacheInvalidate('rango-horario-limit');
        await logAudit(req, 'TEC:UPDATE_CONFIG_LIMIT', 'SystemConfig', 'HORA_MAXIMA_RANGO_HORARIO', { limit });
        res.json({ message: 'Configuración actualizada' });
    } catch (err: any) { res.status(500).json({ error: safeError(err) }); }
});

export default router;
