import React from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Clock, XCircle, AlertTriangle } from 'lucide-react';
import { cn } from '../utils/cn';
import { API_BASE_URL } from '../services/apiClient';
import { LogoGoogle, LogoMicrosoft } from '../components/common/LogosProveedores';

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
                                <LogoGoogle />
                                Google
                            </a>
                            <a
                                href={`${API_BASE_URL}/auth/sso/authorize?resubmit=true&provider=microsoft`}
                                className="h-11 flex items-center justify-center gap-2 border border-border rounded-cb-btn text-sm font-bold text-cb-text-primary hover:bg-accent transition-all cursor-pointer"
                            >
                                <LogoMicrosoft />
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
