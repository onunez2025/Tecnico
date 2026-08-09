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
