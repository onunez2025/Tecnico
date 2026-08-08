import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import LottieImport, { type LottieRefCurrentProps } from 'lottie-react';

// lottie-react no declara "exports" en su package.json (solo main/module/browser) -- bajo
// Rolldown (Vite 8+) el prebundler resuelve el build UMD y envuelve todo el objeto de exports
// como default, en vez de solo el componente (import Lottie termina siendo
// { default: Lottie, useLottie, ... } en vez de Lottie directo), lo que crashea React con
// "Element type is invalid: ... got: object" -- pantalla en blanco total. Bundlers basados en
// esbuild/Rollup (Vite 6/7) no tienen este problema y ya devuelven el componente correcto, por
// lo que este fallback no les afecta (su propio ".default" no existe y cae al operando derecho).
const Lottie = (LottieImport as unknown as { default?: typeof LottieImport }).default ?? LottieImport;

interface LottiePlayerProps {
    /** Import dinámico del JSON de la animación — evita sumarlo al bundle inicial. */
    src: () => Promise<{ default: object }>;
    /** Ícono/frame estático mostrado si el usuario prefiere menos movimiento o si el asset no carga. */
    fallback: ReactNode;
    loop?: boolean;
    className?: string;
    onComplete?: () => void;
    /** Se dispara justo cuando el JSON terminó de cargar y la animación arranca desde el frame 0 (no cuando el componente se monta) -- para temporizadores que dependen de "cuanto dura visible", no de "cuanto tardo en llegar por red". */
    onReady?: () => void;
    /** Multiplicador de velocidad de reproducción (1 = normal, 0.6 = 40% más lento). lottie-react no lo expone como prop declarativa -- se aplica via lottieRef.setSpeed(). */
    speed?: number;
    /**
     * Reemplazo de colores `{ '#RRGGBB': '#RRGGBB' }` aplicado tras cargar el JSON.
     *
     * Los colores de una animación Lottie viven dentro del propio JSON, no en CSS, así que ninguna
     * clase de Tailwind los adapta al tema. Sin esto, una animación dibujada para fondo claro
     * desaparece en modo oscuro: la del reloj de arena usa `#021331`, que contra el fondo oscuro
     * `#050F1A` da 1,05:1 de contraste — invisible.
     *
     * Se recolorea en memoria en vez de mantener dos archivos por animación: un JSON duplicado se
     * desincroniza en cuanto alguien cambia el diseño de uno solo.
     */
    colores?: Record<string, string>;
}

/** `#RRGGBB` a la terna 0-1 que usa Lottie. Devuelve `null` si el texto no es un hex válido. */
function hexATerna(hex: string): [number, number, number] | null {
    const limpio = hex.trim().replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(limpio)) return null;
    return [
        parseInt(limpio.slice(0, 2), 16) / 255,
        parseInt(limpio.slice(2, 4), 16) / 255,
        parseInt(limpio.slice(4, 6), 16) / 255,
    ];
}

/**
 * Devuelve una copia de la animación con los colores reemplazados.
 *
 * Recorre el árbol buscando rellenos (`fl`) y trazos (`st`) con color fijo. Los colores animados
 * —los que traen fotogramas clave— se dejan intactos: reemplazarlos exigiría reescribir cada
 * fotograma y ninguna animación del ecosistema los usa.
 *
 * La comparación es con tolerancia porque el hex de ida y vuelta no siempre da el mismo decimal
 * que guardó After Effects.
 */
function recolorar(datos: object, mapa: Record<string, string>): object {
    const equivalencias = Object.entries(mapa)
        .map(([desde, hacia]) => ({ desde: hexATerna(desde), hacia: hexATerna(hacia) }))
        .filter((e): e is { desde: [number, number, number]; hacia: [number, number, number] } =>
            e.desde !== null && e.hacia !== null);
    if (equivalencias.length === 0) return datos;

    const copia = JSON.parse(JSON.stringify(datos));

    const recorrer = (nodo: unknown): void => {
        if (Array.isArray(nodo)) {
            nodo.forEach(recorrer);
            return;
        }
        if (nodo === null || typeof nodo !== 'object') return;

        const objeto = nodo as Record<string, unknown>;
        const color = objeto.c as { a?: number; k?: unknown } | undefined;
        if ((objeto.ty === 'fl' || objeto.ty === 'st') && color?.a === 0 && Array.isArray(color.k)) {
            const actual = color.k as number[];
            const coincide = equivalencias.find((e) =>
                e.desde.every((canal, i) => Math.abs(canal - (actual[i] ?? -1)) < 0.01));
            if (coincide) color.k = [...coincide.hacia, actual[3] ?? 1];
        }

        Object.values(objeto).forEach(recorrer);
    };

    recorrer(copia);
    return copia;
}

/**
 * Reproductor Lottie compartido para "momentos de marca curados" (ver plan
 * SIATC Memory: plan-animaciones-lottie-microinteracciones.md, sección 5.3).
 * Respeta prefers-reduced-motion y degrada a un ícono estático si el JSON
 * no carga, en vez de dejar un espacio vacío.
 */
export function LottiePlayer({ src, fallback, loop = true, className, onComplete, onReady, speed = 1, colores }: LottiePlayerProps) {
    const [animationData, setAnimationData] = useState<object | null>(null);
    const [failed, setFailed] = useState(false);
    const [reducedMotion] = useState(
        () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
    const lottieRef = useRef<LottieRefCurrentProps | null>(null);

    useEffect(() => {
        if (reducedMotion) return;
        let cancelled = false;
        src()
            .then((mod) => { if (!cancelled) { setAnimationData(mod.default); onReady?.(); } })
            .catch(() => { if (!cancelled) setFailed(true); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- onReady se llama una vez por carga real, no debe reiniciar el import si cambia de identidad
    }, [src, reducedMotion]);

    useEffect(() => {
        if (animationData) lottieRef.current?.setSpeed(speed);
    }, [animationData, speed]);

    /*
     * El recoloreado se recalcula al cambiar el tema, no solo al cargar: si se conmuta claro/oscuro
     * con la animación en pantalla, tiene que seguirlo. La clave del memo es el mapa serializado
     * porque quien llama suele pasar un objeto literal, y su identidad cambia en cada render.
     */
    const claveColores = colores ? JSON.stringify(colores) : '';
    const datosPintados = useMemo(
        () => (animationData && claveColores ? recolorar(animationData, JSON.parse(claveColores)) : animationData),
        [animationData, claveColores],
    );

    if (reducedMotion || failed || !datosPintados) {
        return <>{fallback}</>;
    }

    return (
        <Lottie
            lottieRef={lottieRef}
            animationData={datosPintados}
            loop={loop}
            onComplete={onComplete}
            className={className}
        />
    );
}
