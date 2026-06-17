import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAppConfig } from '../context/AppConfigContext';
import { useTheme } from '../context/ThemeContext';
import { User, Lock, Eye, EyeOff, Moon, Sun } from 'lucide-react';
import { cn } from '../utils/cn';
import { API_BASE_URL } from '../services/apiClient';
import { SIATC_THEME } from '../utils/siatc-theme';

export default function LoginPage() {
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
                throw new Error(errData.error || 'Credenciales inválidas');
            }

            const data = await response.json();

            login(data.user, data.token, rememberMe);
            refreshApplications();
            navigate('/');

        } catch (err: any) {
            console.error('Login error:', err);
            setError(err.message || 'Credenciales inválidas');
        } finally {
            setLoading(false);
        }
    };

    const toggleTheme = () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    };

    return (
        <div className={SIATC_THEME.LOGIN_LAYOUT.CONTAINER}>
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
                </div>

                <div className="w-full max-w-md space-y-8">
                    <div className="text-center">
                        <h2 className={SIATC_THEME.LOGIN_LAYOUT.TITLE}>¡Bienvenido a Técnico!</h2>
                        <p className={SIATC_THEME.LOGIN_LAYOUT.SUBTITLE}>
                            Ingresa tus credenciales para acceder a la plataforma.
                        </p>
                    </div>

                    <div className={SIATC_THEME.LOGIN_LAYOUT.CARD}>
                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1.5 ml-1">
                                        Usuario
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
                                        Contraseña
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
                                    <span className="text-muted-foreground">Recordarme</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setError('Por favor, contacta a tu administrador de sistemas para recuperar tu clave.')}
                                    className="font-medium text-primary hover:text-primary/80 transition-colors bg-transparent border-none p-0 cursor-pointer text-xs"
                                >
                                    ¿Olvidaste tu contraseña?
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
                                {loading ? 'Cargando...' : 'Iniciar Sesión'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
