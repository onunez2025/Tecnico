import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, XCircle, AlertTriangle } from 'lucide-react';
import { cn } from '../utils/cn';
import { API_BASE_URL } from '../services/apiClient';

// Página mostrada tras un intento de login social (Google/Microsoft vía Casdoor)
// cuyo correo aún no tiene acceso: solicitud pendiente, rechazada, o error genérico.
export const SsoStatusPage: React.FC = () => {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const status = searchParams.get('status') || 'error';
    const reason = searchParams.get('reason');
    const retriesLeft = Number(searchParams.get('retriesLeft') || '0');

    const config = {
        pending: {
            icon: Clock,
            color: 'text-amber-500 bg-amber-500/10',
            title: t('auth.sso.status.pendingTitle'),
            message: t('auth.sso.status.pendingMessage'),
        },
        rejected: {
            icon: XCircle,
            color: 'text-rose-500 bg-rose-500/10',
            title: t('auth.sso.status.rejectedTitle'),
            message: t('auth.sso.status.rejectedMessage'),
        },
        error: {
            icon: AlertTriangle,
            color: 'text-rose-500 bg-rose-500/10',
            title: t('auth.sso.status.errorTitle'),
            message: reason || t('auth.sso.loginError'),
        },
    }[status === 'pending' || status === 'rejected' ? status : 'error'];

    const Icon = config.icon;

    return (
        <div className="min-h-dvh flex items-center justify-center bg-background px-6">
            <div className="max-w-md w-full text-center space-y-5">
                <div className={cn('w-16 h-16 rounded-full flex items-center justify-center mx-auto', config.color)}>
                    <Icon className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                    <h1 className="text-xl font-bold text-cb-text-primary">{config.title}</h1>
                    <p className="text-sm text-cb-text-secondary">{config.message}</p>
                    {status === 'rejected' && reason && (
                        <p className="text-sm text-cb-text-secondary">
                            <span className="font-bold">{t('auth.sso.status.rejectedReason')}</span> {reason}
                        </p>
                    )}
                    {status === 'rejected' && retriesLeft > 0 && (
                        <p className="text-xs text-cb-text-secondary italic">
                            {t('auth.sso.status.retriesLeft', { count: retriesLeft })}
                        </p>
                    )}
                </div>

                {status === 'rejected' && retriesLeft > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs font-bold text-cb-text-secondary uppercase tracking-wider">{t('auth.sso.status.resubmit')}</p>
                        <div className="grid grid-cols-2 gap-3">
                            <a
                                href={`${API_BASE_URL}/auth/sso/authorize?resubmit=true&provider=google`}
                                className="h-11 flex items-center justify-center gap-2 border border-border rounded-cb-btn text-sm font-bold text-cb-text-primary hover:bg-accent transition-all cursor-pointer"
                            >
                                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                                    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
                                    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.92v2.33A9 9 0 0 0 9 18Z" />
                                    <path fill="#FBBC05" d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.92A9 9 0 0 0 0 9c0 1.45.35 2.83.92 4.05l3.05-2.33Z" />
                                    <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .92 4.95l3.05 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
                                </svg>
                                Google
                            </a>
                            <a
                                href={`${API_BASE_URL}/auth/sso/authorize?resubmit=true&provider=microsoft`}
                                className="h-11 flex items-center justify-center gap-2 border border-border rounded-cb-btn text-sm font-bold text-cb-text-primary hover:bg-accent transition-all cursor-pointer"
                            >
                                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                                    <rect x="0" y="0" width="7.2" height="7.2" fill="#F25022" />
                                    <rect x="8.8" y="0" width="7.2" height="7.2" fill="#7FBA00" />
                                    <rect x="0" y="8.8" width="7.2" height="7.2" fill="#00A4EF" />
                                    <rect x="8.8" y="8.8" width="7.2" height="7.2" fill="#FFB900" />
                                </svg>
                                Microsoft
                            </a>
                        </div>
                    </div>
                )}

                <button
                    onClick={() => navigate('/login', { replace: true })}
                    className="text-sm font-bold text-primary hover:underline cursor-pointer"
                >
                    {t('auth.sso.status.backToLogin')}
                </button>
            </div>
        </div>
    );
};

export default SsoStatusPage;
