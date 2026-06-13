import { NavLink } from 'react-router-dom';
import {
    Users,
    Shield,
    Terminal,
    LogOut,
    Calendar
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAuth } from '../../hooks/useAuth';

interface SidebarProps {
    className?: string;
    // [FIX UX-H2] Callback to close the mobile sidebar when a nav item is clicked
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
            to: '/config/users', 
            icon: Users, 
            label: 'Gestión de Usuarios', 
            permission: 'tec.config.users' as const 
        },
        { 
            to: '/config/roles', 
            icon: Shield, 
            label: 'Perfiles y Permisos', 
            permission: 'tec.config.roles' as const 
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
        // [FIX UX-M-Sidebar] Removed manual theme ternary — bg-card already adapts to light/dark via CSS vars
        <div className={cn(
            "flex flex-col h-full bg-card text-card-foreground border-r border-border transition-colors duration-300",
            className
        )}>
            {/* Header / Logo */}
            <div className="p-6 flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center shrink-0 overflow-hidden">
                    <img src="/Logo.png" alt="Gestión Técnica Logo" className="h-full w-full object-contain drop-shadow-sm rounded" />
                </div>
                <div>
                    <h1 className="font-bold text-lg leading-none tracking-tight text-primary">Gestión Técnica</h1>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Plataforma Administrativa</p>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
                {filteredNavItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        // [FIX UX-H2] Close sidebar on mobile when nav item is clicked
                        onClick={onNavigate}
                        className={({ isActive }) => cn(
                            "flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                            isActive
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <item.icon className="w-4 h-4" />
                            {item.label}
                        </div>
                    </NavLink>
                ))}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-border space-y-2">
                <button
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                    Cerrar Sesión
                </button>
            </div>
        </div>
    );
}
