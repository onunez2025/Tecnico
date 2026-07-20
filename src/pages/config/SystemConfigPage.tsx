import { useState, useEffect } from 'react';
import { Sliders, Save, Settings, ChevronRight } from 'lucide-react';
import { ApiClient } from '../../services/apiClient';
import { cn } from '../../utils/cn';
import { useTranslation } from 'react-i18next';
import { SIATC_THEME } from '../../utils/siatc-theme';

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
            <div className={SIATC_THEME.LAYOUT.HEADER_WRAPPER}>
                <div className="space-y-1 text-left">
                    <div className="flex items-center gap-2 text-sm text-cb-text-secondary font-medium">
                        <Settings className="w-4 h-4" />
                        <span>{t('users.breadcrumb.config')}</span>
                        <ChevronRight className="w-3 h-3 opacity-50" />
                        <span className="text-cb-text-primary">{t('config.items.parameters')}</span>
                    </div>
                    <h1 className={SIATC_THEME.TYPOGRAPHY.PAGE_TITLE}>{t('users.sysconfig.title')}</h1>
                    <p className={SIATC_THEME.TYPOGRAPHY.PAGE_SUBTITLE}>{t('users.sysconfig.desc')}</p>
                </div>
            </div>

            {/* Config Card */}
            <div className={cn(SIATC_THEME.COMPONENTS.CARD_CONTAINER, 'p-8 shrink-0 w-full max-w-2xl')}>
                <div className="flex items-center gap-3.5 mb-6">
                    <div className="w-12 h-12 rounded-cb-btn bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
                        <Sliders className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                        <h2 className={SIATC_THEME.TYPOGRAPHY.SECTION_TITLE}>{t('users.sysconfig.title')}</h2>
                        <p className="text-xs text-cb-text-secondary">{t('users.sysconfig.desc')}</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-end gap-4">
                    <div className="space-y-1.5 flex-1 max-w-xs text-left">
                        <label className="text-[10px] font-bold text-cb-neutral uppercase tracking-widest pl-1">{t('users.sysconfig.limitLabel')}</label>
                        <input
                            type="time"
                            value={limitTime}
                            onChange={(e) => setLimitTime(e.target.value)}
                            className={SIATC_THEME.COMPONENTS.INPUT}
                        />
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className={cn(SIATC_THEME.COMPONENTS.BUTTON_PRIMARY, 'w-full sm:w-auto')}
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
                    <p className={cn(SIATC_THEME.STATES.BADGE_BASE, SIATC_THEME.STATES.ERROR, 'mt-3 h-auto py-1 normal-case tracking-normal')}>{error}</p>
                )}
                {success && (
                    <p className={cn(SIATC_THEME.STATES.BADGE_BASE, SIATC_THEME.STATES.SUCCESS, 'mt-3 h-auto py-1 normal-case tracking-normal')}>{success}</p>
                )}
            </div>
        </div>
    );
}
