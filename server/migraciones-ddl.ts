/**
 * Migraciones de esquema (DDL) de Technical — SCRIPT MANUAL, no lo importa el servidor.
 *
 * `runMigrations()` mezclaba doce pasos: cinco cambiaban el ESQUEMA (ALTER/CREATE TABLE) y siete
 * eran DATOS (permisos, visibilidad de roles, configuracion por defecto). Los cinco de esquema
 * obligaban a la aplicacion a conectarse con el usuario administrador antiguo en cada arranque.
 *
 * Se comprobo contra la base el 2026-08-11 que las cuatro columnas y la tabla ya existen: los
 * cinco pasos llevaban meses preguntando sin hacer nada.
 *
 * Los siete pasos de datos SIGUEN ejecutandose al arrancar, ahora con `siatc_writer`, que si
 * puede hacerlos. Ver `sincronizarDatos()` en index.ts.
 *
 * Para una migracion de esquema nueva: se anade aqui y se ejecuta a mano UNA vez.
 *
 *     npx tsx server/migraciones-ddl.ts
 *
 * Requiere DB_USER y DB_PASSWORD (el usuario con permiso de DDL) en el entorno.
 */
import './lib/env.js';
import sql from 'mssql';

const PASOS: Array<{ nombre: string; sql: string }> = [
    {
        nombre: 'Add Apps to EBM.Roles',
        sql: `IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('EBM.Roles') AND name = 'Apps')
                  BEGIN ALTER TABLE EBM.Roles ADD Apps NVARCHAR(200) NOT NULL DEFAULT 'EBM'; END`,
    },
    {
        nombre: 'Add Apps to EBM.Users',
        sql: `IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('EBM.Users') AND name = 'Apps')
                  BEGIN ALTER TABLE EBM.Users ADD Apps NVARCHAR(200) NULL DEFAULT 'TEC'; END`,
    },
    {
        nombre: 'Add RequiresPasswordChange to EBM.Users',
        sql: `IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('EBM.Users') AND name = 'RequiresPasswordChange')
                  BEGIN ALTER TABLE EBM.Users ADD RequiresPasswordChange BIT NOT NULL DEFAULT 0; END`,
    },
    {
        nombre: 'Add CreatedAt to EBM.Users',
        sql: `IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('EBM.Users') AND name = 'CreatedAt')
                  BEGIN ALTER TABLE EBM.Users ADD CreatedAt DATETIME NULL DEFAULT GETDATE(); END`,
    },
    {
        nombre: 'Create GAC_APP_TB_CONFIG table',
        sql: `IF OBJECT_ID('dbo.GAC_APP_TB_CONFIG', 'U') IS NULL
                  BEGIN
                    CREATE TABLE [dbo].[GAC_APP_TB_CONFIG] (
                      [Clave] NVARCHAR(100) PRIMARY KEY,
                      [Valor] NVARCHAR(255) NOT NULL,
                      [Descripcion] NVARCHAR(500) NULL,
                      [Actualizado_el] DATETIME DEFAULT GETDATE(),
                      [Actualizado_por] NVARCHAR(100) NULL
                    );
                  END`,
    }
];

async function migrar(): Promise<void> {
    if (!process.env.DB_USER || !process.env.DB_PASSWORD) {
        throw new Error(
            'Faltan DB_USER / DB_PASSWORD. Este script necesita el usuario con permiso de DDL; ' +
            'siatc_reader y siatc_writer no pueden modificar el esquema.'
        );
    }
    const pool = await new sql.ConnectionPool({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        server: process.env.DB_SERVER || '',
        options: { encrypt: true, trustServerCertificate: false },
    }).connect();

    for (const paso of PASOS) {
        await pool.request().query(paso.sql);
        console.log(`[Migracion] ${paso.nombre} — OK`);
    }
    await pool.close();
    console.log(`[Migracion] ${PASOS.length} pasos completados.`);
}

migrar().catch(err => {
    console.error('[Migracion] Error:', err instanceof Error ? err.message : err);
    process.exit(1);
});
