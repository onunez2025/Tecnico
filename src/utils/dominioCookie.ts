/**
 * Dominio con el que se escribe la cookie de sesión SSO, derivado del **hostname en tiempo de
 * ejecución**.
 *
 * ## Por qué no una variable de entorno
 *
 * Antes esto salía de `import.meta.env.VITE_COOKIE_DOMAIN`. Las variables `VITE_*` se **incrustan
 * al compilar**, no se leen al ejecutar: si no está definida en el build —y no lo estaba en el de
 * QA— la expresión queda fijada en su valor de respaldo y no hay forma de corregirlo sin volver a
 * compilar. Verificado sobre el bundle desplegado: `COOKIE_DOMAIN` había quedado en
 * `".siatc.cloud"`.
 *
 * El navegador siempre sabe en qué host está. Esto no se puede optimizar fuera ni depende de que
 * alguien recuerde configurar una variable en cada despliegue de cada app.
 *
 * ## El orden de las comprobaciones importa
 *
 * `flow.qa.siatc.cloud` **también** termina en `.siatc.cloud`. Un chequeo que pregunte primero por
 * el dominio de producción da verdadero en QA y no separa nada — que es exactamente lo que pasaba
 * con el `isProd` anterior. **QA se comprueba primero, siempre.**
 */

/** Dominio de la cookie SSO, o `null` cuando no corresponde ponerle `domain` (desarrollo local). */
export function dominioCookie(hostname: string = window.location.hostname): string | null {
    if (hostname.endsWith('.qa.siatc.cloud')) return '.qa.siatc.cloud';
    if (hostname.endsWith('.siatc.cloud')) return '.siatc.cloud';
    return null;
}

/**
 * `true` cuando la pagina corre en el dominio QA aislado.
 *
 * Se usa para decidir si escribir la cookie SSO compartida. La version anterior preguntaba por
 * `import.meta.env.VITE_COOKIE_DOMAIN`, que no estaba definida en el build de QA: la expresion
 * valia `undefined`, `skipSharedCookie` quedaba en `true` y **en QA nunca se escribia la cookie
 * compartida**, justo lo contrario de lo que buscaba esa logica.
 *
 * Ahora que el dominio esta aislado, escribirla en QA no puede tocar sesiones de produccion.
 */
export const esQa = (hostname: string = window.location.hostname): boolean =>
    hostname.endsWith('.qa.siatc.cloud');

/** `true` en cualquier despliegue real (QA o producción); `false` en local. */
export const esDespliegueReal = (hostname: string = window.location.hostname): boolean =>
    dominioCookie(hostname) !== null;

/** Fragmento `; domain=...` listo para concatenar, vacío si no corresponde. */
export function fragmentoDominio(hostname: string = window.location.hostname): string {
    const dominio = dominioCookie(hostname);
    return dominio ? `; domain=${dominio}` : '';
}

/**
 * Clave de la limpieza única de la cookie heredada.
 *
 * Sube de versión solo si hiciera falta repetir la limpieza en todos los navegadores.
 */
const CLAVE_MIGRACION = 'siatc_cookie_migrada_v1';

/**
 * Borra **una sola vez por navegador** la cookie `token` que QA venía escribiendo en
 * `.siatc.cloud`, el dominio compartido con producción.
 *
 * ## Por qué hace falta
 *
 * Hasta ahora QA escribía en `.siatc.cloud` porque el chequeo de entorno estaba mal. Al pasar a
 * `.qa.siatc.cloud`, las dos cookies **coexisten con el mismo nombre** y el lector toma la primera
 * que devuelve el navegador, cuyo orden no controlamos: se puede leer un token viejo y quedar con
 * una sesión zombi, o no poder entrar.
 *
 * ## Por qué una sola vez y no en cada arranque
 *
 * Desde QA sí se puede borrar la cookie de `.siatc.cloud` —es dominio padre de
 * `flow.qa.siatc.cloud`—, pero hacerlo siempre significaría que **entrar a QA cierra la sesión de
 * producción** cada vez. Con la marca en `localStorage` la limpieza ocurre en la primera carga tras
 * el despliegue y después los dos entornos quedan independientes, que es el objetivo.
 *
 * En producción no se hace nada: una página en `.siatc.cloud` no puede tocar cookies de
 * `.qa.siatc.cloud` —no es dominio padre suyo— y tampoco lo necesita.
 */
export function limpiarCookieHeredada(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    if (!window.location.hostname.endsWith('.qa.siatc.cloud')) return;
    if (localStorage.getItem(CLAVE_MIGRACION)) return;

    document.cookie = 'token=; path=/; domain=.siatc.cloud; max-age=0; SameSite=Lax; Secure=true';
    localStorage.setItem(CLAVE_MIGRACION, '1');
}
