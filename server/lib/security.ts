// --- SECURITY HELPERS (ver CLAUDE.md) ---
export const safeError = (err: unknown): string =>
    process.env.NODE_ENV === 'production'
        ? 'Error interno del servidor'
        : err instanceof Error ? err.message : String(err);

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

