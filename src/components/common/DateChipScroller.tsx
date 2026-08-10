import { useEffect, useMemo, useRef } from 'react';
import { cn } from '../../utils/cn';
import { SIATC_THEME } from '../../utils/siatc-theme';

interface DateChipScrollerProps {
    selectedDate: Date;
    onSelectDate: (date: Date) => void;
    ticketDates: Record<string, number>;
    /** Días antes/después de hoy a mostrar en la ventana deslizable. */
    windowDays?: number;
}

const WEEKDAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

function toDateKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Selector de fecha por chips horizontales para móvil — reemplaza el
 * <input type="date"> plano, mostrando de un vistazo qué días tienen
 * tickets sin necesitar el calendario de escritorio completo.
 */
export function DateChipScroller({ selectedDate, onSelectDate, ticketDates, windowDays = 7 }: DateChipScrollerProps) {
    const today = useMemo(() => new Date(), []);
    const activeChipRef = useRef<HTMLButtonElement>(null);

    const days = useMemo(() => {
        const list: Date[] = [];
        for (let offset = -windowDays; offset <= windowDays; offset++) {
            const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
            list.push(d);
        }
        return list;
    }, [today, windowDays]);

    useEffect(() => {
        activeChipRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
         
    }, [selectedDate]);

    return (
        <div className={SIATC_THEME.MOBILE.DATE_CHIP_SCROLLER}>
            {days.map((date) => {
                const isSelected = isSameDay(date, selectedDate);
                const isToday = isSameDay(date, today);
                const hasTickets = !!ticketDates[toDateKey(date)];

                return (
                    <button
                        key={toDateKey(date)}
                        ref={isSelected ? activeChipRef : undefined}
                        type="button"
                        onClick={() => onSelectDate(date)}
                        className={cn(
                            SIATC_THEME.MOBILE.DATE_CHIP_BASE,
                            isSelected ? SIATC_THEME.MOBILE.DATE_CHIP_ACTIVE : SIATC_THEME.MOBILE.DATE_CHIP_INACTIVE,
                            isToday && !isSelected && 'ring-2 ring-primary/30'
                        )}
                    >
                        <span className="text-[10px] leading-none font-bold uppercase opacity-90">{WEEKDAY_LABELS[date.getDay()]}</span>
                        <span className="text-base leading-none font-black mt-1.5">{date.getDate()}</span>
                        {hasTickets && (
                            <span className={cn(SIATC_THEME.MOBILE.DATE_CHIP_DOT, isSelected ? 'bg-primary-foreground' : 'bg-primary')} />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
