import nodemailer from 'nodemailer';
import { ConfidentialClientApplication } from '@azure/msal-node';

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const MAIL_FROM = process.env.SMTP_FROM || SMTP_USER;

const MS_GRAPH_TENANT_ID = process.env.MS_GRAPH_TENANT_ID || '';
const MS_GRAPH_CLIENT_ID = process.env.MS_GRAPH_CLIENT_ID || '';
const MS_GRAPH_CLIENT_SECRET = process.env.MS_GRAPH_CLIENT_SECRET || '';
const MS_GRAPH_SENDER_EMAIL = process.env.MS_GRAPH_SENDER_EMAIL || '';

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
let msalApp: ConfidentialClientApplication | null = null;

function getTransporter() {
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_PORT === 465,
            auth: { user: SMTP_USER, pass: SMTP_PASS },
        });
    }
    return transporter;
}

/**
 * Envía vía Microsoft Graph API (OAuth2 client credentials) — mismo patrón que
 * ya usa Gestor FSM. Requiere una app registrada en Entra ID con permiso de
 * aplicación Mail.Send, validada por el área de TI de Sole.
 */
async function sendMailViaGraph(to: string, subject: string, html: string): Promise<boolean> {
    if (!MS_GRAPH_TENANT_ID || !MS_GRAPH_CLIENT_ID || !MS_GRAPH_CLIENT_SECRET || !MS_GRAPH_SENDER_EMAIL) {
        return false;
    }
    try {
        if (!msalApp) {
            msalApp = new ConfidentialClientApplication({
                auth: {
                    clientId: MS_GRAPH_CLIENT_ID,
                    authority: `https://login.microsoftonline.com/${MS_GRAPH_TENANT_ID}`,
                    clientSecret: MS_GRAPH_CLIENT_SECRET,
                },
            });
        }
        const tokenResponse = await msalApp.acquireTokenByClientCredential({
            scopes: ['https://graph.microsoft.com/.default'],
        });
        if (!tokenResponse?.accessToken) throw new Error('No se pudo obtener el token de acceso de Graph');

        const message = {
            message: {
                subject,
                body: { contentType: 'HTML', content: html },
                toRecipients: [{ emailAddress: { address: to } }],
            },
            saveToSentItems: 'true',
        };

        const response = await fetch(`https://graph.microsoft.com/v1.0/users/${MS_GRAPH_SENDER_EMAIL}/sendMail`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${tokenResponse.accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
        });

        if (!response.ok) throw new Error(`Graph API respondió ${response.status}: ${await response.text()}`);
        return true;
    } catch (err) {
        console.error('[Mailer] Error enviando vía Microsoft Graph, se intentará SMTP:', err);
        return false;
    }
}

async function sendMailViaSmtp(to: string, subject: string, html: string): Promise<boolean> {
    const t = getTransporter();
    if (!t) return false;
    try {
        await t.sendMail({ from: MAIL_FROM, to, subject, html });
        return true;
    } catch (err) {
        console.error('[Mailer] Error enviando vía SMTP:', err);
        return false;
    }
}

/**
 * Función maestra de envío: intenta Microsoft Graph primero (OAuth2, validado
 * por TI), y si falla o no está configurado cae a SMTP (Nodemailer) — mismo
 * orden de prioridad que ya usa Gestor FSM.
 */
async function sendMail(to: string, subject: string, html: string): Promise<void> {
    if (await sendMailViaGraph(to, subject, html)) return;
    if (await sendMailViaSmtp(to, subject, html)) return;
    console.warn('[Mailer] Ni Graph ni SMTP están configurados/disponibles — correo no enviado:', subject, 'para', to);
}

const SOLE_LOGO_URL = 'https://res.cloudinary.com/dvfljye2u/image/upload/v1781643958/Logo_-_Grupo_Sole_-_Transparente_blanco-_of11va.png';

const FOOTER_SIGNATURE = 'Gerencia de Atención al Cliente - Grupo Sole Rinnai Corporation';

function wrapEmail(title: string, accentColor: string, bodyHtml: string, footerText: string): string {
    return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
        <div style="background: ${accentColor}; padding: 16px 28px; border-radius: 10px 10px 0 0;">
            <img src="${SOLE_LOGO_URL}" alt="Grupo Sole" height="28" style="height: 28px; width: auto; display: block;" />
        </div>
        <div style="border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; padding: 28px;">
            <h1 style="font-size: 18px; margin: 0 0 16px;">${title}</h1>
            ${bodyHtml}
            <p style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #6b7280;">
                ${footerText}<br><br>${FOOTER_SIGNATURE}
            </p>
        </div>
    </div>`;
}

// Nota: los correos de aprobación/rechazo se envían desde SIATC Console — la
// gestión de Solicitudes SSO está centralizada ahí (igual que Usuarios/Roles).
// Esta app solo notifica el lado de la solicitud (pendiente / reintentos).

export async function sendSsoPendingEmail(to: string, appLabel: string): Promise<void> {
    await sendMail(
        to,
        `Solicitud recibida — ${appLabel}`,
        wrapEmail(
            'Solicitud de acceso recibida', '#64748b',
            `<p style="margin: 0 0 12px;">Hola,</p>
             <p style="margin: 0 0 12px;">Recibimos tu solicitud de acceso a la plataforma SIATC usando tu cuenta de Google/Microsoft.</p>
             <p style="margin: 0;">Un administrador debe revisarla y aprobarla antes de que puedas ingresar. Te avisaremos por este mismo correo apenas se resuelva.</p>`,
            'Recibes este correo electrónico porque se solicitó el acceso a la plataforma SIATC. Si no fuiste tú quien solicitó el acceso, ignora este correo. No respondas a este mensaje.'
        )
    );
}

export async function sendSsoFirstRetryEmail(to: string, appLabel: string): Promise<void> {
    await sendMail(
        to,
        `Reintento de solicitud registrado — ${appLabel}`,
        wrapEmail(
            'Volviste a solicitar acceso', '#a16207',
            `<p style="margin: 0 0 12px;">Hola,</p>
             <p style="margin: 0 0 12px;">Registramos tu nueva solicitud de acceso a la plataforma SIATC. Es tu <strong>primer reintento</strong> tras un rechazo anterior.</p>
             <p style="margin: 0;">Un administrador debe revisarla de nuevo. Te avisaremos por este mismo correo apenas se resuelva. Te queda <strong>1 reintento más</strong> si esta también fuera rechazada.</p>`,
            'Recibes este correo electrónico porque se volvió a solicitar el acceso a la plataforma SIATC. Si no fuiste tú, ignora este correo. No respondas a este mensaje.'
        )
    );
}

export async function sendSsoFinalRetryEmail(to: string, appLabel: string): Promise<void> {
    await sendMail(
        to,
        `Último reintento de solicitud registrado — ${appLabel}`,
        wrapEmail(
            'Volviste a solicitar acceso (último intento)', '#ea580c',
            `<p style="margin: 0 0 12px;">Hola,</p>
             <p style="margin: 0 0 12px;">Registramos tu nueva solicitud de acceso a la plataforma SIATC. Es tu <strong>último reintento</strong> disponible.</p>
             <p style="margin: 0;">Un administrador debe revisarla de nuevo. Si esta solicitud también fuera rechazada, no podrás volver a solicitar acceso por este medio — deberás comunicarte directamente con el administrador de tu área.</p>`,
            'Recibes este correo electrónico porque se volvió a solicitar el acceso a la plataforma SIATC. Si no fuiste tú, ignora este correo. No respondas a este mensaje.'
        )
    );
}
