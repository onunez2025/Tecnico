import { useState, useEffect } from 'react';
import { Sliders, Save, Settings, ChevronRight } from 'lucide-react';
import { ApiClient } from '../../services/apiClient';
import { useTranslation } from 'react-i18next';

export default function SystemConfigPage() {
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
        <div className="flex flex-col h-full space-y-6 min-h-0 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 px-1">
                <div className="space-y-1 text-left">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                        <Settings className="w-4 h-4" />
                        <span>{t('users.breadcrumb.config')}</span>
                        <ChevronRight className="w-3 h-3 opacity-50" />
                        <span className="text-foreground">{t('config.items.parameters')}</span>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('users.sysconfig.title')}</h1>
                    <p className="text-sm text-muted-foreground">{t('users.sysconfig.desc')}</p>
                </div>
            </div>

            {/* Config Card */}
            <div className="bg-card border border-border/50 rounded-[2rem] p-8 shadow-xl backdrop-blur-sm shrink-0 w-full max-w-2xl">
                <div className="flex items-center gap-3.5 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
                        <Sliders className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                        <h2 className="text-base font-bold text-foreground tracking-tight">{t('users.sysconfig.title')}</h2>
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
                    <p className="text-[10px] font-bold text-destructive mt-3 pl-1 uppercase tracking-widest text-left">{error}</p>
                )}
                {success && (
                    <p className="text-[10px] font-bold text-emerald-500 mt-3 pl-1 uppercase tracking-widest text-left">{success}</p>
                )}
            </div>
        </div>
    );
}
