import { NavLink } from 'react-router-dom';
import {
    Users,
    Shield,
    Terminal,
    LogOut,
    Calendar,
    ChevronRight,
    DollarSign,
    Building2,
    Globe
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';
import { useAuth } from '../../hooks/useAuth';
import { useAppConfig } from '../../context/AppConfigContext';
import { SIATC_THEME } from '../../utils/siatc-theme';

interface SidebarProps {
    className?: string;
    onNavigate?: () => void;
    isEffectivelyExpanded?: boolean;
}

export function Sidebar({ className, onNavigate, isEffectivelyExpanded = true }: SidebarProps) {
    const { t, i18n } = useTranslation();
    const { logout, hasPermission, user } = useAuth();
    const appConfig = useAppConfig();

    const toggleLanguage = () => {
        i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es');
    };
    const logoUrl = appConfig?.logoUrl || '/Logo.png';
    const showFull = isEffectivelyExpanded;

    const navItems = [
        {
            to: '/tickets',
            icon: Calendar,
            label: 'Mis Tickets',
            permission: 'tec.tickets.view' as const
        },
        {
            to: '/payments',
            icon: DollarSign,
            label: 'Mis Pagos',
            permission: 'tec.payments.view' as const
        },
        {
            to: '/config/audit',
            icon: Terminal,
            label: 'Logs de Auditoría',
            permission: 'tec.config.audit' as const
        }
    ];

    const filteredNavItems = navItems.filter(item =>
        !item.permission || hasPermission(item.permission)
    );

    return (
        <div className={cn(
            SIATC_THEME.LAYOUT.SIDEBAR_INNER,
            className
        )}>
            {/* Header / Brand */}
            {showFull ? (
                <div className="p-6 flex items-center gap-4 border-b border-border/50 bg-gradient-to-br from-primary/5 to-transparent">
                    <div className="w-12 h-12 flex items-center justify-center shrink-0 overflow-hidden transition-transform hover:scale-105">
                        <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <h1 className="font-bold text-base leading-none tracking-tight text-foreground uppercase truncate">Técnico</h1>
                        <p className="text-[9px] font-black text-primary tracking-[0.05em] uppercase mt-1 opacity-70 whitespace-nowrap">Gestión Técnica</p>
                    </div>
                </div>
            ) : (
                <div className="px-1 py-4 flex flex-col items-center gap-2 border-b border-border/50 bg-gradient-to-br from-primary/5 to-transparent">
                    <div className="w-9 h-9 flex items-center justify-center shrink-0 overflow-hidden">
                        <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
                    </div>
                </div>
            )}

            {/* Navigation */}
            {showFull ? (
                <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto custom-scrollbar">
                    <p className="text-[10px] font-black text-muted-foreground tracking-[0.2em] px-4 py-2 uppercase opacity-40">Menú Principal</p>
                    {filteredNavItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={onNavigate}
                            className={({ isActive }) =>
                                isActive
                                    ? SIATC_THEME.LAYOUT.SIDEBAR_ITEM_ACTIVE
                                    : SIATC_THEME.LAYOUT.SIDEBAR_ITEM_INACTIVE
                            }
                        >
                            <div className="flex items-center gap-3 relative z-10">
                                <item.icon className={cn(
                                    "w-5 h-5 transition-transform duration-500",
                                    "group-hover/item:scale-110 shrink-0"
                                )} />
                                <span className="tracking-tight">{item.label}</span>
                            </div>
                            <ChevronRight className={cn(
                                "w-4 h-4 transition-all duration-300 opacity-0 -translate-x-2 relative z-10",
                                "group-hover/item:opacity-100 group-hover/item:translate-x-0"
                            )} />
                        </NavLink>
                    ))}
                </nav>
            ) : (
                <nav className="flex-1 px-1 py-4 space-y-2 overflow-y-auto custom-scrollbar flex flex-col items-center">
                    {filteredNavItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            title={item.label}
                            onClick={onNavigate}
                            className={({ isActive }) => cn(
                                "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200",
                                isActive
                                    ? "bg-primary text-primary-foreground shadow-md"
                                    : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                            )}
                        >
                            <item.icon className="w-5 h-5 shrink-0" />
                        </NavLink>
                    ))}
                </nav>
            )}

            {/* CAS Tenant Widget */}
            {user?.cas_name && (
                showFull ? (
                    <div className="mx-4 mb-4 p-4 rounded-[1.5rem] bg-muted/20 border border-border/50 flex items-center gap-3 shrink-0">
                        <Building2 className="w-5 h-5 text-primary shrink-0" />
                        <div className="overflow-hidden">
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider leading-none">CAS Asignado</p>
                            <p className="text-xs font-bold text-foreground truncate mt-1">{user.cas_name}</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-center mb-2 shrink-0">
                        <div title={user.cas_name} className="w-9 h-9 rounded-xl bg-muted/20 border border-border/50 flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-primary" />
                        </div>
                    </div>
                )
            )}

            {/* Footer */}
            <div className={cn(
                "border-t border-border/50 bg-muted/20 shrink-0",
                showFull ? 'p-4 space-y-2' : 'p-2 flex flex-col items-center gap-2'
            )}>
                {showFull ? (
                    <>
                        <button
                            onClick={toggleLanguage}
                            className="group/lang w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
                        >
                            <Globe className="w-4 h-4 transition-transform duration-300 group-hover/lang:rotate-12" />
                            {i18n.language === 'es' ? 'Español' : 'English'}
                        </button>
                        <button
                            onClick={logout}
                            className="w-full flex items-center gap-3 px-4 py-3 text-xs font-black text-rose-500 hover:bg-rose-50 hover:text-white rounded-2xl transition-all shadow-rose-500/10 hover:shadow-lg uppercase tracking-[0.2em] cursor-pointer"
                        >
                            <LogOut className="w-4 h-4" />
                            {t('common.logout')}
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={toggleLanguage}
                            title={i18n.language === 'es' ? 'Español' : 'English'}
                            className="w-9 h-9 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
                        >
                            <Globe className="w-4 h-4" />
                        </button>
                        <button
                            onClick={logout}
                            title={t('common.logout')}
                            className="w-9 h-9 flex items-center justify-center rounded-xl text-rose-500 hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
