import { useEffect, useState } from 'react';

/**
 * Indica si el tema oscuro está activo **en este momento**.
 *
 * No lee el `ThemeContext` a propósito. Ese contexto guarda la *preferencia*, que puede ser
 * `'system'`, y `'system'` no dice si el resultado es claro u oscuro. Lo que sí lo dice es la clase
 * `dark` que `ThemeProvider` deja en `<html>`, y observarla cubre los tres casos de una vez:
 * elección explícita, preferencia del sistema, y cambio del sistema con la app abierta.
 *
 * Hace falta para las animaciones Lottie: sus colores viven dentro del JSON, no en CSS, así que
 * ninguna clase de Tailwind puede adaptarlas. Hay que saber el tema en JavaScript para reemplazarlos.
 */
export function useTemaOscuro(): boolean {
    const [oscuro, setOscuro] = useState(
        () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
    );

    useEffect(() => {
        const raiz = document.documentElement;
        const revisar = () => setOscuro(raiz.classList.contains('dark'));
        revisar();

        const observador = new MutationObserver(revisar);
        observador.observe(raiz, { attributes: true, attributeFilter: ['class'] });
        return () => observador.disconnect();
    }, []);

    return oscuro;
}

export default useTemaOscuro;
