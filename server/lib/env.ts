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
