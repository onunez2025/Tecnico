import React, { useState } from 'react';
import { Menu, X, Sun, Moon, Settings, Calendar, User } from 'lucide-react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { AppSwitcher } from './AppSwitcher';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../utils/cn';

export function MainLayout() {
    const { isAuthenticated, isLoading, user, hasPermission } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { theme, setTheme } = useTheme();

    const toggleTheme = () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    };

    // [FIX UX-H2] Close sidebar when a nav item is tapped on mobile
    const handleMobileNavClose = () => setSidebarOpen(false);

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-6">
                    <img src="/Logo.png" alt="Gestión Técnica Logo" className="w-16 h-16 object-contain animate-pulse" />
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-muted-foreground font-medium animate-pulse">Cargando Gestión Técnica...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="h-screen bg-background text-foreground flex overflow-hidden">
            {/* Mobile Sidebar Overlay */}
            <div
                className={cn(
                    "fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden transition-opacity duration-300",
                    sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={() => setSidebarOpen(false)}
            />

            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transition-transform duration-300 lg:static lg:translate-x-0",
                    sidebarOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <div className="h-full flex flex-col">
                    <div className="flex items-center justify-end p-4 lg:hidden">
                        <button onClick={() => setSidebarOpen(false)}>
                            <X className="w-6 h-6 text-muted-foreground" />
                        </button>
                    </div>
                    {/* [FIX UX-H2] Pass onNavigate so nav clicks close the sidebar on mobile */}
                    <Sidebar className="flex-1" onNavigate={handleMobileNavClose} />
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Global Header */}
                <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card sticky top-0 z-30 min-h-[56px]">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="p-2 -ml-2 text-muted-foreground hover:bg-accent rounded-md lg:hidden"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <div className="flex items-center gap-2">
                            <img src="/Logo.png" alt="Gestión Técnica Logo" className="w-8 h-8 object-contain" />
                            <span className="font-bold text-lg hidden sm:inline-block">Gestión Técnica</span>
                        </div>
                    </div>
                    
                    <div className="flex-1 flex justify-end items-center gap-2 sm:gap-4">
                        {/* [FIX UX-M1] Use CSS vars-based classes instead of hardcoded Slate colors */}
                        {/* Theme Toggle */}
                        <button 
                            onClick={toggleTheme}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors duration-200 focus:outline-none"
                            title="Cambiar Tema"
                        >
                            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </button>

                        {/* Config (Gear Icon) */}
                        {hasPermission('tec.config.users') && (
                            <NavLink 
                                to="/config"
                                className={({ isActive }) => cn(
                                    "p-2 rounded-full transition-colors duration-200 focus:outline-none",
                                    isActive 
                                        ? "text-primary bg-primary/10" 
                                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                                )}
                                title="Configuración"
                            >
                                <Settings className="w-5 h-5" />
                            </NavLink>
                        )}

                        <AppSwitcher currentAppId="tec" />

                        {/* User Profile Avatar */}
                        <NavLink 
                            to="/profile"
                            className={({ isActive }) => cn(
                                "flex items-center gap-2 p-1 rounded-full hover:bg-accent group transition-all",
                                isActive ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                            )}
                            title="Mi Perfil"
                        >
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold overflow-hidden shrink-0 border border-transparent group-hover:border-primary/50">
                                {user?.avatar_url ? (
                                    <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    user?.username?.substring(0, 2).toUpperCase() || 'TC'
                                )}
                            </div>
                        </NavLink>
                    </div>
                </header>

                {/* Content Area */}
                <main className="flex-1 overflow-y-auto p-1 lg:p-2 pb-16 lg:pb-2 flex flex-col custom-scrollbar">
                    <div className="flex-1 mx-auto max-w-7xl w-full flex flex-col min-h-0 animate-in fade-in zoom-in duration-300">
                        <Outlet />
                    </div>
                </main>
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
                    {(hasPermission('tec.config.users') || hasPermission('tec.config.roles') || hasPermission('tec.config.audit')) && (
                        <NavLink
                            to="/config"
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
