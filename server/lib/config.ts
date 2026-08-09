// Constantes de configuracion compartidas entre index.ts y los routers.
// El aviso de arranque de APPSHEET_PDF_PATH se queda en index.ts, en su posicion original: aqui
// solo vive el valor, para que index.ts y ticketsPagos.ts lean exactamente el mismo.
export const APP_IDENTIFIER = 'TEC';
export const APPSHEET_PDF_PATH = process.env.APPSHEET_PDF_PATH ?? '';
export const C4C_BASE_URL = process.env.C4C_BASE_URL;
export const C4C_AUTH = Buffer.from(`${process.env.C4C_USER || ''}:${process.env.C4C_PASSWORD || ''}`).toString('base64');
