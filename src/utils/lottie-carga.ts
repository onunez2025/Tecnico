/**
 * Piezas compartidas de la animación de carga del ecosistema.
 *
 * Están fuera del componente por dos motivos concretos:
 *
 * 1. `LottiePlayer` recibe el import dinámico como prop y lo usa dentro de un `useEffect` que
 *    depende de él. Una función flecha escrita en el JSX cambia de identidad en cada render, así
 *    que el efecto se volvería a disparar una y otra vez. Declarada una sola vez a nivel de módulo,
 *    la identidad es estable y el import ocurre una sola vez.
 * 2. El mapa de colores es el mismo en las 11 apps; tenerlo en un solo lugar por app evita que se
 *    desincronice al retocar el tema.
 */

/** Import diferido: la animación no entra en el bundle inicial. */
export const cargarAnimacionCarga = () => import('../assets/lottie/loading.json');

/**
 * Recoloreado para modo oscuro de la animación de carga.
 *
 * El reloj de arena está dibujado para fondo claro: su armazón usa `#021331`, que contra el fondo
 * oscuro `#050F1A` da **1,05:1** de contraste. Es decir, invisible — en modo oscuro solo se vería
 * la arena flotando sin reloj alrededor.
 *
 * `#E2E4E9` es el gris claro del tema (`SIATC_THEME`), y contra `#050F1A` da 15,6:1. La arena
 * (`#707F99`) se deja como está: ya cumple en ambos fondos (3,87:1 en claro, 4,76:1 en oscuro).
 */
export const COLORES_LOTTIE_OSCURO: Record<string, string> = {
    '#021331': '#E2E4E9',
};
