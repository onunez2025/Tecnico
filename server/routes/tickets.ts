/** Forma de un error de axios con respuesta del servidor. */
interface ErrorConRespuesta {
    response?: { status?: number; data?: { error?: { message?: { value?: string } } } };
}

import type { AuthenticatedRequest } from '../middleware/auth.js';
import { mensajeError } from '../lib/security.js';
import { Router } from 'express';
import type { Request, Response } from 'express';
import sql from 'mssql';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { getReadPool, getWritePool } from '../db';
import { logAudit } from '../lib/audit';
import { getContainerClient } from '../lib/blob';
import { C4C_AUTH, C4C_BASE_URL } from '../lib/config';
import { syncPaymentCache } from '../lib/pagosSync';
import { safeError, sanitizeLog } from '../lib/security';
import { upload, validateFileMagicBytes } from '../lib/upload';
import { checkPermission, isAdminRole, verifyToken } from '../middleware/auth';

// Este router se monta en `/` conservando las rutas completas. Sus 10 rutas estaban repartidas
// en tres segmentos de index.ts, separados por los montajes de sap, ticketsPagos y config; al
// unirlas quedan antes que esos montajes. Comprobado con scripts/verificar-orden-rutas.py que
// ningun par de rutas de esta app puede casar la misma URL, asi que el reorden no cambia nada.

const router = Router();

// --- INFORME TÉCNICO (C4C OData) ---
router.get('/api/tec/tickets/:ticketId/informe', verifyToken, checkPermission('tec.tickets.view'), async (req: Request, res: Response) => {
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

    } catch (err: unknown) {
        const status = (err as ErrorConRespuesta)?.response?.status || 500;
        const detail = (err as ErrorConRespuesta)?.response?.data?.error?.message?.value || mensajeError(err) || 'Error desconocido';
        console.error(`[C4C Informe] Error ticket ${sanitizeLog(req.params.ticketId)}:`, detail);
        res.status(status).json({ error: 'No se pudo obtener el informe desde C4C', details: detail });
    }
});

