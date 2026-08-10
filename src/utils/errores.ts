/**
 * Ayudantes para leer un error capturado sin recurrir a `any`.
 *
 * En un `catch` el valor es `unknown`. Tiparlo como `any` hacia que `err.message` compilara
 * siempre, incluso cuando el error no era un Error y la propiedad valia `undefined`.
 */
export const mensajeError = (err: unknown): string =>
    err instanceof Error ? err.message : String(err);
