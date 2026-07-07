import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../services/apiClient';
import { AlertTriangle } from 'lucide-react';

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

                // skipSharedCookie=true — este piloto no escribe la cookie domain=.siatc.cloud
                login(data.user, token, true, undefined, true);
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
