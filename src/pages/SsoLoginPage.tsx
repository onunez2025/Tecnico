import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../services/apiClient';
import { AlertTriangle } from 'lucide-react';
import { esQa } from '../utils/dominioCookie';

const prefersReducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Página puente: recibe el token emitido por /api/auth/sso/callback tras un login
// social exitoso (Google/Microsoft vía Casdoor), completa la hidratación de sesión
// llamando a /auth/me (igual que el resto del ecosistema) y entra a la app.
export const SsoLoginPage: React.FC = () => {
    const { t } = useTranslation();
    const { login } = useAuth();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [error, setError] = useState(false);

    useEffect(() => {
        const token = searchParams.get('ssoToken');
        if (!token) {
            navigate('/login', { replace: true });
            return;
        }

        (async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!response.ok) throw new Error('SSO session validation failed');
                const data = await response.json();

                // Se usa data.token (el "freshToken" que /auth/me re-firma con full_name y demás
                // campos completos), no el ssoToken crudo del callback — este último no incluye
                // full_name, y varios endpoints de tickets filtran por el nombre del técnico logueado.
                // Fase 20: skipSharedCookie solo se activa si no hay VITE_COOKIE_DOMAIN configurada
                // (producción real, sin dominio QA propio) — en QA sí se escribe la cookie compartida.
                login(data.user, data.token, true, undefined, !esQa());

                // Mismo patron que el login clasico (LoginPage.tsx): el flag se lee ya en
                // "/" (ver MainLayout), nunca se demora este navigate().
                if (!prefersReducedMotion()) {
                    sessionStorage.setItem('siatc_welcome_user', data.user.full_name || data.user.username || '');
                }
                navigate('/', { replace: true });
            } catch (err) {
                console.error('SSO login error:', err);
                setError(true);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (error) {
        return (
            <div className="min-h-dvh flex items-center justify-center bg-background px-6">
                <div className="max-w-md w-full text-center space-y-4">
                    <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
                    <p className="text-cb-text-primary font-medium">{t('auth.sso.loginError')}</p>
                    <button
                        onClick={() => navigate('/login', { replace: true })}
                        className="text-sm font-bold text-primary hover:underline cursor-pointer"
                    >
                        {t('auth.sso.status.backToLogin')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-background">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-bold text-cb-text-secondary tracking-widest animate-pulse">
                {t('auth.sso.validating')}
            </span>
        </div>
    );
};

export default SsoLoginPage;
