import { Loader2, Check, AlertTriangle } from 'lucide-react';
import { cn } from '../../utils/cn';
import { SIATC_THEME } from '../../utils/siatc-theme';
import { useTranslation } from 'react-i18next';

export type SyncStatus = 'pending' | 'saved' | 'error';

interface SyncStatusChipProps {
    status: SyncStatus;
    onRetry?: () => void;
}

/**
 * Comunica si un registro de campo (pago, rango horario, visita) quedó
 * guardado, está pendiente de sincronizar, o falló — nunca silencioso,
 * porque la conectividad en campo es intermitente (ver DESIGN.md).
 */
export function SyncStatusChip({ status, onRetry }: SyncStatusChipProps) {
    const { t } = useTranslation();

    if (status === 'pending') {
        return (
            <span className={cn(SIATC_THEME.MOBILE.SYNC_STATUS_BASE, SIATC_THEME.MOBILE.SYNC_PENDING)}>
                <Loader2 className="w-3 h-3 animate-spin" />
                {t('calendar.sync.pending')}
            </span>
        );
    }

    if (status === 'error') {
        return (
            <button
                type="button"
                onClick={onRetry}
                className={cn(SIATC_THEME.MOBILE.SYNC_STATUS_BASE, SIATC_THEME.MOBILE.SYNC_ERROR, onRetry && 'cursor-pointer hover:opacity-80')}
            >
                <AlertTriangle className="w-3 h-3" />
                {t('calendar.sync.error')}
            </button>
        );
    }

    return (
        <span className={cn(SIATC_THEME.MOBILE.SYNC_STATUS_BASE, SIATC_THEME.MOBILE.SYNC_SAVED)}>
            <Check className="w-3 h-3" />
            {t('calendar.sync.saved')}
        </span>
    );
}
