import { NavLink } from 'react-router-dom';
import {
    Users,
    Shield,
    Terminal,
    LogOut,
    Calendar,
    ChevronRight
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAuth } from '../../hooks/useAuth';
import { SIATC_THEME } from '../../utils/siatc-theme';

interface SidebarProps {
    className?: string;
    // Callback to close the mobile sidebar when a nav item is clicked
    onNavigate?: () => void;
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
    const { logout, hasPermission } = useAuth();

    const navItems = [
        { 
            to: '/tickets', 
            icon: Calendar, 
            label: 'Mis Tickets', 
            permission: 'tec.tickets.view' as const 
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
            {/* Header / Brand: SIATC High Density */}
            <div className="p-6 flex items-center gap-4 border-b border-border/50 bg-gradient-to-br from-primary/5 to-transparent">
                <div className="w-12 h-12 flex items-center justify-center shrink-0 overflow-hidden transition-transform hover:scale-105">
                    <img src="/Logo.png" alt="Logo" className="h-full w-full object-contain" />
                </div>
                <div className="flex flex-col min-w-0">
                    <h1 className="font-bold text-base leading-none tracking-tight text-foreground uppercase truncate">Técnico</h1>
                    <p className="text-[9px] font-black text-primary tracking-[0.05em] uppercase mt-1 opacity-70 whitespace-nowrap">Gestión Técnica</p>
                </div>
            </div>

            {/* Navigation: High Density Standard */}
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

            {/* Footer: SIATC Standard */}
            <div className="p-4 border-t border-border/50 space-y-3 bg-muted/20 shrink-0">
                <button
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-xs font-black text-rose-500 hover:bg-rose-50 hover:text-white rounded-2xl transition-all shadow-rose-500/10 hover:shadow-lg uppercase tracking-[0.2em] cursor-pointer"
                >
                    <LogOut className="w-4 h-4" />
                    Cerrar Sesión
                </button>
            </div>
        </div>
    );
}
