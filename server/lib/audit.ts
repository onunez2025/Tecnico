import type { AuthenticatedRequest } from '../middleware/auth.js';
import type { Request } from 'express';
import sql from 'mssql';
import { getWritePool } from '../db';

// Helper for Auditing
export async function logAudit(req: Request, action: string, entity: string, entityId: string, details: Record<string, unknown>) {
    try {
        const user = (req as AuthenticatedRequest).user;
        if (!user) return;
        const db = await getWritePool();
        await db.request()
            .input('uid', sql.NVarChar(sql.MAX), String(user.id))
            .input('un', sql.NVarChar(sql.MAX), user.username)
            .input('acc', sql.NVarChar(sql.MAX), action)
            .input('ent', sql.NVarChar(sql.MAX), entity)
            .input('eid', sql.NVarChar(sql.MAX), entityId)
            .input('det', sql.NVarChar(sql.MAX), JSON.stringify(details))
            .input('app', sql.VarChar(20), 'TEC')
            .input('ip', sql.VarChar(50), req.ip || null)
            .query(`INSERT INTO [dbo].[GAC_APP_TB_AUDIT_LOG] (UsuarioID, UsuarioNombre, Accion, Entidad, EntidadID, Detalle, ApplicationCode, IPAddress, Fecha)
                    VALUES (@uid, @un, @acc, @ent, @eid, @det, @app, @ip, GETDATE())`);
    } catch (err) {
        console.error('❌ Falla en Log de Auditoría:', err);
    }
}
