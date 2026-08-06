import React, { useState, useEffect, useContext, createContext, useCallback } from 'react';
import type { User, Permission, SessionConfig } from '../types';
import { StorageService } from '../services/storageService';
import { API_BASE_URL } from '../services/apiClient';

// Fase 20: dominio de la cookie SSO compartida, configurable en build-time. Sin definir, el
// comportamiento es idéntico al de siempre (.siatc.cloud) -- producción real no cambia.
const COOKIE_DOMAIN = import.meta.env.VITE_COOKIE_DOMAIN || '.siatc.cloud';

interface AuthContextType {
    user: User | null;
    sessionConfig: SessionConfig | null;
    login: (user: User, token?: string, remember?: boolean, sessionConfig?: SessionConfig, skipSharedCookie?: boolean) => void;
    logout: () => void;
    requestLogout: () => void;
    isLoggingOut: boolean;
    isAuthenticated: boolean;
    isLoading: boolean;
    hasPermission: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    sessionConfig: null,
    login: () => { },
    logout: () => { },
    requestLogout: () => { },
    isLoggingOut: false,
    isAuthenticated: false,
    isLoading: true,
    hasPermission: () => false,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [sessionConfig, setSessionConfig] = useState<SessionConfig | null>(() => {
        try { const s = localStorage.getItem('session_config'); return s ? JSON.parse(s) : null; } catch { return null; }
    });

