import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ApiClient } from '../services/apiClient';
import { SIATC_THEME } from '../utils/siatc-theme';
import { cn } from '../utils/cn';
import { useTranslation } from 'react-i18next';

/**
 * Cambio de contrasena obligatorio.
 *
 * El alta de usuarios graba `RequiresPasswordChange = 1` y el login devuelve ese dato como
 * `requires_password_change`. Hasta el 2026-09-25 esta app no tenia esta pantalla ni el endpoint que
 * limpia la marca, asi que la proteccion no se aplicaba: el usuario entraba con la contrasena
 * temporal y nadie se enteraba.
 *
 * El minimo son 8 caracteres, el mismo que rige en el perfil propio de las once apps.
 */
export default function ForceChangePasswordPage() {
    const { t } = useTranslation();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { user, login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentPassword || !newPassword || !confirmPassword) {
            setError(t('forcePassword.errors.required'));
            return;
        }
        if (newPassword !== confirmPassword) {
            setError(t('forcePassword.errors.mismatch'));
            return;
        }
        if (newPassword.length < 8) {
            setError(t('forcePassword.errors.tooShort'));
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            await ApiClient.request('/auth/force-change-password', {
                method: 'POST',
                body: JSON.stringify({ currentPassword, newPassword }),
            });

            // La marca queda a 0 en la base; se refleja en la sesion para que el guard deje pasar.
            if (user) {
                login({ ...user, requires_password_change: false });
            }

            navigate('/');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('forcePassword.errors.connection'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={SIATC_THEME.LOGIN_LAYOUT.CENTERED_CONTAINER}>
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className={SIATC_THEME.LOGIN_LAYOUT.CARD}>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-cb-btn bg-amber-500/10 flex items-center justify-center">
                            <KeyRound className="w-6 h-6 text-amber-600 dark:text-amber-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-cb-text-primary">{t('forcePassword.title')}</h2>
                            <p className="text-sm text-cb-text-secondary">
                                {t('forcePassword.subtitle')}
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-cb-error text-sm font-medium animate-in fade-in">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-cb-text-primary mb-1.5 ml-1">{t('forcePassword.labels.current')}</label>
                            <div className="relative">
                                <input
                                    type={showCurrent ? 'text' : 'password'}
                                    value={currentPassword}
                                    onChange={e => setCurrentPassword(e.target.value)}
                                    className={cn(SIATC_THEME.COMPONENTS.INPUT, "pr-12")}
                                    placeholder={t('forcePassword.placeholders.current')}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrent(!showCurrent)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors z-10"
                                >
                                    {showCurrent ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-cb-text-primary mb-1.5 ml-1">{t('forcePassword.labels.new')}</label>
                            <div className="relative">
                                <input
                                    type={showNew ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    className={cn(SIATC_THEME.COMPONENTS.INPUT, "pr-12")}
                                    placeholder={t('forcePassword.placeholders.new')}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNew(!showNew)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors z-10"
                                >
                                    {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-cb-text-primary mb-1.5 ml-1">{t('forcePassword.labels.confirm')}</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                className={SIATC_THEME.COMPONENTS.INPUT}
                                placeholder={t('forcePassword.placeholders.confirm')}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className={cn(
                                SIATC_THEME.COMPONENTS.BUTTON_PRIMARY,
                                "w-full h-11 text-[15px] mt-6",
                                isLoading && "animate-pulse"
                            )}
                        >
                            {isLoading ? t('forcePassword.submitting') : t('forcePassword.submit')}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
