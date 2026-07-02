import { useState, useEffect } from 'react';
import {
    CreditCard,
    CheckCircle2,
    Clock,
    Wallet,
    RefreshCcw,
    AlertCircle
} from 'lucide-react';
import { cn } from '../utils/cn';
import { DashboardService, type DashboardStats } from '../services/dashboardService';
import { useAuth } from '../hooks/useAuth';
import { SIATC_THEME } from '../utils/siatc-theme';
import { useTranslation } from 'react-i18next';

export default function DashboardPage() {
    const { t } = useTranslation();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { user } = useAuth();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const s = await DashboardService.getStats();
            setStats(s);
        } catch (error) {
            console.error("Failed to load dashboard data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const cards = [
        {
            label: t('dashboard.stats.total'),
            value: `S/ ${parseFloat(String(stats?.monto_total || 0)).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`,
            icon: Wallet,
            color: 'text-primary',
            bg: 'bg-primary/10',
            sub: t('dashboard.stats.subs.total')
        },
        {
            label: t('dashboard.stats.settled'),
            value: stats?.liquidados_sap || '0',
            icon: CheckCircle2,
            color: 'text-emerald-600',
            bg: 'bg-emerald-500/10',
            sub: t('dashboard.stats.subs.settled')
        },
        {
            label: t('dashboard.stats.pending'),
            value: stats?.pendientes_recepcionar || '0',
            icon: Clock,
            color: 'text-amber-600',
            bg: 'bg-amber-500/10',
            sub: t('dashboard.stats.subs.pending')
        },
        {
            label: t('dashboard.stats.observed'),
            value: stats?.alertas_pos || '0',
            icon: AlertCircle,
            color: 'text-red-600',
            bg: 'bg-red-500/10',
            sub: t('dashboard.stats.subs.observed')
        },
    ];

    return (
        <div className="flex-1 flex flex-col min-h-0 space-y-4 animate-in fade-in duration-700 p-2">
            {/* Header Section */}
            <div className="flex flex-col gap-2">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-foreground">
                        {t('dashboard.greeting', { name: user?.username || 'Técnico' })}
                    </h1>
                    <p className="text-muted-foreground text-xs font-medium">{t('dashboard.summary')}</p>
                </div>
                <div className="flex items-center justify-between mt-2">
                    <div className="text-[10px] text-muted-foreground font-bold opacity-70">
                        {t('dashboard.updatedAt')}: {new Date().toLocaleTimeString()}
                    </div>
                    <button
                        onClick={loadData}
                        disabled={isLoading}
                        className={cn(
                            "p-2 bg-card border border-border text-primary hover:bg-primary/10 transition-all shadow-sm active:scale-95 disabled:opacity-50",
                            SIATC_THEME.TOKENS.RADIUS.BUTTON
                        )}
                    >
                        <RefreshCcw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                    </button>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-3">
                {cards.map((card, i) => (
                    <div key={i} className={cn(
                        "bg-card border border-border p-3 shadow-sm flex flex-col gap-2",
                        SIATC_THEME.TOKENS.MASTER_ROUNDNESS
                    )}>
                        <div className={cn("w-8 h-8 flex items-center justify-center", card.bg, card.color, SIATC_THEME.TOKENS.RADIUS.FULL)}>
                            <card.icon className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-muted-foreground leading-tight">{card.label}</p>
                            <p className="text-lg font-black text-foreground mt-0.5">{card.value}</p>
                            <p className="text-[8px] text-muted-foreground mt-1 opacity-70">{card.sub}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Acceso Rápido */}
            <div className={cn(
                "mt-4 bg-primary/5 border border-primary/20 p-4 flex items-center justify-between",
                SIATC_THEME.TOKENS.MASTER_ROUNDNESS
            )}>
                <div>
                    <h3 className="font-bold text-sm text-foreground">{t('dashboard.registerPayment.title')}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{t('dashboard.registerPayment.desc')}</p>
                </div>
                <a
                    href="/payments"
                    className={cn(
                        "w-10 h-10 bg-primary text-primary-foreground flex items-center justify-center shadow-md active:scale-95 transition-transform",
                        SIATC_THEME.TOKENS.RADIUS.FULL
                    )}
                >
                    <CreditCard className="w-5 h-5" />
                </a>
            </div>
        </div>
    );
}
