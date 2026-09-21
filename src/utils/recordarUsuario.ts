/**
 * «Recordarme» del login: guarda el ÚLTIMO USUARIO que entró para no tener que escribirlo otra vez.
 *
 * Qué NO hace, a propósito:
 *   - **Nunca guarda la contraseña.** De eso se encarga el gestor del navegador, que la cifra con el perfil del
 *     usuario; una copia nuestra en `localStorage` sería texto plano legible por cualquier script de la página.
 *   - **No alarga la sesión.** Cuánto dura la sesión lo decide el token del servidor y el cierre por inactividad que se
 *     configura en SIATC Console; esta casilla no toca ninguno de los dos (decisión de Diego, 2026-09-21).
 *
 * El dato vive en el `localStorage` de cada app, que es propio de su subdominio: cada aplicación recuerda su usuario.
 * Todo va envuelto en `try` porque en ventanas de incógnito, con las cookies de sitio bloqueadas o con el disco lleno,
 * `localStorage` lanza excepción — y no poder recordar un nombre nunca debe impedir entrar.
 */
const CLAVE = 'siatc_ultimo_usuario';

export function usuarioRecordado(): string {
    try {
        return localStorage.getItem(CLAVE) ?? '';
    } catch {
        return '';
    }
}

/** Tras un login correcto: guarda el usuario si la casilla está marcada y lo borra si no. */
export function recordarUsuario(usuario: string, recordar: boolean): void {
    try {
        const limpio = usuario.trim();
        if (recordar && limpio) localStorage.setItem(CLAVE, limpio);
        else localStorage.removeItem(CLAVE);
    } catch {
        /* Sin almacenamiento disponible: no se recuerda, pero la sesión sigue igual. */
    }
}
