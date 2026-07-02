import { useState, useEffect } from 'react';
import { ShieldAlert, ExternalLink, ArrowRight, Sliders, Save } from 'lucide-react';
import { useAppConfig } from '../../context/AppConfigContext';
import { useAuth } from '../../hooks/useAuth';
import { SIATC_THEME } from '../../utils/siatc-theme';
import { cn } from '../../utils/cn';
import { Trans, useTranslation } from 'react-i18next';
import { ApiClient } from '../../services/apiClient';

export function CentralizedConfigPage() {
    const { t } = useTranslation();
    const { applications } = useAppConfig();
    const { hasPermission } = useAuth();

    const consoleApp = applications.find(
        (app) => app.code?.toUpperCase() === 'CON' || app.code?.toUpperCase() === 'CONSOLE'
    );

    const consoleUrl = consoleApp?.url || '/';
    const consoleLabel = consoleApp?.label || 'SIATC Console';

    return (
        <div className={cn(SIATC_THEME.LAYOUT.PAGE_WRAPPER, "justify-center items-center py-8 min-h-[70vh]")}>
            <div className="w-full max-w-2xl flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-500">
                {/* Centralized Card */}
                <div className={cn(
                    SIATC_THEME.EFFECTS.GLASS_PANEL,
                    "w-full p-10 rounded-[2.5rem] border border-cb-border bg-card/60 relative overflow-hidden flex flex-col items-center text-center shadow-[0_32px_128px_rgba(0,0,0,0.08)]"
                )}>
                    {/* Visual Accent */}
                    <div className="relative mb-8 flex items-center justify-center">
                        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full scale-150 animate-pulse" />
                        <div className="relative w-24 h-24 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
                            <ShieldAlert className="w-10 h-10 animate-bounce" />
                        </div>
                    </div>

                    {/* Typography */}
                    <div className="space-y-4 max-w-lg mb-10">
                        <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">
                            {t('config.title')}
                        </h2>
                        <p className="text-sm font-medium text-cb-text-secondary leading-relaxed">
                            <Trans
                                i18nKey="config.desc"
                                values={{ console: consoleLabel }}
                                components={{ 1: <span className="font-bold text-primary" /> }}
                            />
                        </p>
                    </div>

                    {/* CTA Section */}
                    <div className="w-full bg-cb-bg/50 border border-cb-border/40 rounded-[2rem] p-6 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4 text-left">
                            {consoleApp?.logo_url ? (
                                <div className="w-12 h-12 bg-card rounded-2xl flex items-center justify-center p-2.5 shadow-md border border-cb-border/50 shrink-0">
                                    <img src={consoleApp.logo_url} alt={consoleLabel} className="w-full h-full object-contain" />
                                </div>
                            ) : (
                                <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shrink-0">
                                    <ArrowRight className="w-6 h-6" />
                                </div>
                            )}
                            <div>
                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block opacity-60">
                                    {t('config.centralConsole')}
                                </span>
                                <span className="text-sm font-black text-foreground uppercase tracking-tight">
                                    {consoleLabel}
                                </span>
                            </div>
                        </div>

                        <a
                            href={consoleUrl}
                            className={cn(
                                SIATC_THEME.COMPONENTS.BUTTON_PRIMARY,
                                SIATC_THEME.EFFECTS.HOVER_LIFT,
                                "px-6 h-[44px] rounded-2xl flex items-center gap-2 group w-full sm:w-auto"
                            )}
                        >
                            <span>{t('config.goConsole')}</span>
                            <ExternalLink className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </a>
                    </div>

                    {/* Footer */}
                    <div className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] opacity-40">
                        {t('config.version')}
                    </div>
                </div>

                {/* Technical custom parameters */}
                {hasPermission('tec.config.users') && (
                    <SystemConfigPanel />
                )}
            </div>
        </div>
    );
}

function SystemConfigPanel() {
    const { t } = useTranslation();
    const [limitTime, setLimitTime] = useState('09:30');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        const fetchLimit = async () => {
            try {
                const data = await ApiClient.request<{ limit: string }>('/config/rango-horario-limit');
                if (data.limit) {
                    setLimitTime(data.limit);
                }
            } catch (err) {
                console.error('Error loading limit config:', err);
                setError(t('users.sysconfig.errorLoad'));
            }
        };
        fetchLimit();
    }, [t]);

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        setSuccess(null);
        try {
            await ApiClient.request('/config/rango-horario-limit', {
                method: 'POST',
                body: JSON.stringify({ limit: limitTime })
            });
            setSuccess(t('users.sysconfig.saved'));
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('users.sysconfig.errorLoad'));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-card border border-border/50 rounded-[2rem] p-6 shadow-xl backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-3.5 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
                    <Sliders className="w-5 h-5" />
                </div>
                <div className="text-left">
                    <h2 className="text-sm font-bold text-foreground tracking-tight">{t('users.sysconfig.title')}</h2>
                    <p className="text-xs text-muted-foreground">{t('users.sysconfig.desc')}</p>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row items-end gap-4">
                <div className="space-y-1.5 flex-1 max-w-xs text-left">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">{t('users.sysconfig.limitLabel')}</label>
                    <input
                        type="time"
                        value={limitTime}
                        onChange={(e) => setLimitTime(e.target.value)}
                        className="w-full h-11 px-4 bg-background border border-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    />
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="h-11 px-6 bg-primary text-primary-foreground rounded-xl hover:bg-primary/95 transition-all active:scale-95 font-semibold text-xs shadow-sm flex items-center gap-2 w-full sm:w-auto justify-center"
                >
                    {isSaving ? (
                        <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                        <>
                            <Save className="w-4 h-4" />
                            {t('users.sysconfig.saveLimit')}
                        </>
                    )}
                </button>
            </div>

            {error && (
                <p className="text-[10px] font-bold text-destructive mt-2 pl-1 uppercase tracking-widest text-left">{error}</p>
            )}
            {success && (
                <p className="text-[10px] font-bold text-emerald-500 mt-2 pl-1 uppercase tracking-widest text-left">{success}</p>
            )}
        </div>
    );
}

export default CentralizedConfigPage;
