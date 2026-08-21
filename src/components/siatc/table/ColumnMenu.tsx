import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, Check, ChevronDown, FilterX } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { SIATC_THEME } from '../../../utils/siatc-theme';

/**
 * Menu de columna: ordenar y filtrar, escondidos detras de la propia cabecera.
 *
 * Sustituye al renglon de controles siempre visible. Un filtro por columna se usa a rafagas —se
 * abre, se elige y se cierra— asi que tenerlo permanentemente en pantalla gasta una franja
 * completa de la tabla para algo que casi nunca se esta tocando, y mete seis cajas entre el
 * titulo de cada columna y sus datos. Aqui la cabecera se lee limpia y el control aparece donde
 * se pide.
 *
 * ⚠️ El panel se dibuja en un PORTAL con posicion fija, no dentro del `<th>`.
 *
 * La tabla vive en un contenedor con `overflow: auto` (SIATC_THEME.TABLE.SCROLL_AREA). Un
 * desplegable colocado en flujo normal dentro de ese contenedor **se recorta** contra su borde:
 * las columnas de la derecha lo mostrarian cortado y las ultimas filas lo esconderian del todo.
 * Por eso se calcula la posicion desde el rectangulo del boton y se monta en `document.body`.
 *
 * El panel se cierra al hacer scroll en vez de reposicionarse. Reposicionar exige seguir cada
 * ancestro desplazable y se desincroniza en cuanto uno de ellos usa scroll suave; cerrar es
 * honesto y es lo que hace cualquier menu nativo.
 */

export type DireccionOrden = 'ASC' | 'DESC';

interface ColumnMenuProps {
    etiqueta: string;
    /** Direccion activa EN ESTA columna. `null` si la tabla esta ordenada por otra. */
    orden: DireccionOrden | null;
    onOrdenar: (direccion: DireccionOrden) => void;
    /** Textos de las dos opciones de orden. Cambian segun el tipo de dato de la columna. */
    textosOrden: { asc: string; desc: string };
    /** Si esta columna tiene filtro puesto: enciende el punto y habilita "Quitar filtro". */
    filtrada: boolean;
    onQuitarFiltro: () => void;
    /** Contenido del filtro. Recibe `cerrar` para los controles que deben cerrar al elegir. */
    children: (cerrar: () => void) => React.ReactNode;
    /** Alinear el panel por la derecha del boton: para las ultimas columnas. */
    alinear?: 'izquierda' | 'derecha';
}

const ANCHO_PANEL = 268;
const MARGEN = 8;
/** Por debajo de esto no cabe ni el orden ni un filtro corto: mejor abrir hacia arriba. */
const ALTO_MINIMO = 260;

interface Posicion {
    top?: number;
    bottom?: number;
    left: number;
    maxHeight: number;
}

/** Fila del menu. A nivel de modulo para no recrear el componente en cada render. */
export const ItemMenu: React.FC<{
    icono?: React.ComponentType<{ className?: string }>;
    activo?: boolean;
    peligro?: boolean;
    onClick: () => void;
    children: React.ReactNode;
}> = ({ icono: Icono, activo, peligro, onClick, children }) => (
    <button
        type="button"
        role="menuitem"
        onClick={onClick}
        className={cn(
            'w-full flex items-center gap-2.5 px-2.5 h-9 rounded-cb-btn text-left text-sm font-semibold cursor-pointer',
            'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
            peligro
                ? 'text-cb-error hover:bg-cb-error/10'
                : activo
                    ? 'text-primary bg-primary/10'
                    : 'text-cb-text-primary hover:bg-cb-bg',
        )}
    >
        {Icono && <Icono className="w-4 h-4 shrink-0 opacity-70" />}
        <span className="flex-1 truncate">{children}</span>
        {activo && <Check className="w-4 h-4 shrink-0 text-primary" />}
    </button>
);

/** Titulillo de grupo dentro del menu. */
export const GrupoMenu: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p className="px-2.5 pt-2.5 pb-1.5 text-[10px] font-black uppercase tracking-wider text-cb-slate">
        {children}
    </p>
);

const Separador: React.FC = () => <div className="h-px bg-cb-border/70 my-1.5 -mx-1.5" />;

