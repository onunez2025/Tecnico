import type { Permission } from '../../types';
import { NavLink, Outlet, useLocation, Navigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Sliders, ChevronRight, Settings2, ShieldAlert } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAuth } from '../../hooks/useAuth';
import { SIATC_THEME } from '../../utils/siatc-theme';

export function ConfigLayout() {
    const { t } = useTranslation();
    const { hasPermission } = useAuth();
    const location = useLocation();

    const configItems = [
        { to: '/config/parameters', icon: Sliders, label: t('config.items.parameters'), permission: 'tec.config.parameters' as const },
    ];

    const filteredItems = configItems.filter(item =>
        !item.permission || hasPermission(item.permission as Permission)
    );

    // If we are at the root /config, redirect to the first authorized item
    if (location.pathname === '/config' || location.pathname === '/config/') {
        if (filteredItems.length > 0) {
            return <Navigate to={filteredItems[0].to} replace />;
        }
    }

    if (filteredItems.length === 0) {
        return (
            <div className={cn(SIATC_THEME.LAYOUT.PAGE_WRAPPER, "justify-center items-center min-h-[50vh]")}>
                <div className="flex flex-col items-center gap-4 text-center max-w-md">
                    <div className="w-16 h-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                        <ShieldAlert className="w-8 h-8" />
                    </div>
                    <h2 className="text-lg font-bold text-cb-text-primary">{t('config.noPermissionsTitle')}</h2>
                    <p className="text-sm text-cb-text-secondary">{t('config.noPermissionsMessage')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className={SIATC_THEME.LAYOUT.PAGE_WRAPPER}>
            <div className="grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-4 h-full min-h-0 w-full text-left">
                {/* Móvil/tablet: barra de tabs horizontal (el sidebar vertical completo
                    apilaba todo su chrome arriba del contenido real antes de llegar
                    al Outlet) */}
                <nav className="lg:hidden flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
                    {filteredItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) => cn(
                                SIATC_THEME.MOBILE.TOUCH_TARGET,
                                "flex items-center gap-2 px-4 shrink-0 rounded-full border text-sm font-bold whitespace-nowrap transition-colors",
                                isActive
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-card text-cb-text-secondary border-cb-border hover:bg-muted"
                            )}
                        >
                            <item.icon className="w-4 h-4 shrink-0" />
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                {/* Secondary Sidebar — solo en lg: (escritorio) */}
                <aside className="hidden lg:flex shrink-0 flex-col min-h-0 h-fit lg:h-full group">
                    <div className={cn(SIATC_THEME.LAYOUT.SIDEBAR_CONTAINER, "w-full lg:w-72 h-full bg-card border-cb-border")}>
                        <div className="p-6 border-b border-cb-border bg-gradient-to-br from-primary/5 to-transparent">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-primary text-white rounded-cb-btn shadow-lg shadow-primary/20 ring-4 ring-primary/5">
                                    <Settings2 className="w-5 h-5 stroke-[2.5]" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-primary tracking-[0.2em] leading-none uppercase">{t('config.moduleLabel')}</span>
                                    <span className="text-lg font-bold text-cb-text-primary tracking-tight">{t('config.moduleTitle')}</span>
                                </div>
                            </div>
                        </div>

                        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
                            <p className="text-[10px] font-black text-cb-neutral tracking-[0.2em] px-4 py-3 opacity-60 uppercase">{t('config.sectionLabel')}</p>
                            {filteredItems.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    className={({ isActive }) => cn(
                                        isActive
                                            ? SIATC_THEME.LAYOUT.SIDEBAR_ITEM_ACTIVE
                                            : SIATC_THEME.LAYOUT.SIDEBAR_ITEM_INACTIVE
                                    )}
                                >
                                    <div className="flex items-center gap-3 relative z-10">
                                        <item.icon className="w-5 h-5 transition-transform duration-500 group-hover/item:scale-110 shrink-0" />
                                        <span className="tracking-tight">{item.label}</span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 transition-all duration-300 opacity-0 -translate-x-2 relative z-10 group-hover/item:opacity-100 group-hover/item:translate-x-0" />
                                </NavLink>
                            ))}
                        </nav>

                        {/* Sidebar Footer Info — oculto en móvil/tablet: es chrome decorativo,
                            no aporta a la tarea y empuja el contenido real hacia abajo cuando
                            el sidebar completo se apila arriba del Outlet (grid-cols-1 < lg:) */}
                        <div className="hidden lg:block p-4 bg-cb-bg/30 border-t border-cb-border">
                            <div className="p-4 bg-cb-bg/50 rounded-cb-card border border-cb-border shadow-cb-level-1">
                                <div className="flex items-center gap-2 mb-1.5 font-bold text-[10px] text-primary tracking-widest uppercase">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                    {t('config.footer.system')}
                                </div>
                                <p className="text-[10px] text-cb-neutral font-black tracking-widest leading-relaxed uppercase opacity-60">
                                    {t('config.footer.version')}
                                </p>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 min-w-0 h-full flex flex-col min-h-0 bg-transparent">
                    <div className="flex-1 flex flex-col min-h-0">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}

export default ConfigLayout;

