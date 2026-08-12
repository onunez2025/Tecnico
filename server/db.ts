import { mensajeError } from './lib/security.js';
import sql from 'mssql';

// Base comun de los dos pools reales. SIN credenciales: cada pool pone las suyas. El usuario
// administrador ya no lo usa el servidor — ver server/migraciones-ddl.ts.
const dbConfig: sql.config = {
    database: process.env.DB_DATABASE,
    server: process.env.DB_SERVER || '',
    port: 1433,
    pool: { max: 30, min: 0, idleTimeoutMillis: 30000 },
    options: { encrypt: true, trustServerCertificate: false, requestTimeout: 60000 }
};

// Etapa 6 -- usuarios de BD de privilegio minimo (siatc_reader/siatc_writer).
//
// Aqui habia un respaldo `|| process.env.DB_USER` para poder desplegar este codigo antes de
// tener las variables en Dokploy. Ya estan en las once apps, y mantenerlo solo dejaba una
// puerta abierta: un despliegue al que se le olvidara una variable volveria al usuario
// administrador antiguo sin avisar de nada, funcionando igual de bien. Retirado.
//
// Ahora la ausencia de cualquiera de las cuatro se detecta al arrancar, en lib/env.ts, con un
// mensaje que dice cual falta.
const readDbConfig: sql.config = {
    ...dbConfig,
    user: process.env.DB_USER_READ,
    password: process.env.DB_PASS_READ,
};
const writeDbConfig: sql.config = {
    ...dbConfig,
    user: process.env.DB_USER_WRITE,
    password: process.env.DB_PASS_WRITE,
};

let readPool: sql.ConnectionPool | null = null;
let writePool: sql.ConnectionPool | null = null;

/** Endpoints GET -- solo lectura, usa siatc_reader (privilegio minimo). */
async function getReadPool() {
    if (!readPool || !readPool.connected) {
        try {
            readPool = await new sql.ConnectionPool(readDbConfig).connect();
            readPool.on('error', (err: Error) => {
                console.error('❌ DB Read Pool error:', err.message);
                readPool = null;
            });
        } catch (err: unknown) {
            console.error('❌ Error de conexión DB (read pool):', mensajeError(err));
            readPool = null;
            throw err;
        }
    }
    return readPool;
}

/** Endpoints POST/PUT/DELETE/PATCH -- usa siatc_writer (lectura + escritura en dbo/EBM). */
async function getWritePool() {
    if (!writePool || !writePool.connected) {
        try {
            writePool = await new sql.ConnectionPool(writeDbConfig).connect();
            writePool.on('error', (err: Error) => {
                console.error('❌ DB Write Pool error:', err.message);
                writePool = null;
            });
        } catch (err: unknown) {
            console.error('❌ Error de conexión DB (write pool):', mensajeError(err));
            writePool = null;
            throw err;
        }
    }
    return writePool;
}

export { getReadPool, getWritePool };