router.get('/api/tec/tickets/calendar-summary', verifyToken, checkPermission('tec.tickets.view'), async (req: Request, res: Response) => {
    try {
        const { codigo_tecnico, role } = (req as AuthenticatedRequest).user;
        const isAdmin = isAdminRole(role);
        const month = req.query.month as string;
        if (!month || !/^\d{4}-\d{2}$/.test(month)) {
            return res.status(400).json({ error: 'Parámetro month requerido en formato YYYY-MM' });
        }
        const db = await getReadPool();
        const sqlReq = db.request().input('month', sql.VarChar(255), month);
        // El filtro va por RANGO y no por `FORMAT(FechaVisita, 'yyyy-MM') = @month`.
        // Envolver la columna en una funcion la vuelve no-sargable: SQL Server no puede usar
        // ningun indice sobre FechaVisita y recorre la tabla entera (>1.000.000 de filas) en
        // cada carga de la pantalla. `FORMAT` ademas es de las funciones mas lentas del motor,
        // porque va por CLR. Comparar contra un rango deja la columna intacta.
        // El formato de @month ya viene validado como YYYY-MM por la regex de arriba.
        let query = `SELECT CONVERT(VARCHAR(10), FechaVisita, 23) as date, COUNT(*) as count
                     FROM [APPGAC].[ServiciosViewSQL]
                     WHERE FechaVisita >= CAST(@month + '-01' AS DATE)
                       AND FechaVisita <  DATEADD(month, 1, CAST(@month + '-01' AS DATE))`;
        if (!isAdmin) {
            query += ' AND CodigoTecnico = @techCode';
            sqlReq.input('techCode', sql.VarChar(255), codigo_tecnico);
        } else if (req.query.techCode) {
            query += ' AND CodigoTecnico = @techCode';
            sqlReq.input('techCode', sql.VarChar(255), req.query.techCode as string);
        }
        query += ' GROUP BY CONVERT(VARCHAR(10), FechaVisita, 23)';
        const t0 = Date.now();
        const result = await sqlReq.query(query);
        console.log(`[TEC] /calendar-summary — ${result.recordset.length} dias en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
        const summary: Record<string, number> = {};
        for (const row of result.recordset) { summary[row.date] = row.count; }
        res.json(summary);
    } catch (err: unknown) {
        console.error('❌ Error in /api/tec/tickets/calendar-summary:', mensajeError(err));
        res.status(500).json({ error: safeError(err) });
    }
});

router.get('/api/tec/tickets', verifyToken, checkPermission('tec.tickets.view'), async (req: Request, res: Response) => {
    try {
        const { codigo_tecnico, role } = (req as AuthenticatedRequest).user;
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

        // Mismo motivo que en calendar-summary: `CONVERT(DATE, S.FechaVisita)` envuelve la
        // COLUMNA y anula los indices. El rango medio abierto (>= dia, < dia siguiente) cubre
        // exactamente las mismas filas —todo el dia natural, con hora incluida— pero deja la
        // columna libre para que el motor pueda buscar por indice.
        if (dateStr) {
            query += " AND S.FechaVisita >= CAST(@date AS DATE) AND S.FechaVisita < DATEADD(day, 1, CAST(@date AS DATE))";
            sqlReq.input('date', sql.VarChar(255), dateStr);
        } else {
            query += " AND S.FechaVisita >= CAST(GETDATE() AS DATE) AND S.FechaVisita < DATEADD(day, 1, CAST(GETDATE() AS DATE))";
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

        const t0 = Date.now();
        const result = await sqlReq.query(query);
        console.log(`[TEC] /tec/tickets — ${result.recordset.length} tickets en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
        res.json(result.recordset);
    } catch (err: unknown) {
        console.error('❌ Error in /api/tec/tickets:', mensajeError(err));
        res.status(500).json({ error: safeError(err) });
    }
});

router.post('/api/tec/tickets/rango-horario', verifyToken, checkPermission('tec.tickets.view'), async (req: Request, res: Response) => {
    try {
        const { ticketId, rangoHorario, ordenAtencion, comentario, applyToAllClientTickets } = req.body;
        const { username, codigo_tecnico, role } = (req as AuthenticatedRequest).user;
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
            ticketsToUpdate = [...new Set([ticketId, ...bulkResult.recordset.map((r: { Ticket: string }) => r.Ticket)])];
        }

        for (const tId of ticketsToUpdate) {
            await db.request().input('tId', sql.VarChar(255), tId).input('rango', sql.VarChar(255), rangoHorario || null).input('orden', sql.VarChar(255), ordenAtencion || null).input('coment', sql.VarChar(255), comentario || null).input('user', sql.VarChar(255), username).input('idRango', sql.VarChar(255), uuidv4().substring(0, 8)).query(`MERGE [dbo].[GAC_APP_TB_RANGO_HORARIO] AS target USING (SELECT @tId AS ID_Ticket) AS source ON (target.ID_Ticket = source.ID_Ticket) WHEN MATCHED THEN UPDATE SET Rango_horario = @rango, Orden_atención = @orden, Comentario = @coment, Creado_el = GETDATE(), Creado_por = @user WHEN NOT MATCHED THEN INSERT (ID_Rango_horario, Rango_horario, Orden_atención, Comentario, Creado_el, Creado_por, ID_Ticket) VALUES (@idRango, @rango, @orden, @coment, GETDATE(), @user, @tId);`);
        }
        await logAudit(req, 'TEC:ASSIGN_RANGO_HORARIO', 'TicketRangoHorario', ticketId, { tickets: ticketsToUpdate });
        res.json({ message: 'Rango horario asignado correctamente', updatedTickets: ticketsToUpdate });
    } catch (err: unknown) {
        console.error('❌ Error in POST /api/tec/tickets/rango-horario:', mensajeError(err));
        res.status(500).json({ error: safeError(err) });
    }
});

