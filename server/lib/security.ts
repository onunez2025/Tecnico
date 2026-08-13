// --- SECURITY HELPERS (ver CLAUDE.md) ---
/**
 * Mensaje de error apto para devolver al cliente.
 *
 * El detalle NUNCA sale en la respuesta HTTP: se registra aqui, y solo aqui, para que quede
 * siempre en los logs de Dokploy, que es donde se consulta.
 *
 * Antes esto era `NODE_ENV === 'production' ? ocultar : mostrar`, y esa forma FALLA EN ABIERTO:
 * si la variable falta, filtra. El 2026-08-12 se confirmo que **ninguna app de QA tiene
 * NODE_ENV en Dokploy**, asi que llevaban tiempo devolviendo al cliente el error real —rutas de
 * archivos del servidor, nombres de tablas, estructura interna— en cada 500.
 *
 * Ya no depende de ninguna variable de entorno: no hay configuracion que se pueda olvidar.
 *
 * El log va DENTRO a proposito. De los 464 sitios que llaman a esta funcion en el ecosistema,
 * 242 no registraban el error por su cuenta; dejarla pura habria dejado ciegos esos casos. El
 * coste es alguna linea repetida donde el manejador ya registraba, que es un mal menor frente a
 * perder el error.
 */
export const safeError = (err: unknown): string => {
    console.error('[ERROR]', err instanceof Error ? (err.stack ?? err.message) : err);
    return 'Error interno del servidor';
};

export const sanitizeLog = (val: unknown, maxLen = 200): string =>
    String(val ?? '').replace(/[\r\n\t\x00-\x1F\x7F]/g, ' ').slice(0, maxLen);  // eslint-disable-line no-control-regex

/**
 * Mensaje legible de un error capturado, sin recurrir a `any`.
 *
 * En un `catch` el valor es `unknown`: puede ser un Error, una cadena o cualquier cosa. Tiparlo
 * como `any` hacia que `err.message` compilara siempre, incluso cuando el error no era un Error
 * y la propiedad valia `undefined`.
 */
export const mensajeError = (err: unknown): string =>
    err instanceof Error ? err.message : String(err);

/** Nombre del error (p. ej. 'TokenExpiredError'), o cadena vacia si no lo tiene. */
export const nombreError = (err: unknown): string =>
    err instanceof Error ? err.name : '';

