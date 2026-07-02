import { ShieldAlert, ExternalLink, ArrowRight } from 'lucide-react';
import { useAppConfig } from '../../context/AppConfigContext';
import { SIATC_THEME } from '../../utils/siatc-theme';
import { cn } from '../../utils/cn';
import { Trans, useTranslation } from 'react-i18next';

export function CentralizedConfigPage() {
    const { t } = useTranslation();
    const { applications } = useAppConfig();

    const consoleApp = applications.find(
        (app) => app.code?.toUpperCase() === 'CON' || app.code?.toUpperCase() === 'CONSOLE'
    );

    const consoleUrl = consoleApp?.url || '/';
    const consoleLabel = consoleApp?.label || 'SIATC Console';

    return (
        <div className={cn(SIATC_THEME.LAYOUT.PAGE_WRAPPER, "justify-center items-center min-h-[70vh]")}>
            <div className={cn(
                SIATC_THEME.EFFECTS.GLASS_PANEL,
                "w-full max-w-2xl p-10 rounded-[2.5rem] border border-cb-border bg-card/60 relative overflow-hidden flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-500 shadow-[0_32px_128px_rgba(0,0,0,0.08)]"
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
        </div>
    );
}

export default CentralizedConfigPage;
