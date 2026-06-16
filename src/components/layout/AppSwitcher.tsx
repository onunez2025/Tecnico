import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Grid, Info, X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { SIATC_THEME } from '../../utils/siatc-theme';
import { useAuth } from '../../hooks/useAuth';
import { useAppConfig } from '../../context/AppConfigContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';

interface AppSwitcherProps {
    currentAppId?: string;
}

export function AppSwitcher({ currentAppId = 'TEC' }: AppSwitcherProps) {
    const isMobile = useMediaQuery('(max-width: 767px)');
    const { user } = useAuth();
    const { applications } = useAppConfig();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (isMobile) return;
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isMobile]);

    // Filter apps:
    // 1. Omit the current app (e.g. TEC)
    // 2. Filter by user allowed apps list (smart switcher)
    const allowedAppsCodes = (user?.apps || '').split(',').map((a: string) => a.trim().toUpperCase()).filter(Boolean);
    
    const filteredApps = applications.filter(app => {
        const appCode = app.code.toUpperCase();
        // Omit current
        if (appCode === currentAppId.toUpperCase()) return false;
        
        // Super admin sees all active apps, other users only see allowed ones
        const roleName = user?.role_name?.toLowerCase() || user?.role?.toLowerCase() || '';
        const isSuperAdmin = roleName === 'administrador' || roleName === 'admin' || roleName === 'console.administrador';
        if (isSuperAdmin) return true;
        
        return allowedAppsCodes.includes(appCode);
    });

    const theme = SIATC_THEME.APP_SWITCHER;

    const renderSwitcherContent = () => (
        <>
            {/* Switcher Header */}
            <div className={cn(theme.HEADER, isMobile ? "px-6 pt-6 pb-4" : "px-10 pt-8 pb-4")}>
                <div className="flex flex-col gap-1">
                    <h3 className={theme.HEADER_TITLE}>Ecosistema SIATC</h3>
                    <span className={theme.HEADER_SUBTITLE}>Nube Corporativa</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className={theme.SYNC_BADGE}>
                        <div className={theme.SYNC_DOT} />
                        <span className={theme.SYNC_TEXT}>Global Sync</span>
                    </div>
                    {isMobile && (
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="p-2 rounded-xl hover:bg-rose-500/10 hover:text-rose-500 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Apps Grid */}
            {filteredApps.length > 0 ? (
                <div className={cn(theme.GRID, isMobile ? "grid grid-cols-2 p-4 gap-4 flex-1" : "grid grid-cols-4 p-6 gap-4")}>
                    {filteredApps.map(app => (
                        <a
                            key={app.id}
                            href={app.url}
                            className={cn(theme.ITEM_CARD, "min-h-[110px] justify-center")}
                        >
                            <div className={theme.ITEM_LOGO_WRAPPER}>
                                <img 
                                    src={app.logo_url || '/Logo.png'} 
                                    alt={app.label} 
                                    className="w-full h-full object-contain" 
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = '/Logo.png';
                                    }}
                                />
                            </div>
                            <span className={theme.ITEM_NAME}>
                                {app.label}
                            </span>
                        </a>
                    ))}
                </div>
            ) : (
                <div className="p-10 text-center text-xs text-cb-text-secondary font-bold tracking-tight flex-1 flex items-center justify-center">
                    No tienes acceso a otras aplicaciones del ecosistema.
                </div>
            )}

            {/* Footer */}
            <div className={cn(theme.FOOTER, isMobile ? "px-6 py-4 mt-auto" : "px-10 py-5")}>
                <Info className="w-4 h-4 text-muted-foreground opacity-30 shrink-0" />
                <p className={theme.FOOTER_TEXT}>Plataforma Unificada SIATC v3.5</p>
            </div>
        </>
    );

    return (
        <div className="relative inline-block" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    theme.TRIGGER,
                    isOpen && theme.TRIGGER_ACTIVE,
                    "cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                )}
                title="Ecosistema de Aplicaciones SIATC"
                type="button"
            >
                <Grid className={cn('w-5 h-5 transition-transform duration-500', isOpen && 'rotate-90')} />
            </button>

            {isOpen && (
                isMobile ? (
                    createPortal(
                        <div className="fixed inset-0 w-screen h-screen rounded-none border-none bg-card z-[100] flex flex-col p-0 overflow-y-auto">
                            {renderSwitcherContent()}
                        </div>,
                        document.body
                    )
                ) : (
                    <div className={cn(
                        theme.CONTAINER,
                        "absolute right-0 mt-6 w-[540px] h-auto rounded-[2.5rem] border border-cb-border bg-card/95 overflow-hidden"
                    )}>
                        {renderSwitcherContent()}
                    </div>
                )
            )}
        </div>
    );
}

export default AppSwitcher;