export const ColumnMenu: React.FC<ColumnMenuProps> = ({
    etiqueta,
    orden,
    onOrdenar,
    textosOrden,
    filtrada,
    onQuitarFiltro,
    children,
    alinear = 'izquierda',
}) => {
    const [posicion, setPosicion] = useState<Posicion | null>(null);
    const botonRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const abierto = posicion !== null;
    const destacado = abierto || filtrada || orden !== null;

    /*
     * `cerrar` NO toca el ref del boton, aunque devolver el foco al cerrar seria lo natural.
     *
     * Se entrega a `children` durante el render, asi que cualquier lectura de ref dentro de ella
     * es una lectura en render: React no lo garantiza y el lint lo rechaza. El foco se devuelve
     * desde el manejador de Escape, que si corre fuera del render — y es justo el caso donde
     * importa, porque quien cierra con teclado necesita recuperar su sitio.
     */
    const cerrar = useCallback(() => setPosicion(null), []);

    const abrir = useCallback(() => {
        const boton = botonRef.current;
        if (!boton) return;
        const r = boton.getBoundingClientRect();

        // Horizontal: se ancla al boton y se mantiene dentro de la ventana.
        const preferido = alinear === 'derecha' ? r.right - ANCHO_PANEL : r.left;
        const left = Math.min(
            Math.max(MARGEN, preferido),
            window.innerWidth - ANCHO_PANEL - MARGEN,
        );

        // Vertical: hacia abajo salvo que no quepa y arriba haya mas sitio.
        const debajo = window.innerHeight - r.bottom - MARGEN * 2;
        const encima = r.top - MARGEN * 2;
        setPosicion(
            debajo < ALTO_MINIMO && encima > debajo
                ? { bottom: window.innerHeight - r.top + 6, left, maxHeight: encima }
                : { top: r.bottom + 6, left, maxHeight: debajo },
        );
    }, [alinear]);

    /*
     * Cierre por clic fuera, Escape, scroll y cambio de tamaño.
     *
     * El scroll se escucha en fase de captura para enterarse tambien del contenedor de la tabla,
     * que es quien de verdad se desplaza y no burbujea su evento hasta window.
     */
    useEffect(() => {
        if (!abierto) return;

        const fuera = (e: MouseEvent) => {
            const destino = e.target as Node;
            if (!panelRef.current?.contains(destino) && !botonRef.current?.contains(destino)) {
                setPosicion(null);
            }
        };
        const teclado = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            setPosicion(null);
            botonRef.current?.focus();
        };
        const mover = () => setPosicion(null);

        document.addEventListener('mousedown', fuera);
        document.addEventListener('keydown', teclado);
        window.addEventListener('scroll', mover, true);
        window.addEventListener('resize', mover);
        return () => {
            document.removeEventListener('mousedown', fuera);
            document.removeEventListener('keydown', teclado);
            window.removeEventListener('scroll', mover, true);
            window.removeEventListener('resize', mover);
        };
    }, [abierto]);

    return (
        <>
            <button
                ref={botonRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={abierto}
                aria-label={`${etiqueta}: ordenar y filtrar`}
                onClick={() => (abierto ? cerrar() : abrir())}
                className={cn(
                    'group/menu flex items-center gap-1.5 max-w-full min-w-0 h-8 px-1.5 -mx-1.5 rounded-cb-btn cursor-pointer',
                    'transition-colors hover:bg-cb-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                    abierto && 'bg-cb-bg',
                )}
            >
                <span
                    className={cn(
                        SIATC_THEME.TYPOGRAPHY.TABLE_HEADER,
                        'truncate transition-colors',
                        destacado && 'text-primary',
                    )}
                >
                    {etiqueta}
                </span>

                {/* Punto: esta columna filtra. Es lo unico que delata un filtro plegado. */}
                {filtrada && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}

                {orden === 'ASC' && <ArrowUp className="w-3 h-3 shrink-0 text-primary" />}
                {orden === 'DESC' && <ArrowDown className="w-3 h-3 shrink-0 text-primary" />}

                <ChevronDown
                    className={cn(
                        // Pegada al titulo, no en el borde de la columna: con columnas de
                        // 200px el extremo derecho queda tan lejos que deja de leerse como
                        // parte de esa cabecera.
                        'w-3.5 h-3.5 shrink-0 transition-all duration-200',
                        abierto
                            ? 'rotate-180 opacity-100 text-primary'
                            : cn('opacity-25 group-hover/menu:opacity-70', destacado && 'opacity-70 text-primary'),
                    )}
                />
            </button>

            {posicion && createPortal(
                <div
                    ref={panelRef}
                    role="menu"
                    aria-label={etiqueta}
                    style={{
                        top: posicion.top,
                        bottom: posicion.bottom,
                        left: posicion.left,
                        width: ANCHO_PANEL,
                        maxHeight: posicion.maxHeight,
                        // 160 ms: el menu responde a un clic, no se le mira la entrada.
                        animationDuration: '160ms',
                    }}
                    className={cn(
                        'fixed z-[120] p-1.5 overflow-y-auto custom-scrollbar normal-case tracking-normal',
                        'bg-card border border-cb-border rounded-cb-card shadow-cb-level-3',
                        'animate-in fade-in slide-in-from-top-1',
                    )}
                >
                    <ItemMenu
                        icono={ArrowUp}
                        activo={orden === 'ASC'}
                        onClick={() => { onOrdenar('ASC'); cerrar(); }}
                    >
                        {textosOrden.asc}
                    </ItemMenu>
                    <ItemMenu
                        icono={ArrowDown}
                        activo={orden === 'DESC'}
                        onClick={() => { onOrdenar('DESC'); cerrar(); }}
                    >
                        {textosOrden.desc}
                    </ItemMenu>

                    <Separador />
                    {children(cerrar)}

                    {filtrada && (
                        <>
                            <Separador />
                            <ItemMenu icono={FilterX} peligro onClick={() => { onQuitarFiltro(); cerrar(); }}>
                                Quitar filtro
                            </ItemMenu>
                        </>
                    )}
                </div>,
                document.body,
            )}
        </>
    );
};
