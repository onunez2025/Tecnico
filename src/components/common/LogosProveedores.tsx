/**
 * Logos de los proveedores de identidad (Google y Microsoft) para los botones de SSO.
 *
 * ── Por que este fichero existe ──────────────────────────────────────────────────────────────
 * Los dos SVG estaban copiados literalmente en `LoginPage` y en `SsoStatusPage`. Ademas de ser
 * duplicacion, arrastraban ocho colores en crudo a cada pagina.
 *
 * ── Por que aqui SI hay colores en crudo ─────────────────────────────────────────────────────
 * Son **marcas registradas de terceros**. El azul de Google es `#4285F4` y no puede convertirse
 * en un token del tema, porque NO debe cambiar con el modo oscuro ni con un cambio de marca
 * nuestro: las guias de ambos proveedores exigen reproducir el logo con sus colores exactos.
 *
 * Por eso este fichero esta en la lista de excepciones de `no-restricted-syntax`, igual que
 * `siatc-theme.ts`: es el sitio donde los colores se DEFINEN, no donde se usan al azar.
 */
import React from 'react';

/** Logo oficial de Google, en su version de 18x18 para botones. */
export const LogoGoogle: React.FC = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.92v2.33A9 9 0 0 0 9 18Z" />
        <path fill="#FBBC05" d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.92A9 9 0 0 0 0 9c0 1.45.35 2.83.92 4.05l3.05-2.33Z" />
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .92 4.95l3.05 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
);

/** Logo oficial de Microsoft: los cuatro cuadrados, en 16x16 para botones. */
export const LogoMicrosoft: React.FC = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <rect x="0" y="0" width="7.2" height="7.2" fill="#F25022" />
        <rect x="8.8" y="0" width="7.2" height="7.2" fill="#7FBA00" />
        <rect x="0" y="8.8" width="7.2" height="7.2" fill="#00A4EF" />
        <rect x="8.8" y="8.8" width="7.2" height="7.2" fill="#FFB900" />
    </svg>
);
