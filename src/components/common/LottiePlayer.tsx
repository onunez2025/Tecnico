import { useEffect, useRef, useState, type ReactNode } from 'react';
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
}

/**
 * Reproductor Lottie compartido para "momentos de marca curados" (ver plan
 * SIATC Memory: plan-animaciones-lottie-microinteracciones.md, sección 5.3).
 * Respeta prefers-reduced-motion y degrada a un ícono estático si el JSON
 * no carga, en vez de dejar un espacio vacío.
 */
export function LottiePlayer({ src, fallback, loop = true, className, onComplete, onReady, speed = 1 }: LottiePlayerProps) {
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

    if (reducedMotion || failed || !animationData) {
        return <>{fallback}</>;
    }

    return (
        <Lottie
            lottieRef={lottieRef}
            animationData={animationData}
            loop={loop}
            onComplete={onComplete}
            className={className}
        />
    );
}
