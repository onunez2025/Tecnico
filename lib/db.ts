import sql from 'mssql';
import type { ISqlType } from 'mssql';

/**
 * Wrapper que exige los 3 argumentos de .input() para prevenir type confusion.
 * Usar en todo nuevo código; los endpoints legacy se migran gradualmente.
 */
export function addInput<T>(
    req: sql.Request,
    name: string,
    type: (() => ISqlType) | ISqlType,
    value: T,
): sql.Request {
    return req.input(name, type, value);
}

export { sql };
