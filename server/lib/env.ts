// Carga del .env, DELIBERADAMENTE en su propio modulo.
//
// En ES modules los modulos importados se evaluan ANTES que el cuerpo del que los importa. Con
// dotenv.config() en el cuerpo de index.ts, todo lo que lea process.env a nivel de modulo
// (db.ts, middleware/auth.ts, routes/auth.ts, lib/config.ts) se evaluaba con el entorno todavia
// sin cargar. En el monolito no pasaba: dotenv.config() estaba unas lineas por encima de esas
// mismas constantes, en el mismo archivo.
//
// El sintoma fue IS_PRODUCTION = false dentro de routes/auth.ts y true en index.ts, con lo que la
// cookie compartida del SSO no se escribia y el salto entre apps de QA pedia login otra vez.
//
// Este modulo tiene que ser el PRIMER import de index.ts. No mover.
import dotenv from 'dotenv';

dotenv.config();

/**
 * Secreto de firma de los JWT.
 *
 * Falla al ARRANCAR si no esta definido, en cualquier entorno y sin mirar `NODE_ENV`.
 *
 * Antes cada app del ecosistema tenia su propia variante: unas caian a un secreto de relleno
 * escrito en el repositorio, otras a cadena vacia, y las que comprobaban lo hacian solo si
 * `NODE_ENV === 'production'`. Ese ultimo caso es el peligroso: si falta la variable NODE_ENV
 * —le paso a Technical en QA— la app arranca firmando tokens con una cadena publica y no hay
 * ni un log que lo avise. Cualquiera que lea el repo puede fabricarse un token valido.
 *
 * No arrancar es la unica respuesta correcta: tampoco tiene sentido levantar el entorno local
 * firmando con un secreto que todo el mundo conoce.
 */
if (!process.env.JWT_SECRET) {
    throw new Error(
        'CRITICAL: falta la variable de entorno JWT_SECRET. La aplicacion no arranca sin secreto ' +
        'de firma; continuar significaria emitir tokens que cualquiera podria falsificar.'
    );
}

export const JWT_SECRET: string = process.env.JWT_SECRET;

/**
 * Credenciales de base de datos de privilegio minimo (Etapa 6).
 *
 * `siatc_reader` solo lee y `siatc_writer` lee y escribe. La idea es que una inyeccion SQL en un
 * endpoint de consulta no pueda escribir nada, porque la conexion que usa no tiene permiso ni
 * para intentarlo.
 *
 * Hasta ahora `db.ts` hacia `process.env.DB_USER_READ || process.env.DB_USER`: si faltaba
 * cualquiera de las cuatro variables, la aplicacion **volvia al usuario administrador anterior
 * sin decir nada**. Ese respaldo tenia sentido mientras se desplegaba la Etapa 6 y las variables
 * todavia no estaban en Dokploy. Ya lo estan en las once, asi que ahora es solo una puerta
 * abierta: un despliegue al que se le olvide una variable perderia la separacion de privilegios
 * y nadie se enteraria, porque todo seguiria funcionando igual.
 *
 * No arrancar es preferible a arrancar como administrador creyendo que no lo eres.
 */
const CREDENCIALES_BD = ['DB_USER_READ', 'DB_PASS_READ', 'DB_USER_WRITE', 'DB_PASS_WRITE'] as const;
const credencialesQueFaltan = CREDENCIALES_BD.filter(v => !process.env[v]);
if (credencialesQueFaltan.length > 0) {
    throw new Error(
        `CRITICAL: faltan las variables de entorno ${credencialesQueFaltan.join(', ')}. La ` +
        'aplicacion no arranca sin los usuarios de privilegio minimo de la Etapa 6; continuar ' +
        'significaria conectarse a la base con el usuario administrador antiguo.'
    );
}
