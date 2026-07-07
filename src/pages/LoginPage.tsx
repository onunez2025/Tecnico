import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useAppConfig } from '../context/AppConfigContext';
import { useTheme } from '../context/ThemeContext';
import { User, Lock, Eye, EyeOff, Moon, Sun, Globe } from 'lucide-react';
import { cn } from '../utils/cn';
import { API_BASE_URL } from '../services/apiClient';
import { SIATC_THEME } from '../utils/siatc-theme';

export default function LoginPage() {
    const { t, i18n } = useTranslation();
    const { login } = useAuth();
    const { refreshApplications } = useAppConfig();
    const { theme, setTheme } = useTheme();
    const navigate = useNavigate();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, remember: rememberMe })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || t('auth.errors.invalid'));
            }

            const data = await response.json();

            login(data.user, data.token, rememberMe, data.sessionConfig);
            refreshApplications();
            navigate('/');

        } catch (err: any) {
            console.error('Login error:', err);
            setError(err.message || t('auth.errors.invalid'));
        } finally {
            setLoading(false);
        }
    };

    const toggleTheme = () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    };

    const toggleLanguage = () => {
        i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es');
    };

    const renderFormFields = () => (
        <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1.5 ml-1">
                        {t('auth.username')}
                    </label>
                    <div className={SIATC_THEME.LOGIN_LAYOUT.INPUT_WRAPPER}>
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                            <User className="w-5 h-5" />
                        </div>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className={SIATC_THEME.LOGIN_LAYOUT.INPUT}
                            placeholder="Ingrese usuario"
                            required
                            autoFocus
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1.5 ml-1">
                        {t('auth.password')}
                    </label>
                    <div className={SIATC_THEME.LOGIN_LAYOUT.INPUT_WRAPPER}>
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                            <Lock className="w-5 h-5" />
                        </div>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={SIATC_THEME.LOGIN_LAYOUT.INPUT}
                            placeholder="Ingrese contraseña"
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border-input text-primary focus:ring-primary"
                    />
                    <span className="text-muted-foreground">{t('auth.rememberMe')}</span>
                </label>
                <button
                    type="button"
                    onClick={() => setError(t('auth.forgotPasswordMessage'))}
                    className="font-medium text-primary hover:text-primary/80 transition-colors bg-transparent border-none p-0 cursor-pointer text-xs"
                >
                    {t('auth.forgotPassword')}
                </button>
            </div>

            {error && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium text-center animate-in fade-in slide-in-from-top-1">
                    {error}
                </div>
            )}

            <button
                type="submit"
                disabled={loading}
                className={cn(
                    SIATC_THEME.COMPONENTS.BUTTON_PRIMARY,
                    "w-full flex justify-center disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                )}
            >
                {loading ? t('common.loading') : t('auth.loginButton')}
            </button>
        </form>
    );

    const renderSsoButtons = () => (
        <div className="space-y-3">
            <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-border" />
                <span className="mx-3 text-xs text-muted-foreground uppercase tracking-wider">{t('auth.sso.divider')}</span>
                <div className="flex-grow border-t border-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <a
                    href={`${API_BASE_URL}/auth/sso/authorize?provider=google`}
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
                    href={`${API_BASE_URL}/auth/sso/authorize?provider=microsoft`}
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
    );

    return (
        <div className={SIATC_THEME.LOGIN_LAYOUT.CONTAINER}>
            {/* ===== MOBILE ONLY (<768px): header con color de marca + tarjeta blanca ===== */}
            <div className="flex flex-col md:hidden min-h-dvh w-full bg-background">
                <div className="relative bg-primary overflow-hidden shrink-0 pb-10 min-h-[45dvh]">
                    <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/10 pointer-events-none" />
                    <div className="absolute top-16 left-4 w-10 h-10 rounded-full bg-white/10 pointer-events-none" />
                    <div className="absolute top-28 right-10 w-6 h-6 rounded-full bg-white/10 pointer-events-none" />

                    <div className="relative z-10 flex items-center justify-between px-6 pt-8">
                        <div className="flex items-center gap-2">
                            <div className="w-9 h-9 flex items-center justify-center shrink-0 overflow-hidden rounded-lg bg-white/10">
                                <img src="/Logo.png" alt="Gestión Técnica Logo" className="h-6 w-6 object-contain" />
                            </div>
                            <span className="text-white font-bold text-base tracking-tight uppercase">Técnico</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={toggleTheme}
                                aria-label="Toggle theme"
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors cursor-pointer"
                            >
                                {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                            </button>
                            <button
                                onClick={toggleLanguage}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors text-xs font-medium cursor-pointer"
                            >
                                <Globe className="w-3.5 h-3.5" />
                                {i18n.language === 'es' ? 'ES' : 'EN'}
                            </button>
                        </div>
                    </div>

                    <div className="relative z-10 px-6 mt-10">
                        <h1 className="text-white text-3xl font-bold leading-tight">{t('common.welcome')}</h1>
                        <p className="text-white/80 text-sm mt-2 max-w-xs">{t('auth.subtitle')}</p>
                    </div>

                    <svg className="absolute bottom-0 left-0 w-full h-10" viewBox="0 0 375 48" preserveAspectRatio="none">
                        <path d="M0,24 C90,52 285,-4 375,20 L375,48 L0,48 Z" fill="var(--background)" />
                    </svg>
                </div>

                <div className="flex-1 flex flex-col justify-center px-6 py-6 bg-background">
                    <div className="max-w-md mx-auto w-full">
                        {renderFormFields()}
                        <div className="mt-6">
                            {renderSsoButtons()}
                        </div>
                    </div>
                </div>
            </div>

            {/* ===== DESKTOP (>=768px): panel dividido existente, sin cambios ===== */}
            <div className="hidden md:flex md:flex-row w-full">
                {/* Left Side - Brand / Visual */}
                <div className={SIATC_THEME.LOGIN_LAYOUT.LEFT_PANEL}>
                    {/* Abstract Background Pattern */}
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+IDxyZWN0IHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgZmlsbD0ibm9uZSIvPiA8ZyBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjIiPiA8cGF0aCBkPSJNMCAzdjU0TTMgMGg1NCIvPiA8L2c+IDwvc3ZnPg==')] bg-[size:60px_60px]" />
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-900/50" />

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 flex items-center justify-center shrink-0 overflow-hidden">
                                <img src="/Logo.png" alt="Gestión Técnica Logo" className="h-full w-full object-contain" />
                            </div>
                            <span className="text-2xl font-bold tracking-tight">Técnico</span>
                        </div>
                        <h1 className="text-5xl font-bold mb-4 leading-tight">
                            Plataforma de<br />Gestión<br />Técnica
                        </h1>
                        <div className="text-slate-400 text-lg max-w-md space-y-6">
                            <p>Administración centralizada de identidades, perfiles, accesos y logs de auditoría.</p>
                            <div className="flex flex-col w-fit gap-2">
                                <span className="text-2xl font-bold text-slate-100 tracking-tight">Gerencia de Atención al Cliente</span>
                                <img
                                    src="/Logo - Grupo Sole - Transparente blanco-.png"
                                    alt="Logo Grupo Sole"
                                    className="h-auto max-w-[12rem] object-contain"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="relative z-10 text-sm text-slate-500">
                        © 2026 GAC - Grupo Sole. Rinnai Corporation. Todos los derechos reservados.
                    </div>
                </div>

                {/* Right Side - Login Form */}
                <div className={SIATC_THEME.LOGIN_LAYOUT.RIGHT_PANEL}>
                    {/* Top Right Controls */}
                    <div className="absolute top-6 right-6 flex items-center gap-4">
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-full hover:bg-accent text-muted-foreground transition-colors cursor-pointer"
                            title="Alternar Tema"
                        >
                            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </button>
                        <button
                            onClick={toggleLanguage}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border hover:bg-accent text-sm font-medium transition-colors cursor-pointer"
                        >
                            <Globe className="w-4 h-4" />
                            {i18n.language === 'es' ? 'ES' : 'EN'}
                        </button>
                    </div>

                    <div className="w-full max-w-md space-y-8">
                        <div className="text-center">
                            <h2 className={SIATC_THEME.LOGIN_LAYOUT.TITLE}>{t('common.welcome')}</h2>
                            <p className={SIATC_THEME.LOGIN_LAYOUT.SUBTITLE}>
                                {t('auth.subtitle')}
                            </p>
                        </div>

                        <div className={SIATC_THEME.LOGIN_LAYOUT.CARD}>
                            {renderFormFields()}
                            <div className="mt-6">
                                {renderSsoButtons()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
