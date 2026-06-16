import { useState, useRef, useEffect } from 'react';
import { Grid } from 'lucide-react';
import { useAppConfig } from '../../context/AppConfigContext';

const CURRENT_APP_CODE = 'TEC';

export function AppSwitcher() {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { applications } = useAppConfig();

    const otherApps = applications.filter(app => app.code !== CURRENT_APP_CODE && app.is_active);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (otherApps.length === 0) return null;

    return (
        <div className="relative inline-block" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 flex items-center justify-center"
                title="Ecosistema de Aplicaciones"
                type="button"
            >
                <Grid className="w-5 h-5" />
            </button>

            {isOpen && (
                <div
                    className="absolute right-0 mt-2 w-[432px] bg-card backdrop-blur-md border border-border/40 rounded-cb-card shadow-cb-level-3 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-300"
                >
                    <div className="p-5 border-b border-border/30 bg-primary">
                        <h3 className="text-base font-bold text-primary-foreground tracking-tight">Más aplicaciones</h3>
                    </div>
                    <div className="p-4 grid grid-cols-2 gap-4">
                        {otherApps.map(app => (
                            <a
                                key={app.id}
                                href={app.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group relative flex flex-col items-center justify-center p-6 rounded-xl hover:bg-primary/10 transition-all duration-500 border border-transparent hover:border-primary/20 hover:shadow-cb-level-2"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl" />
                                <div className="relative w-20 h-20 mb-3 flex items-center justify-center overflow-hidden drop-shadow-md group-hover:scale-110 transition-all duration-500 ease-out">
                                    {app.logo_url ? (
                                        <img src={app.logo_url} alt={`${app.label} logo`} className="w-full h-full object-contain" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-primary/10 rounded-xl">
                                            <Grid className="w-10 h-10 text-primary" />
                                        </div>
                                    )}
                                </div>
                                <span className="relative text-sm font-bold text-foreground dark:text-foreground/95 group-hover:text-primary transition-colors text-center">
                                    {app.label}
                                </span>
                            </a>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
