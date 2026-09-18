/**
 * Plantilla de correo del ecosistema SIATC — tokens + armado del HTML.
 *
 * ⚠️ ARCHIVO COMPARTIDO. El original vive en SIATC-App-Template (server/lib/correo/) y cada app
 * lleva una copia IDÉNTICA: no se edita aquí, se edita en la plantilla y se vuelve a copiar.
 * Es la «opción A» (copia vigilada) que eligió Diego el 2026-09-18; cuando esté validada, todo lo
 * tokenizado del ecosistema pasará a un paquete privado en el registro de Forgejo (opción B).
 *
 * Reglas del diseño (el mismo aspecto que ya tenían los correos del SSO de Console):
 *   - Franja superior del color de la variante con el logo blanco de Grupo Sole, tarjeta con
 *     borde gris y la firma de la Gerencia al pie.
 *   - Maquetado con <table> y estilos en línea: Outlook ignora <style>, flex y casi todo el CSS
 *     moderno. Nada de clases.
 *   - Todo texto que venga de datos (nombres, errores, tickets) pasa por `escaparHtml`. Los
 *     helpers de este archivo ya escapan; el HTML libre de `cuerpoHtml` es responsabilidad de
 *     quien lo arma.
 */

/** Colores por intención. El nombre dice qué comunica el correo, no de qué color es. */
export const VARIANTE_CORREO = {
    /** Algo dejó de funcionar o se rechazó (rojo). */
    problema: '#dc2626',
    /** Algo se aprobó o se restableció (verde). */
    restablecido: '#16a34a',
    /** Aviso operativo sin urgencia: envíos a los CAS, reportes (azul pizarra corporativo). */
    informativo: '#4C5F80',
    /** Acuse de recibo, pendiente de revisión (gris pizarra). */
    neutro: '#64748b',
    /** Atención: queda poco margen (ámbar). */
    advertencia: '#a16207',
    /** Último aviso antes de un bloqueo (naranja). */
    urgente: '#ea580c',
} as const;

export type VarianteCorreo = keyof typeof VARIANTE_CORREO;

export const TOKENS_CORREO = {
    ANCHO: 480,
    FUENTE: 'Arial, Helvetica, sans-serif',
    TEXTO: '#1f2937',
    TEXTO_SUAVE: '#6b7280',
    BORDE: '#e5e7eb',
    FONDO_DATOS: '#f9fafb',
    LOGO_URL: 'https://res.cloudinary.com/dvfljye2u/image/upload/v1781643958/Logo_-_Grupo_Sole_-_Transparente_blanco-_of11va.png',
    FIRMA: 'Gerencia de Atención al Cliente - Grupo Sole Rinnai Corporation',
} as const;

const T = TOKENS_CORREO;

/** Escapa un texto para insertarlo en HTML. `null`/`undefined` se vuelven cadena vacía. */
export function escaparHtml(valor: unknown): string {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Párrafo de texto plano (se escapa). */
export function parrafo(texto: string): string {
    return `<p style="margin: 0 0 12px; font-size: 14px; line-height: 1.5;">${escaparHtml(texto)}</p>`;
}

/**
 * Texto de varios párrafos (se escapa): una línea en blanco separa párrafos y un salto simple
 * se respeta como salto de línea. Para cuerpos que vienen de una plantilla editable.
 */
export function parrafos(texto: string): string {
    return String(texto ?? '')
        .replace(/\r\n/g, '\n')
        .split(/\n\s*\n/)
        .map(bloque => bloque.trim())
        .filter(Boolean)
        .map(bloque => `<p style="margin: 0 0 12px; font-size: 14px; line-height: 1.5;">${escaparHtml(bloque).replace(/\n/g, '<br>')}</p>`)
        .join('');
}

/**
 * Tabla de datos etiqueta → valor, sobre fondo gris claro. Los valores se escapan; una fila con
 * valor vacío se omite para no mostrar etiquetas sin nada al lado.
 */
export function tablaDatos(filas: Array<[string, string | number | null | undefined]>): string {
    const visibles = filas.filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '');
    if (visibles.length === 0) return '';
    const tr = visibles.map(([etiqueta, valor]) => `
            <tr>
                <td style="padding: 6px 12px; font-size: 12px; color: ${T.TEXTO_SUAVE}; white-space: nowrap; vertical-align: top;">${escaparHtml(etiqueta)}</td>
                <td style="padding: 6px 12px; font-size: 13px; color: ${T.TEXTO}; font-weight: bold; vertical-align: top;">${escaparHtml(valor)}</td>
            </tr>`).join('');
    return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="border-collapse: collapse; background: ${T.FONDO_DATOS}; border: 1px solid ${T.BORDE}; border-radius: 8px; margin: 4px 0 16px;">
            ${tr}
        </table>`;
}

export interface OpcionesCorreo {
    variante: VarianteCorreo;
    /** Título grande dentro de la tarjeta (se escapa). */
    titulo: string;
    /** HTML del cuerpo. Armarlo con `parrafo`/`tablaDatos` o escapar a mano los datos. */
    cuerpoHtml: string;
    /** Por qué recibe este correo (se escapa). Va encima de la firma. */
    pie: string;
}

/** Documento HTML completo del correo, listo para enviar. */
export function plantillaCorreo({ variante, titulo, cuerpoHtml, pie }: OpcionesCorreo): string {
    const color = VARIANTE_CORREO[variante];
    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escaparHtml(titulo)}</title></head>
<body style="margin: 0; padding: 0; background: #ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
    <tr><td align="center" style="padding: 16px 8px;">
        <table role="presentation" width="${T.ANCHO}" cellpadding="0" cellspacing="0" border="0"
               style="border-collapse: separate; width: 100%; max-width: ${T.ANCHO}px; font-family: ${T.FUENTE}; color: ${T.TEXTO};">
            <tr>
                <td style="background: ${color}; padding: 16px 28px; border-radius: 10px 10px 0 0;">
                    <img src="${T.LOGO_URL}" alt="Grupo Sole" height="28" style="height: 28px; width: auto; display: block; border: 0;" />
                </td>
            </tr>
            <tr>
                <td style="border: 1px solid ${T.BORDE}; border-top: none; border-radius: 0 0 10px 10px; padding: 28px;">
                    <h1 style="font-size: 18px; line-height: 1.3; margin: 0 0 16px; color: ${T.TEXTO};">${escaparHtml(titulo)}</h1>
                    ${cuerpoHtml}
                    <p style="margin: 24px 0 0; padding-top: 16px; border-top: 1px solid ${T.BORDE}; font-size: 11px; line-height: 1.5; color: ${T.TEXTO_SUAVE};">
                        ${escaparHtml(pie)}<br><br>${escaparHtml(T.FIRMA)}
                    </p>
                </td>
            </tr>
        </table>
    </td></tr>
</table>
</body>
</html>`;
}
