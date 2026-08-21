import React from 'react';
import { cn } from '../../../utils/cn';
import { SIATC_THEME } from '../../../utils/siatc-theme';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Tabla del Ecosistema SIATC, en dos densidades.
 *
 *     <SIATCTable>          listado: fila alta, celda holgada
 *     <SIATCTable densa>    detalle dentro de un modal: fila compacta
 *
 * ── Por que dos densidades y no una ─────────────────────────────────────────────────────────
 * Un listado se recorre con la vista y necesita aire. Un detalle dentro de un modal se consulta
 * de un vistazo, cabe poco alto y compite con el resto del contenido del modal: con el ritmo del
 * listado hay que hacer scroll para ver cuatro materiales.
 *
 * Antes de esta variante, cada modal se escribia su propia tabla a mano. Es decir: la alternativa
 * a tener dos densidades oficiales no era tener una, era tener las que cada quien improvisara.
 *
 * ── Como se propaga ─────────────────────────────────────────────────────────────────────────
 * La densidad viaja por contexto, no por propiedad. Asi el que la usa escribe `densa` UNA vez, en
 * la tabla, y las filas, celdas y cabeceras de dentro se adaptan solas. Si hubiera que pasarsela
 * a cada `<SIATCTableCell>`, en la primera prisa alguien se saltaria una y la tabla saldria a
 * medias.
 */
const ContextoDensidad = React.createContext(false);

/** Devuelve el juego de estilos que toca segun la densidad de la tabla que envuelve. */
const useEstilos = () =>
    React.useContext(ContextoDensidad) ? SIATC_THEME.TABLE_DENSA : SIATC_THEME.TABLE;

/*
 * Celda, fila y cabecera reenvian la `ref`. No es un adorno: una lista virtualizada necesita medir
 * la fila para saber su alto, y sin `ref` la pantalla no puede usar el componente de la casa —
 * tendria que volver a un <tr> suelto, que es justo lo que queremos evitar.
 */
export const SIATCTableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
    ({ className, children, ...props }, ref) => (
        <td ref={ref} className={cn(useEstilos().CELL, className)} {...props}>
            {children}
        </td>
    )
);
SIATCTableCell.displayName = 'SIATCTableCell';

interface RowProps extends React.HTMLAttributes<HTMLTableRowElement> {
    isActive?: boolean;
}

export const SIATCTableRow = React.forwardRef<HTMLTableRowElement, RowProps>(
    ({ className, children, isActive, ...props }, ref) => (
        <tr
            ref={ref}
            className={cn(
                useEstilos().BODY_ROW,
                isActive && "bg-primary/10 border-l-4 border-l-primary shadow-sm",
                className
            )}
            {...props}
        >
            {children}
        </tr>
    )
);
SIATCTableRow.displayName = 'SIATCTableRow';

export const SIATCTableHeader = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
    ({ className, children, ...props }, ref) => (
        <th ref={ref} className={cn(useEstilos().HEADER_TH, className)} {...props}>
            {children}
        </th>
    )
);
SIATCTableHeader.displayName = 'SIATCTableHeader';

/**
 * El `<thead>`. Existe para que la cabecera pegajosa no haya que recordarla a mano en cada
 * pantalla — y para que en modo denso cambie sola.
 */
export const SIATCTableHead: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ className, children, ...props }) => (
    <thead className={cn(useEstilos().HEADER_ROW, className)} {...props}>
        {children}
    </thead>
);

interface FooterProps {
    totalRecords?: number;
    currentPage?: number;
    totalPages?: number;
    onPageChange?: (page: number) => void;
    showPaging?: boolean;
    label?: string;

    // Alias heredados: los mantiene por compatibilidad con pantallas antiguas.
    page?: number;
    total?: number;
    limit?: number;
    onLimitChange?: (limit: number) => void;
}

export const SIATCTableFooter: React.FC<FooterProps> = ({
    totalRecords,
    currentPage,
    totalPages = 1,
    onPageChange,
    showPaging = true,
    label = 'Total de registros',

    page,
    total,
}) => {
    const activeRecords = totalRecords ?? total ?? 0;
    const activePage = currentPage ?? page ?? 1;

    return (
        <div className={cn(SIATC_THEME.TABLE.FOOTER, "flex-col sm:flex-row gap-3 py-3 sm:py-2 items-center justify-between text-center sm:text-left")}>
            <p className={SIATC_THEME.TYPOGRAPHY.FOOTER_STATS}>
                {label}:&nbsp;<span className="text-foreground font-black opacity-100">{activeRecords}</span>
            </p>

            {showPaging && totalPages > 1 && (
                <div className="flex items-center gap-2">
                    <button
                        disabled={activePage === 1}
                        onClick={() => onPageChange?.(activePage - 1)}
                        className="p-1.5 rounded-xl border border-border bg-background text-muted-foreground hover:bg-primary/5 hover:text-primary hover:border-primary/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 active:scale-95"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-1.5 px-4 py-1.5 bg-background rounded-xl border border-border shadow-inner">
                        <span className={SIATC_THEME.TYPOGRAPHY.FOOTER_STATS}>
                            Pág. <span className="text-primary opacity-100">{activePage}</span> / {totalPages}
                        </span>
                    </div>
                    <button
                        disabled={activePage === totalPages}
                        onClick={() => onPageChange?.(activePage + 1)}
                        className="p-1.5 rounded-xl border border-border bg-background text-muted-foreground hover:bg-primary/5 hover:text-primary hover:border-primary/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 active:scale-95"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
};

interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
    containerClassName?: string;
    /** Densidad compacta, para el detalle dentro de un modal. Por defecto, listado. */
    densa?: boolean;
}

export const SIATCTable: React.FC<TableProps> = ({ children, className, containerClassName, densa = false, ...props }) => {
    const estilos = densa ? SIATC_THEME.TABLE_DENSA : SIATC_THEME.TABLE;
    return (
        <ContextoDensidad.Provider value={densa}>
            <div className={cn(estilos.SCROLL_AREA, containerClassName)}>
                <table className={cn(estilos.TABLE_ELEMENT, className)} {...props}>
                    {children}
                </table>
            </div>
        </ContextoDensidad.Provider>
    );
};
