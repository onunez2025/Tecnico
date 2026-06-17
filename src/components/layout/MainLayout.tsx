import React, { useState } from 'react';
import { Menu, X, Sun, Moon, Settings, Calendar, User, DollarSign } from 'lucide-react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { AppSwitcher } from './AppSwitcher';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { SIATC_THEME } from '../../utils/siatc-theme';
import { cn } from '../../utils/cn';

export function MainLayout() {
    const { isAuthenticated, isLoading, user, hasPermission } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { theme, setTheme } = useTheme();

    const toggleTheme = () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    };

    // Close sidebar when a nav item is tapped on mobile
    const handleMobileNavClose = () => setSidebarOpen(false);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#F9FAFB] dark:bg-[#050F1A] flex flex-col justify-center items-center">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-sm font-bold text-cb-text-secondary uppercase tracking-widest animate-pulse">Cargando Gestión Técnica...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="h-screen bg-[#F8FAFC] dark:bg-[#020617] text-foreground flex overflow-hidden font-sans relative">
            {/* Mobile Sidebar Overlay */}
            <div
                className={cn(
                    "fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-md lg:hidden transition-all duration-500",
                    sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={() => setSidebarOpen(false)}
            />

            {/* Sidebar Container: SIATC Platinum 288px (w-72), Glassmorphism */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-[70] w-72 transition-transform duration-500 ease-in-out lg:static lg:translate-x-0",
                    sidebarOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <div className="h-full flex flex-col p-4 bg-transparent">
                    <div className={cn(
                        "flex-1 flex flex-col overflow-hidden relative rounded-[2.5rem] border border-white dark:border-white/5 shadow-2xl shadow-slate-200/50 dark:shadow-none",
                        SIATC_THEME.TOKENS.SIDEBAR_BG
                    )}>
                        <div className="flex items-center justify-end p-6 lg:hidden">
                            <button
                                onClick={() => setSidebarOpen(false)}
                                className="p-2 hover:bg-rose-500/10 hover:text-rose-500 rounded-2xl transition-all cursor-pointer"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <Sidebar className="flex-1" onNavigate={handleMobileNavClose} />
                    </div>
                </div>
            </aside>

            {/* Main Content Viewport */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative lg:pr-4 lg:pb-4 pr-0 pb-0">
                {/* SIATC PREMIUM HEADER — h-20 estandarizado */}
                <header className="h-16 lg:h-20 shrink-0 px-4 lg:px-8 flex items-center justify-between sticky top-0 z-40">
                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="p-3 -ml-3 text-muted-foreground hover:bg-white dark:hover:bg-white/5 rounded-2xl lg:hidden shadow-sm transition-all border border-transparent hover:border-border/50 cursor-pointer"
                        >
                            <Menu className="w-6 h-6" />
                        </button>

                        <div className="flex items-center gap-3 lg:gap-4 group cursor-default">
                            <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-[1.25rem] bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/10 shadow-lg shadow-slate-200/40 dark:shadow-none flex items-center justify-center group-hover:scale-110 transition-all duration-500">
                                <img src="/Logo.png" alt="Logo" className="w-6 h-6 lg:w-7 lg:h-7 object-contain" />
                            </div>
                            <div className="flex flex-col">
                                <span className="font-black text-xs lg:text-sm tracking-tight text-foreground uppercase pt-1">Gestión Técnica</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[9px] lg:text-[10px] font-black text-muted-foreground tracking-widest uppercase opacity-60 hidden sm:inline">Plataforma Administrativa</span>
                                    <span className="text-[9px] lg:text-[10px] font-black text-muted-foreground tracking-widest uppercase opacity-60 inline sm:hidden">Técnico</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Header Actions: Glassmorphism Group — SIATC Platinum Standard */}
                    <div className={cn(
                        "flex items-center p-1 lg:p-1.5 gap-1 lg:gap-2 rounded-[2rem] border",
                        SIATC_THEME.EFFECTS.GLASS_PANEL
                    )}>
                        {/* Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            className="w-9 h-9 lg:w-11 lg:h-11 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 rounded-full transition-all duration-300 cursor-pointer"
                            title="Alternar Tema"
                        >
                            {theme === 'dark' ? <Sun className="w-4.5 h-4.5 lg:w-5 lg:h-5" /> : <Moon className="w-4.5 h-4.5 lg:w-5 lg:h-5" />}
                        </button>

                        {/* Config (Gear Icon) */}
                        {hasPermission('tec.config.users') && (
                            <NavLink
                                to="/config/users"
                                className={({ isActive }) => cn(
                                    "w-11 h-11 flex items-center justify-center rounded-full transition-all duration-300 group",
                                    isActive
                                        ? "text-primary bg-primary/20 shadow-inner"
                                        : "text-slate-400 hover:text-primary hover:bg-primary/10"
                                )}
                                title="Configuración del Sistema"
                            >
                                <Settings className="w-5 h-5 group-hover:rotate-45 transition-transform duration-500" />
                            </NavLink>
                        )}

                        <AppSwitcher />

                        <div className="w-px h-6 bg-border/50 mx-1" />

                        {/* User Profile Avatar */}
                        <NavLink
                            to="/profile"
                            className={({ isActive }) => cn(
                                "flex items-center gap-3 pl-1 pr-4 py-1 rounded-full group transition-all duration-300 border border-transparent",
                                isActive ? "bg-primary/10 border-primary/20" : "hover:bg-white dark:hover:bg-white/5"
                            )}
                            title="Mi Perfil"
                        >
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-black text-xs shadow-lg shadow-primary/20 ring-2 ring-white dark:ring-slate-900 overflow-hidden shrink-0">
                                {user?.avatar_url ? (
                                    <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    user?.username?.substring(0, 2).toUpperCase() || 'TC'
                                )}
                            </div>
                            <div className="flex flex-col min-w-0 hidden md:flex">
                                <span className="text-[11px] font-black text-foreground truncate uppercase tracking-tight">{user?.username || 'Técnico'}</span>
                                <span className="text-[9px] font-black text-primary/70 uppercase tracking-widest">Admin</span>
                            </div>
                        </NavLink>
                    </div>
                </header>

                {/* Content Viewport */}
                <main className={cn(SIATC_THEME.LAYOUT.VIEWPORT, "px-4 lg:px-[calc(2rem*var(--padding-scale))]")}>
                    <div className="flex-1 w-full max-w-[1600px] mx-auto flex flex-col min-h-0">
                        <Outlet />
                    </div>
                </main>

                {/* Background ambient decoration */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 -z-10 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-500/5 blur-[100px] rounded-full translate-y-1/2 -translate-x-1/2 -z-10 pointer-events-none" />
            </div>

            {/* Mobile Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-card border-t border-border"
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                <div className="flex items-stretch">
                    {hasPermission('tec.tickets.view') && (
                        <NavLink
                            to="/tickets"
                            className={({ isActive }) => cn(
                                "flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] transition-colors",
                                isActive ? "text-primary" : "text-muted-foreground"
                            )}
                        >
                            <Calendar className="w-5 h-5" />
                            <span className="text-[10px] font-medium">Tickets</span>
                        </NavLink>
                    )}
                    {hasPermission('tec.payments.view') && (
                        <NavLink
                            to="/payments"
                            className={({ isActive }) => cn(
                                "flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] transition-colors",
                                isActive ? "text-primary" : "text-muted-foreground"
                            )}
                        >
                            <DollarSign className="w-5 h-5" />
                            <span className="text-[10px] font-medium">Pagos</span>
                        </NavLink>
                    )}
                    {(hasPermission('tec.config.users') || hasPermission('tec.config.roles') || hasPermission('tec.config.audit')) && (
                        <NavLink
                            to="/config/users"
                            className={({ isActive }) => cn(
                                "flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] transition-colors",
                                isActive ? "text-primary" : "text-muted-foreground"
                            )}
                        >
                            <Settings className="w-5 h-5" />
                            <span className="text-[10px] font-medium">Config</span>
                        </NavLink>
                    )}
                    <NavLink
                        to="/profile"
                        className={({ isActive }) => cn(
                            "flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] transition-colors",
                            isActive ? "text-primary" : "text-muted-foreground"
                        )}
                    >
                        <User className="w-5 h-5" />
                        <span className="text-[10px] font-medium">Perfil</span>
                    </NavLink>
                </div>
            </nav>
        </div>
    );
}
