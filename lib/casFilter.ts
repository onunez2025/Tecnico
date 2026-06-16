import sql from 'mssql';

export interface CasUser {
    casId: string | null;
}

/**
 * Agrega filtro AND ID_cas = @casId al request SQL para usuarios CAS.
 * Retorna el sufijo WHERE listo para concatenar, o '' si el usuario es Sole.
 *
 * Fase D (evaluado 2026-06-15): Technical es herramienta interna de Sole.
 * EBM.Users no tiene columna cas_id → casId siempre null → filtro siempre vacío.
 * Esta función queda como punto de extensión si en el futuro se agregan usuarios CAS.
 */
export function applyCasIdFilter(
    req: sql.Request,
    user: CasUser,
): string {
    if (!user.casId) return '';
    req.input('casId', sql.VarChar(50), user.casId);
    return ' AND ID_cas = @casId';
}
