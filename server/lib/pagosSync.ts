import sql from 'mssql';
import { getWritePool } from '../db';

export async function syncPaymentCache(id_transaccion: string) {
    try {
        const db = await getWritePool();
        await db.request().input('id', sql.VarChar(50), id_transaccion).query(`
            DELETE FROM [dbo].[GAC_PAGOS_CACHE] WHERE ID_transaccion = @id;
            
            INSERT INTO [dbo].[GAC_PAGOS_CACHE] (
                ID_transaccion, Fecha_creacion, Fecha_transaccion, Estado, 
                Importe_Texto, Importe_Num, Voucher, Canal, Folio, CodigoAutorizacion, 
                Lote, Codigo_Izipay, Ticket_Original, Observacion, Fecha_recepcion, 
                Fecha_liquidacion, Tecnicos, Clientes, TipoServicio, Distrito, 
                Direccion, FechaVisita, Total_Facturado, Total_Material_Used, 
                Tiene_Factura, Tiene_Materiales, Monto_Discrepante,
                Aprobacion_Comentario, Aprobacion_Por, Aprobacion_El
            )
            SELECT 
                P.ID_transaccion, P.Fecha_creacion, P.Fecha_transaccion, P.Estado,
                P.Importe as Importe_Texto,
                TRY_CAST(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(P.Importe, '0'), 'S/', ''), ',', ''), CHAR(160), ''), ' ', ''), CHAR(9), '') AS DECIMAL(18,2)),
                P.Voucher, P.Canal, P.Folio, P.CodigoAutorizacion, P.Lote, P.Codigo_Izipay,
                P.Ticket, P.Observacion, P.Fecha_recepcion, P.Fecha_liquidacion,
                M.Tecnicos, M.Clientes, M.TiposServicio, M.Distrito_Ref, M.Direccion_Ref,
                M.FechaVisita_Max, M.Total_Facturado, M.Total_Material_Used,
                CASE WHEN M.Total_Facturado > 0 THEN 1 ELSE 0 END,
                CASE WHEN M.Total_Material_Used > 0 THEN 1 ELSE 0 END,
                CASE WHEN ABS(TRY_CAST(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(P.Importe, '0'), 'S/', ''), ',', ''), CHAR(160), ''), ' ', ''), CHAR(9), '') AS DECIMAL(18,2)) - M.Total_Facturado) >= 1.0 THEN 1 ELSE 0 END,
                P.Aprobacion_Comentario, P.Aprobacion_Por, P.Aprobacion_El
            FROM [dbo].[GAC_APP_TB_TICKETS_PAGOS] P
            OUTER APPLY (
                SELECT 
                    STRING_AGG(CAST(ISNULL(F.NombreTecnico + ' ' + F.ApellidoTecnico, 'SIN TECNICO') AS VARCHAR(MAX)), ' | ') as Tecnicos,
                    STRING_AGG(CAST(ISNULL(F.NombreCliente, 'SIN CLIENTE') AS VARCHAR(MAX)), ' | ') as Clientes,
                    STRING_AGG(CAST(ISNULL(TS.Descripcion, 'SIN TIPO') AS VARCHAR(MAX)), ' | ') as TiposServicio,
                    MAX(ISNULL(F.Distrito, '')) as Distrito_Ref,
                    MAX(ISNULL(F.Calle + ' ' + F.NumeroCalle, '')) as Direccion_Ref,
                    MAX(F.FechaVisita) as FechaVisita_Max,
                    SUM(ISNULL(SAP.Total_Facturado, 0)) as Total_Facturado,
                    SUM(ISNULL(PT.Total_Pagado_Ticket, 0)) as Total_Pagado_Contexto,
                    SUM(ISNULL(SMat.Material_Used_Count, 0)) as Total_Material_Used
                FROM (
                    SELECT LTRIM(RTRIM(value)) as TicketID FROM STRING_SPLIT(P.Ticket, ',')
                ) T
                LEFT JOIN [SIATC].[Dashboard_FSM] F ON T.TicketID = F.Ticket
                LEFT JOIN [SIATC].[FSM_TipoServicio] TS ON F.IdServicio = TS.Id
                OUTER APPLY (
                    SELECT SUM(
                        (ISNULL(V.DE_neto, 0) + ISNULL(V.DE_igv, 0)) * CASE 
                            WHEN V.VC_documento_pago_clase IN ('S2', 'ZNCV', 'ZNCD') THEN -1 
                            WHEN V.VC_documento_pago_clase LIKE 'ZTG%' OR V.VC_anulacion_status = 'X' THEN 0
                            ELSE 1 
                        END
                    ) as Total_Facturado
                    FROM [SAP].[SD_VENTAS] V
                    WHERE LTRIM(RTRIM(V.VC_oden_compra_numero)) = T.TicketID
                       OR (TRY_CAST(LTRIM(RTRIM(V.VC_oden_compra_numero)) AS BIGINT) = TRY_CAST(T.TicketID AS BIGINT) AND TRY_CAST(T.TicketID AS BIGINT) IS NOT NULL)
                ) SAP
                OUTER APPLY (
                    SELECT SUM(TRY_CAST(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(P2.Importe, '0'), 'S/', ''), ',', ''), CHAR(160), ''), ' ', ''), CHAR(9), '') AS DECIMAL(18,2))) as Total_Pagado_Ticket
                    FROM [dbo].[GAC_APP_TB_TICKETS_PAGOS] P2
                    WHERE EXISTS (SELECT 1 FROM STRING_SPLIT(P2.Ticket, ',') S2 WHERE LTRIM(RTRIM(S2.value)) = T.TicketID)
                ) PT
                OUTER APPLY (
                    SELECT COUNT(*) as Material_Used_Count
                    FROM [APPGAC].[ServiciosMateriales] sm 
                    WHERE sm.Ticket = T.TicketID AND ISNULL(sm.Catidad_usada, 0) > 0
                ) SMat
            ) M
            WHERE P.ID_transaccion = @id;
        `);
    } catch (err) {
        console.error('❌ Error syncing payment cache:', err);
    }
}
