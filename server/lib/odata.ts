/**
 * Construcción de filtros `$filter` de OData para SAP C4C.
 *
 * C4C delimita los literales de texto con comillas simples, y una comilla dentro del valor se escapa
 * DUPLICÁNDOLA (regla estándar de OData). Interpolar el valor a pelo —`` `ID eq '${id}'` ``— deja que
 * un dato con una comilla rompa la consulta o, peor, altere el filtro: un valor como `' or ID ne '`
 * convierte la condición en otra distinta y C4C devuelve registros que no tocaban.
 *
 * Detectado el 2026-09-22 comparando con el paquete `c4c-client` de Cero Contacto, que sí escapaba;
 * en el ecosistema había 19 puntos que no. Ver en SIATC Memory
 * `auditorias-analisis/Cero-Contacto-Que-Adoptar-en-SIATC.md`.
 *
 * Este fichero es una copia por repositorio a la espera del paquete compartido `@siatc/c4c-client`.
 */

/** Literal de texto listo para un `$filter`, con las comillas internas ya escapadas. */
export function literalOData(valor: unknown): string {
    return `'${String(valor ?? '').replace(/'/g, "''")}'`;
}

/** `campo eq 'valor'`, con el valor escapado. */
export function igualA(campo: string, valor: unknown): string {
    return `${campo} eq ${literalOData(valor)}`;
}

/** Une cláusulas con `or`; envuelve en paréntesis solo si hay más de una, para no alterar la precedencia. */
export function alguno(...clausulas: string[]): string {
    const utiles = clausulas.filter(Boolean);
    if (utiles.length <= 1) return utiles[0] ?? '';
    return `(${utiles.join(' or ')})`;
}
