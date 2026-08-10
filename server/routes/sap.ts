import { Router } from 'express';
import type { Request, Response } from 'express';
import sql from 'mssql';
import { getReadPool } from '../db';
import { safeError } from '../lib/security';
import { verifyToken, checkPermission } from '../middleware/auth';

// Este router se monta en `/` conservando la ruta completa (`/api/sap/...`) tal como estaba en
// index.ts. Es deliberado: el modulado es un refactor estructural puro, y montar con prefijo
// obligaria a re-derivar la ruta y la cadena de middleware de cada endpoint -- que es justo donde
// se cuelan los cambios de comportamiento involuntarios.
const router = Router();

// Buscar tickets en SAP/FSM por número o nombre de cliente
router.get('/api/sap/tickets/search', verifyToken, checkPermission('tec.payments.view'), async (req: Request, res: Response) => {
    try {
        const q = String(req.query.q || '').trim();
        if (q.length < 3) return res.json([]);
        const db = await getReadPool();
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
    } catch (err: unknown) {
        console.error('Error en /api/sap/tickets/search:', err);
        res.status(500).json({ error: safeError(err) });
    }
});

export default router;
