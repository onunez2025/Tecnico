import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { StorageService } from '../services/storageService';

const APP_CODE = 'TEC';

export interface Application {
    id: string;
    code: string;
    label: string;
    url: string;
    logo_url: string | null;
    is_active: boolean;
    display_order: number;
    theme_config?: {
        typography?: Record<string, string>;
        layout?: Record<string, string>;
        border?: Record<string, string>;
        light?: Record<string, string>;
        dark?: Record<string, string>;
        shadows?: Record<string, string>;
        responsive?: Record<string, string>;
    };
}

interface AppConfigContextType {
    applications: Application[];
    refreshApplications: () => void;
    logoUrl?: string | null;
}

const AppConfigContext = createContext<AppConfigContextType>({ applications: [], refreshApplications: () => {} });

function applyThemeConfig(theme: NonNullable<Application['theme_config']>) {
    try {
        const root = document.documentElement;

        // 1. Google Fonts dinámicas
        const fontsToLoad = new Set<string>();
        (['fontTitle', 'fontSubtitle', 'fontHeader', 'fontSidebar', 'fontTableData'] as const)
            .forEach(key => { const f = theme.typography?.[key]; if (f) fontsToLoad.add(f); });
        fontsToLoad.forEach(fontName => {
            const fontId = `siatc-font-${fontName.replace(/\s+/g, '-')}`;
            if (!document.getElementById(fontId)) {
                const link = document.createElement('link');
                link.id = fontId; link.rel = 'stylesheet';
                link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@300;400;500;600;700&display=swap`;
                document.head.appendChild(link);
            }
        });

        // 2. Fuentes y dimensiones de layout
        if (theme.typography?.fontTitle) root.style.setProperty('--font-title', `"${theme.typography.fontTitle}", sans-serif`);
        if (theme.typography?.fontSubtitle) root.style.setProperty('--font-subtitle', `"${theme.typography.fontSubtitle}", sans-serif`);
        if (theme.typography?.fontHeader) root.style.setProperty('--font-header', `"${theme.typography.fontHeader}", sans-serif`);
        if (theme.typography?.fontSidebar) root.style.setProperty('--font-sidebar', `"${theme.typography.fontSidebar}", sans-serif`);
        if (theme.typography?.fontTableData) root.style.setProperty('--font-table-data', `"${theme.typography.fontTableData}", monospace`);
        if (theme.typography?.baseFontSize) root.style.fontSize = theme.typography.baseFontSize;

        if (theme.layout?.sidebarWidth) root.style.setProperty('--sidebar-width', theme.layout.sidebarWidth);
        if (theme.layout?.headerHeight) root.style.setProperty('--header-height', theme.layout.headerHeight);
        if (theme.layout?.tableRowHeight) root.style.setProperty('--table-row-height', theme.layout.tableRowHeight);
        if (theme.layout?.transitionDuration) root.style.setProperty('--transition-duration', theme.layout.transitionDuration);

        // 3. Radios de borde
        if (theme.border?.radiusChip) root.style.setProperty('--radius-chip', theme.border.radiusChip);
        if (theme.border?.radiusButton) root.style.setProperty('--radius-button', theme.border.radiusButton);
        if (theme.border?.radiusInput) root.style.setProperty('--radius-input', theme.border.radiusInput);
        if (theme.border?.radiusCard) root.style.setProperty('--radius-card', theme.border.radiusCard);
        if (theme.border?.radiusModal) root.style.setProperty('--radius-modal', theme.border.radiusModal);

        // 4. Reglas CSS dinámicas para colores y sombras
        let styleTag = document.getElementById('siatc-dynamic-theme-rules') as HTMLStyleElement | null;
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'siatc-dynamic-theme-rules';
            document.head.appendChild(styleTag);
        }

        let css = '';
        if (theme.light) {
            css += ':root {\n';
            if (theme.light.primary) css += `  --primary: ${theme.light.primary} !important; --ring: ${theme.light.primary} !important;\n`;
            if (theme.light.primaryForeground) css += `  --primary-foreground: ${theme.light.primaryForeground} !important;\n`;
            if (theme.light.background) css += `  --cb-bg: ${theme.light.background} !important; --background: ${theme.light.background} !important;\n`;
            if (theme.light.card) css += `  --card: ${theme.light.card} !important;\n`;
            if (theme.light.border) css += `  --cb-border: ${theme.light.border} !important; --border: ${theme.light.border} !important;\n`;
            if (theme.light.textPrimary) css += `  --cb-text-primary: ${theme.light.textPrimary} !important; --foreground: ${theme.light.textPrimary} !important;\n`;
            if (theme.light.textSecondary) css += `  --cb-text-secondary: ${theme.light.textSecondary} !important;\n`;
            css += '}\n';
        }
        if (theme.dark) {
            css += '.dark {\n';
            if (theme.dark.primary) css += `  --primary: ${theme.dark.primary} !important; --ring: ${theme.dark.primary} !important;\n`;
            if (theme.dark.primaryForeground) css += `  --primary-foreground: ${theme.dark.primaryForeground} !important;\n`;
            if (theme.dark.background) css += `  --cb-bg: ${theme.dark.background} !important; --background: ${theme.dark.background} !important;\n`;
            if (theme.dark.card) css += `  --card: ${theme.dark.card} !important;\n`;
            if (theme.dark.border) css += `  --cb-border: ${theme.dark.border} !important; --border: ${theme.dark.border} !important;\n`;
            if (theme.dark.textPrimary) css += `  --cb-text-primary: ${theme.dark.textPrimary} !important; --foreground: ${theme.dark.textPrimary} !important;\n`;
            if (theme.dark.textSecondary) css += `  --cb-text-secondary: ${theme.dark.textSecondary} !important;\n`;
            css += '}\n';
        }
        if (theme.shadows) {
            css += ':root {\n';
            if (theme.shadows.level1) css += `  --shadow-level-1: ${theme.shadows.level1} !important;\n`;
            if (theme.shadows.level2) css += `  --shadow-level-2: ${theme.shadows.level2} !important;\n`;
            if (theme.shadows.level3) css += `  --shadow-level-3: ${theme.shadows.level3} !important;\n`;
            css += '}\n';
        }
        css += '@media (min-width: 768px) { :root { --padding-scale: 1.0 !important; } }\n';
        css += '@media (max-width: 767px) {\n  :root {\n';
        if (theme.responsive?.mobileRadiusCard) css += `    --radius-card: ${theme.responsive.mobileRadiusCard} !important;\n`;
        if (theme.responsive?.mobileRadiusButton) css += `    --radius-button: ${theme.responsive.mobileRadiusButton} !important; --radius-input: ${theme.responsive.mobileRadiusButton} !important;\n`;
        css += `    --padding-scale: ${theme.responsive?.mobilePaddingScale || '1.0'} !important;\n  }\n`;
        if (theme.responsive?.mobileFontScale) {
            css += `  html { font-size: calc(${theme.typography?.baseFontSize || '16px'} * ${theme.responsive.mobileFontScale}) !important; }\n`;
        }
        css += '}\n';

        styleTag.innerHTML = css;
    } catch (e) {
        console.error('[ThemeConfig] Error applying dynamic branding:', e);
    }
}

export const AppConfigProvider = ({ children }: { children: React.ReactNode }) => {
    const [applications, setApplications] = useState<Application[]>([]);
    const [logoUrl, setLogoUrl] = useState<string | null>(null);

    // Preferir cookie sobre localStorage: la cookie siempre tiene el token más reciente
    // (se actualiza tanto en SSO como en login directo), mientras que localStorage puede
    // tener un token SSO antiguo de sesión anterior.
    const refreshApplications = useCallback(() => {
        const getSsoToken = () => {
            const m = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
            return m ? decodeURIComponent(m[1]) : null;
        };
        const token = getSsoToken() || StorageService.getToken();
        if (!token) return;

        fetch('/api/applications?activeOnly=true', {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(r => r.ok ? r.json() : [])
            .then((data: Application[]) => {
                setApplications(data);

                // Aplicar branding propio de esta app
                const mine = data.find((a: Application) => a.code?.toUpperCase() === APP_CODE);
                if (mine) {
                    setLogoUrl(mine.logo_url ?? null);
                    // Favicon dinámico
                    if (mine.logo_url) {
                        const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
                        if (link) { link.href = mine.logo_url; }
                        else {
                            const newLink = document.createElement('link');
                            newLink.rel = 'icon'; newLink.href = mine.logo_url;
                            document.head.appendChild(newLink);
                        }
                    }
                    // Título dinámico
                    document.title = `${mine.label} - SIATC`;
                    // Inyectar tema
                    if (mine.theme_config) applyThemeConfig(mine.theme_config);
                }
            })
            .catch(() => { /* sin apps dinámicas, AppSwitcher queda vacío */ });
    }, []);

    useEffect(() => {
        refreshApplications();
    }, [refreshApplications]);

    return (
        <AppConfigContext.Provider value={{ applications, refreshApplications, logoUrl }}>
            {children}
        </AppConfigContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAppConfig = () => useContext(AppConfigContext);
