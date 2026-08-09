import { Router } from 'express';
import type { Request, Response } from 'express';
import sql from 'mssql';
import { getReadPool } from '../db';
import { safeError } from '../lib/security';
import { checkPermission, verifyToken } from '../middleware/auth';

// Este router se monta en `/` conservando las rutas completas y en la misma posicion en que se
// definian en index.ts.

const router = Router();

// --- DASHBOARD ---
router.get('/api/dashboard/stats', verifyToken, checkPermission('tec.dashboard.view'), async (req: Request, res: Response) => {
    try {
        const { search = '', status = '', field = 'all', auth_code = '', date_trans = '', date_visit = '', tipo_servicio = '', month = '', year = '' } = req.query as any;
        const db = await getReadPool();
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

router.get('/api/dashboard/technicians', verifyToken, checkPermission('tec.dashboard.view'), async (req: Request, res: Response) => {
    try {
        const db = await getReadPool();
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

router.get('/api/dashboard/cas-performance', verifyToken, checkPermission('tec.dashboard.view'), async (req: Request, res: Response) => {
    try {
        const db = await getReadPool();
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

router.get('/api/dashboard/technician/:name/metrics', verifyToken, checkPermission('tec.dashboard.view'), async (req: Request, res: Response) => {
    try {
        const { name } = req.params;
        const db = await getReadPool();
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

export default router;
