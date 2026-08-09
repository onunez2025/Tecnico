import { Router } from 'express';
import { APPSHEET_PDF_PATH } from '../lib/config';
import type { Request, Response } from 'express';
import sql from 'mssql';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { getReadPool, getWritePool } from '../db';
import { logAudit } from '../lib/audit';
import { syncPaymentCache } from '../lib/pagosSync';
import { safeError } from '../lib/security';
import { checkPermission, isAdminRole, verifyToken } from '../middleware/auth';

// Este router se monta en `/` conservando las rutas completas y en la misma posicion en que se
// definian en index.ts. Express resuelve por orden de registro, asi que esa posicion es parte
// del comportamiento, no un detalle estetico.

const router = Router();

// Detalle de ticket para auto-completar importe y folio
router.get('/api/tickets-pagos/:ticketId/details', verifyToken, checkPermission('tec.payments.view'), async (req: Request, res: Response) => {
    try {
        const { ticketId } = req.params;
        const safeTicketId = String(ticketId).replace(/[^a-zA-Z0-9_-]/g, '');
        if (!safeTicketId) return res.status(400).json({ error: 'Ticket inválido' });
        const db = await getReadPool();
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
router.get('/api/tickets-pagos', verifyToken, checkPermission('tec.payments.view'), async (req: Request, res: Response) => {
    try {
        const page  = Math.max(1, parseInt(String(req.query.page  || '1')));
        const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'))));
        const search = String(req.query.search || '').trim();
        const offset = (page - 1) * limit;
        const db = await getReadPool();
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
        const isAdmin = isAdminRole(currentUser?.role);
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
router.post('/api/tickets-pagos', verifyToken, checkPermission('tec.payments.register'), async (req: Request, res: Response) => {
    try {
        const { ticket, fecha_transaccion, voucher, lote, codigo_izipay, codigo_autorizacion, folio, importe, canal, observacion } = req.body;
        if (!ticket || String(ticket).trim() === '') return res.status(400).json({ error: 'Debe incluir al menos un ticket' });
        if (!importe) return res.status(400).json({ error: 'Importe requerido' });

        const tickets = String(ticket).split(',').map((t: string) => t.trim()).filter(Boolean);
        if (tickets.length === 0) return res.status(400).json({ error: 'Ticket inválido' });
        const ticketStr = tickets.join(', ');

        const db = await getWritePool();
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

router.get('/api/tickets-pagos/:id/pdf', verifyToken, checkPermission('tec.payments.view'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const db = await getReadPool();
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

export default router;
