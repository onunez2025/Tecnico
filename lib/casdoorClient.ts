const CASDOOR_ENDPOINT = process.env.CASDOOR_ENDPOINT || 'https://auth.siatc.cloud';
const CASDOOR_CLIENT_ID = process.env.CASDOOR_CLIENT_ID || '';
const CASDOOR_CLIENT_SECRET = process.env.CASDOOR_CLIENT_SECRET || '';
const CASDOOR_REDIRECT_URI = process.env.CASDOOR_REDIRECT_URI || '';

export interface CasdoorUserInfo {
    sub: string;
    name?: string;
    preferred_username?: string;
    email?: string;
    email_verified?: boolean;
}

/**
 * Intercambia el authorization code de Casdoor por un access_token,
 * siguiendo el flujo estándar OAuth2 Authorization Code (RFC 6749).
 */
export async function exchangeCodeForToken(code: string): Promise<string> {
    const response = await fetch(`${CASDOOR_ENDPOINT}/api/login/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: CASDOOR_CLIENT_ID,
            client_secret: CASDOOR_CLIENT_SECRET,
            code,
            redirect_uri: CASDOOR_REDIRECT_URI,
        }),
    });

    if (!response.ok) {
        throw new Error(`Casdoor token exchange failed: ${response.status}`);
    }

    const data = await response.json() as { access_token?: string; error?: string };
    if (!data.access_token) {
        throw new Error(`Casdoor token exchange error: ${data.error || 'no access_token in response'}`);
    }
    return data.access_token;
}

/** Consulta el perfil verificado del usuario contra el endpoint userinfo de Casdoor. */
export async function getCasdoorUserInfo(accessToken: string): Promise<CasdoorUserInfo> {
    const response = await fetch(`${CASDOOR_ENDPOINT}/api/userinfo`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
        throw new Error(`Casdoor userinfo request failed: ${response.status}`);
    }

    return response.json() as Promise<CasdoorUserInfo>;
}

// Nombres exactos de los Providers configurados en Casdoor (Identity > Providers).
// Si se renombran ahí, hay que actualizar este mapa.
const PROVIDER_NAMES: Record<string, string> = {
    google: 'Google Auth',
    microsoft: 'Azure Auth',
};

/**
 * Arma la URL de autorización de Casdoor. Si se pasa un `provider` ('google' o
 * 'microsoft'), agrega `provider_hint` para saltar la pantalla de selección de
 * Casdoor y redirigir directo a ese proveedor.
 */
export function getCasdoorAuthorizeUrl(state: string, provider?: string): string {
    const params = new URLSearchParams({
        client_id: CASDOOR_CLIENT_ID,
        response_type: 'code',
        redirect_uri: CASDOOR_REDIRECT_URI,
        scope: 'openid profile email',
        state,
    });
    const providerName = provider ? PROVIDER_NAMES[provider] : undefined;
    if (providerName) params.set('provider_hint', providerName);
    return `${CASDOOR_ENDPOINT}/login/oauth/authorize?${params.toString()}`;
}
