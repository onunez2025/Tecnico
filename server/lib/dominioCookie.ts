/**
 * Dominio con el que se escribe la cookie de sesion SSO, derivado del HOST DE LA PETICION.
 *
 * `process.env.COOKIE_DOMAIN` sigue mandando si esta definida: se conserva como anulacion manual.
 * Pero depender SOLO de ella significa que basta olvidarla en un despliegue para que QA vuelva a
 * escribir la cookie en el dominio de produccion, en silencio y sin error. Eso es lo que pasaba.
 *
 * EL ORDEN IMPORTA: "flow.qa.siatc.cloud" tambien termina en ".siatc.cloud", asi que preguntar
 * primero por produccion da verdadero en QA y no separa nada. QA se comprueba PRIMERO.
 */
export function dominioCookie(req: { headers: Record<string, unknown> }): string | undefined {
    // .trim(): un espacio al final en Dokploy produce el dominio ".qa.siatc.cloud " y el navegador
    // acaba con DOS cookies `token` (una por dominio), de las que se lee la equivocada. Falla en
    // silencio y no se ve en ningun log.
    const manual = process.env.COOKIE_DOMAIN?.trim();
    if (manual) return manual;
    const reenviado = req.headers['x-forwarded-host'];
    const original = req.headers.host;
    const host = String((typeof reenviado === 'string' ? reenviado : original) ?? '');
    const nombre = host.split(':')[0].toLowerCase();
    if (nombre.endsWith('.qa.siatc.cloud')) return '.qa.siatc.cloud';
    if (nombre.endsWith('.siatc.cloud')) return '.siatc.cloud';
    return undefined;
}
