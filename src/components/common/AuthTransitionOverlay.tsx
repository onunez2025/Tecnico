import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LogOut, ShieldCheck } from 'lucide-react';
import { LottiePlayer } from './LottiePlayer';

interface AuthTransitionOverlayProps {
    variant: 'welcome' | 'farewell';
    userName?: string;
    onComplete: () => void;
}

/**
 * Tope de seguridad -- SOLO se usa si el asset de Lottie nunca llega a cargar
 * (ej. red caida). El cierre real del overlay lo dispara el evento
 * `onComplete` genuino de la animacion (ver LottiePlayer -> lottie-react),
 * nunca un temporizador fijo desde el montaje: un timer asi se desincroniza
 * del tiempo real de carga+reproduccion (que depende de la red) y termina
 * cortando la animacion a mitad de camino en conexiones lentas, o dejandola
 * "de mas" en las rapidas. Bug reportado por Diego tras 3bbe1f5/a1e61c1.
 */
const SAFETY_MAX_MS = 5000;

/** Ambas animaciones corren a esta velocidad (1 = normal) -- Diego pidió más tiempo de pantalla para poder apreciarlas, no solo evitar que se corten. */
const PLAYBACK_SPEED = 0.6;

/**
 * login-verified.json (huella -> checkmark) tiene un quirk de autoria: cada
 * capa tiene su propio "out point" en el frame 105 (~1750ms), mas corto que
 * la composicion completa (120 frames, ~2000ms) -- el evento `onComplete`
 * generico de Lottie espera a la composicion completa, dejando un hueco en
 * blanco de ~250-300ms ANTES de que dispare (verificado con Playwright:
 * capa visible hasta ~1600ms, invisible desde ahi). Por eso welcome usa un
 * tiempo fijo propio en vez de onComplete -- pero medido desde `onReady`
 * (cuando el asset ya cargo y arranco a reproducirse), no desde que se monta
 * el overlay, para no reintroducir el bug original de cortarla en conexiones
 * lentas. Ventana medida con Playwright a PLAYBACK_SPEED (0.6x, ver
 * abajo) con carga dinámica real: check completo y estable entre
 * 2600-2800ms, invisible desde 2900ms -- se elige un valor centrado en
 * esa ventana con margen a ambos lados.
 */
const WELCOME_VISIBLE_MS = 2700;

export function AuthTransitionOverlay({ variant, userName, onComplete }: AuthTransitionOverlayProps) {
    const { t } = useTranslation();
    const isWelcome = variant === 'welcome';
    const namePart = userName ? `, ${userName}` : '';
    const firedRef = useRef(false);

    const finish = () => {
        if (firedRef.current) return;
        firedRef.current = true;
        onComplete();
    };

    useEffect(() => {
        const safety = setTimeout(finish, SAFETY_MAX_MS);
        return () => clearTimeout(safety);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- solo un tope de seguridad al montar, no debe reiniciarse en cada render
    }, []);

    return (
        // El fondo NO se anima (sin fade-in) -- si el propio overlay se desvanece hacia
        // adentro, durante esos ~300ms se transparenta y deja ver la pagina real de atras
        // (MainLayout ya montado y renderizando detras). El overlay debe cubrir TODO desde
        // el primer frame; solo el contenido interno (icono + texto) puede tener su propia
        // entrada, ya que el fondo solido ya lo esta ocultando todo.
        <div className="fixed inset-0 bg-background flex items-center justify-center z-[200]">
            <div className="flex flex-col items-center text-center gap-4 animate-in fade-in duration-300">
                {isWelcome ? (
                    <div className="w-32 h-32">
                        <LottiePlayer
                            src={() => import('../../assets/lottie/login-verified.json')}
                            fallback={<ShieldCheck className="w-16 h-16 text-primary" />}
                            loop={false}
                            speed={PLAYBACK_SPEED}
                            onReady={() => setTimeout(finish, WELCOME_VISIBLE_MS)}
                        />
                    </div>
                ) : (
                    // goodbye.json es 1920x1080 (16:9) y usa colores fijos (no
                    // "currentColor") pensados para fondo claro -- dark:invert
                    // lo hace legible tambien en tema oscuro sin tocar el JSON.
                    <div className="w-56 aspect-video dark:invert">
                        <LottiePlayer
                            src={() => import('../../assets/lottie/goodbye.json')}
                            fallback={<LogOut className="w-16 h-16 text-primary" />}
                            loop={false}
                            speed={PLAYBACK_SPEED}
                            onComplete={finish}
                        />
                    </div>
                )}
                <h2 className="text-xl font-bold text-foreground">
                    {t(isWelcome ? 'auth.transition.welcomeTitle' : 'auth.transition.farewellTitle', { name: namePart })}
                </h2>
            </div>
        </div>
    );
}