    const logout = useCallback(() => {
        const token = StorageService.getToken();
        if (token) {
            // blacklistToken — el servidor invalida el JWT en Redis via POST /auth/logout
            fetch(`${API_BASE_URL}/auth/logout`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
            }).catch(() => { /* token ya expirado o red caída — limpiar igual */ });
        }

        setUser(null);
        setSessionConfig(null);
        setIsLoggingOut(false);
        localStorage.removeItem('session_config');
        StorageService.remove('current_user');
        StorageService.remove('auth_token');

        const isProd = window.location.hostname.endsWith('.siatc.cloud');
        const cookieDomain = isProd ? `; domain=${COOKIE_DOMAIN}` : '';
        document.cookie = `token=; path=/${cookieDomain}; max-age=0; SameSite=Lax; Secure=${isProd ? 'true' : 'false'}`;

        window.location.href = '/login';
    }, []);

    const requestLogout = useCallback(() => {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) {
            logout();
            return;
        }
        setIsLoggingOut(true);
    }, [logout]);

    useEffect(() => {
        const validateSession = async () => {
            if (window.location.pathname === '/login') {
                // Ya estamos en /login -- no repetir logout()+reload si la sesion
                // sigue invalida, corta el bucle de recarga infinita (2026-08-06).
                setIsLoading(false);
                return;
            }

            try {
                const getCookie = (name: string): string | null => {
                    // No usar split('; name=') aqui -- si llegan a coexistir dos cookies con el
                    // mismo nombre (ej. un token viejo con Domain=.siatc.cloud junto al correcto
                    // con Domain=.qa.siatc.cloud), el split genera 3+ partes y la condicion
                    // parts.length === 2 falla siempre, devolviendo null aunque la cookie exista.
                    // El regex toma solo la PRIMERA coincidencia, sin importar cuantas haya.
                    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
                    return match ? match[1] : null;
                };

                const decodeJwt = (t: string): Record<string, unknown> | null => {
                    try {
                        const base64Url = t.split('.')[1];
                        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map((c) => {
                            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                        }).join(''));
                        return JSON.parse(jsonPayload) as Record<string, unknown>;
                    } catch {
                        return null;
                    }
                };

                const cookieToken = getCookie('token');
                const localToken = StorageService.getToken();
                let activeToken = localToken;

                if (cookieToken) {
                    if (cookieToken !== localToken) {
                        StorageService.setToken(cookieToken);
                        activeToken = cookieToken;

                        const payload = decodeJwt(cookieToken);
                        if (payload) {
                            const preHydratedUser = {
                                id: payload.id as string,
                                username: payload.username as string,
                                full_name: (payload.full_name as string) || (payload.fullName as string) || '',
                                role_id: (payload.role_id as string) || '',
                                role_name: (payload.role_name as string) || (payload.role as string) || '',
                                permissions: (payload.permissions as string[]) || (payload.perms as string[]) || [],
                                is_active: true,
                                created_at: '',
                                theme: 'light',
                                management_id: '',
                                apps: (payload.apps as string) || '',
                            };
                            setUser(preHydratedUser as unknown as User);
                            StorageService.setCurrentUser(preHydratedUser as unknown as User);
                        }
                    }
                } else {
                    if (localToken) {
                        logout();
                        window.location.href = '/login?expired=true';
                        return;
                    }
                }

                if (!activeToken) {
                    setIsLoading(false);
                    return;
                }

                const response = await fetch(`${API_BASE_URL}/auth/me`, {
                    headers: { 'Authorization': `Bearer ${activeToken}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    setUser(data.user);
                    StorageService.setCurrentUser(data.user);
                    if (data.token) {
                        StorageService.setToken(data.token);
                        // No reescribir la cookie compartida si el token viene del piloto Casdoor
                        // (ssoPilot=true, propagado por el servidor en /auth/me) — este useEffect
                        // corre en cada carga de página, así que sin este chequeo terminaría
                        // reescribiendo la cookie igual en cada montaje (mismo hallazgo que en
                        // Devoluciones).
                        const freshPayload = decodeJwt(data.token);
                        if (!freshPayload?.ssoPilot) {
                            const isProd = window.location.hostname.endsWith('.siatc.cloud');
                            const cookieDomain = isProd ? `; domain=${COOKIE_DOMAIN}` : '';
                            document.cookie = `token=${data.token}; path=/${cookieDomain}; max-age=${24 * 60 * 60}; SameSite=Lax; Secure=${isProd ? 'true' : 'false'}`;
                        }
                    }
                } else {
                    logout();
                    window.location.href = '/login?expired=true';
                }
            } catch (error) {
                console.error('Session validation error:', error);
            } finally {
                setIsLoading(false);
            }
        };

        validateSession();
    }, [logout]);

    const login = useCallback((newUser: User, token?: string, remember: boolean = true, newSessionConfig?: SessionConfig, skipSharedCookie = false) => {
        setUser(newUser);
        StorageService.setCurrentUser(newUser, remember);
        if (newSessionConfig) {
            setSessionConfig(newSessionConfig);
            localStorage.setItem('session_config', JSON.stringify(newSessionConfig));
        }
        if (token) {
            StorageService.setToken(token, remember);
            // El server ya puso la cookie SSO mínima; esto intenta sobreescribir con el JWT completo.
            // Si el JWT completo supera 4096 bytes, falla silenciosamente y queda la cookie mínima.
            // Se omite en el piloto de Casdoor (SsoLoginPage) para no interferir con sesiones
            // reales del resto del ecosistema mientras esto corre en "Technical QA".
            if (!skipSharedCookie) {
                const isProd = window.location.hostname.endsWith('.siatc.cloud');
                const cookieDomain = isProd ? `; domain=${COOKIE_DOMAIN}` : '';
                document.cookie = `token=${token}; path=/${cookieDomain}; max-age=${24 * 60 * 60}; SameSite=Lax; Secure=${isProd ? 'true' : 'false'}`;
            }
        }
    }, []);

    const hasPermission = (permission: Permission): boolean => {
        if (!user) return false;
        const roleName = (user.role_name || user.role || '').trim().toLowerCase();
        if (roleName === 'administrador' || roleName === 'admin' || roleName === 'console.administrador') return true;
        return user.permissions?.includes(permission) || false;
    };

    return (
        <AuthContext.Provider value={{ user, sessionConfig, login, logout, requestLogout, isLoggingOut, isAuthenticated: !!user, isLoading, hasPermission }}>
            {children}
        </AuthContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
