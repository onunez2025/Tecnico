import { useEffect, useRef, useState } from 'react';

/**
 * Tiempo mínimo que una pantalla de carga permanece visible, en milisegundos.
 *
 * El valor no es arbitrario. La animación del reloj de arena dura 2,4 s por vuelta y su giro va del
 * fotograma 20 al 30 —de 800 a 1200 ms— quedando asentada hacia el 43 (1720 ms). Cortarla antes de
 * los 1200 ms la deja a mitad de la vuelta, que se lee como un parpadeo roto y no como una
 * animación.
 *
 * 1400 ms cae después del giro y bastante antes de los ~2 s en los que la espera empieza a
 * sentirse larga. Es el punto donde la animación se entiende sin que nadie se impaciente.
 *
 * Si se quiere ajustar, este es el único número que hay que tocar en toda la app.
 */
export const MS_CARGA_MINIMA = 1400;

/**
 * Sostiene la **carga inicial** durante al menos `msMinimo`, aunque el dato llegue antes.
 *
 * Sin esto, una respuesta rápida hace que la pantalla de carga aparezca y desaparezca en unos
 * pocos fotogramas: el usuario percibe un destello, no una animación, y el resultado se siente más
 * descuidado que si no hubiera nada.
 *
 * **Solo se arma una vez.** El mínimo cuenta desde el primer render en que `cargando` es `true`.
 * Si más adelante se vuelve a cargar —una recarga, un cambio de filtro— la pantalla aparece y
 * desaparece sin espera añadida. Es deliberado: la ceremonia tiene sentido al entrar a la app, no
 * cada vez que se refresca algo, donde 1,4 s de retención sería puro estorbo.
 *
 * Detalle de implementación que conviene no "simplificar": el único `setState` ocurre dentro del
 * `setTimeout`, nunca de forma síncrona dentro del efecto, y el identificador del temporizador vive
 * en una ref que solo se toca dentro de efectos. Las dos cosas las exige el lint de React del
 * proyecto —`set-state-in-effect` y `refs-during-render`— y ambas reglas tienen razón: la versión
 * directa encadena renders y lee una ref en el render, donde no es reactiva.
 *
 * @param cargando  El estado real de carga.
 * @param msMinimo  Milisegundos mínimos visibles.
 * @returns `true` mientras haya que seguir mostrando la pantalla de carga.
 */
export function useCargaMinima(cargando: boolean, msMinimo: number = MS_CARGA_MINIMA): boolean {
    // Si en el primer render ya se está cargando, nace reteniendo. Si no, no hay nada que retener.
    const [reteniendo, setReteniendo] = useState(cargando);
    const temporizador = useRef<number | null>(null);

    useEffect(() => {
        if (!cargando || temporizador.current !== null) return;

        // El temporizador NO se cancela cuando `cargando` pasa a false — ahí es justo cuando hace
        // falta que siga corriendo. Solo lo cancela el desmontaje, en el efecto de abajo.
        temporizador.current = window.setTimeout(() => {
            temporizador.current = null;
            setReteniendo(false);
        }, msMinimo);
    }, [cargando, msMinimo]);

    useEffect(() => () => {
        if (temporizador.current !== null) clearTimeout(temporizador.current);
    }, []);

    return cargando || reteniendo;
}

export default useCargaMinima;
