// Constantes de configuracion compartidas entre index.ts y los routers.
// El aviso de arranque de APPSHEET_PDF_PATH se queda en index.ts, en su posicion original: aqui
// solo vive el valor, para que index.ts y ticketsPagos.ts lean exactamente el mismo.
export const APP_IDENTIFIER = 'TEC';
export const APPSHEET_PDF_PATH = process.env.APPSHEET_PDF_PATH ?? '';

// `C4C_BASE_URL` y `C4C_AUTH` vivían aquí como constantes de módulo, que es exactamente el patrón que se
// evalúa ANTES de que index.ts llame a dotenv — el mismo que rompió el SSO de esta aplicación con `tsc`
// en verde. Las credenciales las lee ahora `@siatc/c4c-client` dentro de la función, con el entorno ya
// cargado. No volver a poner aquí nada que dependa de process.env de forma inmediata.