router.get('/api/tec/tickets/:ticketId/pagos', verifyToken, checkPermission('tec.tickets.view'), async (req: Request, res: Response) => {
    try {
        const { ticketId } = req.params;
        const { codigo_tecnico, role } = (req as AuthenticatedRequest).user;
        const db = await getReadPool();
        if (!isAdminRole(role)) {
            const assignmentResult = await db.request().input('ticketId', sql.VarChar(255), ticketId).input('techCode', sql.VarChar(255), codigo_tecnico).query(`SELECT 1 FROM [APPGAC].[ServiciosViewSQL] WHERE Ticket = @ticketId AND CodigoTecnico = @techCode`);
            if (assignmentResult.recordset.length === 0) return res.status(403).json({ error: 'No tienes permiso' });
        }
        const paymentsResult = await db.request().input('ticketId', sql.VarChar(255), ticketId).query(`SELECT ID_transaccion, Fecha_creacion, Ticket, Fecha_transaccion, Voucher, Lote, Codigo_Izipay, Importe, Estado, Canal, Observacion, CodigoAutorizacion, Folio, Adjunto FROM [dbo].[GAC_APP_TB_TICKETS_PAGOS] WHERE EXISTS (SELECT 1 FROM STRING_SPLIT(Ticket, ',') WHERE LTRIM(RTRIM(value)) = @ticketId) ORDER BY Fecha_creacion DESC`);
        res.json(paymentsResult.recordset);
    } catch (err: unknown) { res.status(500).json({ error: safeError(err) }); }
});

router.post('/api/tec/tickets/:ticketId/pago', verifyToken, checkPermission('tec.tickets.view'), upload.single('adjunto'), async (req: Request, res: Response) => {
    const { ticketId } = req.params;
    const { fecha_transaccion, voucher, lote, codigo_izipay, importe, canal, observacion, folio, codigo_autorizacion } = req.body;
    const { codigo_tecnico, role } = (req as AuthenticatedRequest).user;
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
            const blockBlobClient = getContainerClient().getBlockBlobClient(blobName);
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
    } catch { if (req.file) fs.unlinkSync(req.file.path); res.status(500).json({ error: 'Error interno' }); }
});

router.get('/api/tec/today-tickets', verifyToken, checkPermission('tec.tickets.view'), async (req: Request, res: Response) => {
    try {
        const { codigo_tecnico, role } = (req as AuthenticatedRequest).user;
        const db = await getReadPool();
        const sqlReq = db.request();
        let query = `SELECT Ticket as id, Estado, FechaVisita, NombreCliente as Cliente, Distrito, (ISNULL(Calle, '') + ' ' + ISNULL(NumeroCalle, '')) as Direccion, BloqueHorario, Asunto, Celular1 as Contacto FROM [SIATC].[Dashboard_FSM] WHERE CONVERT(DATE, FechaVisita) = CONVERT(DATE, GETDATE())`;
        if (!isAdminRole(role)) { query += " AND CodigoTecnico = @techCode"; sqlReq.input('techCode', sql.VarChar(255), codigo_tecnico); }
        const result = await sqlReq.query(query);
        res.json(result.recordset);
    } catch (err: unknown) { res.status(500).json({ error: safeError(err) }); }
});

router.get('/api/tec/schedule', verifyToken, checkPermission('tec.tickets.view'), async (req: Request, res: Response) => {
    try {
        const { full_name } = (req as AuthenticatedRequest).user;
        const db = await getReadPool();
        const result = await db.request().input('user', sql.NVarChar(sql.MAX), full_name).query(`SELECT ID_empleado_calendario_labores as id, Fecha_Labor as date, Labor as title, 'Taller/Reunión' as type FROM [dbo].[GAC_APP_TB_EMPLEADOS_CALENDARIO_LABORES] WHERE Empleado = @user AND Fecha_Labor >= CONVERT(DATE, GETDATE()) ORDER BY Fecha_Labor ASC`);
        res.json(result.recordset);
    } catch (err: unknown) { res.status(500).json({ error: safeError(err) }); }
});

router.post('/api/tec/sales', verifyToken, checkPermission('tec.tickets.view'), async (req: Request, res: Response) => {
    try {
        const { ticket, pedido, observacion, comentarioTecnico } = req.body;
        const { full_name } = (req as AuthenticatedRequest).user;
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
    } catch (err: unknown) { res.status(500).json({ error: safeError(err) }); }
});

router.patch('/api/tec/time-range', verifyToken, checkPermission('tec.tickets.view'), async (req: Request, res: Response) => {
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
    } catch (err: unknown) {
        console.error('[PATCH /api/tec/time-range]', err);
        res.status(500).json({ error: safeError(err) });
    }
});

export default router;
