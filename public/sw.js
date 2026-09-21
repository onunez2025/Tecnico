/**
 * Service worker de Technical: lo mínimo para que Chrome ofrezca «Instalar», sin arriesgar que alguien se quede
 * con una versión vieja de la aplicación.
 *
 * La decisión que manda aquí: **la navegación va siempre a la red primero**. Un service worker que sirve el HTML
 * desde caché es lo que hace que, tras un despliegue, media oficina siga viendo la versión anterior sin saberlo —y en
 * este ecosistema se despliega solo, por webhook, varias veces al día—. Así que el caché solo entra cuando la red
 * falla, y entonces se muestra una página honesta de «sin conexión».
 *
 * Qué NO se cachea nunca:
 *   - `/api/*`: son datos y sesión. Servir una respuesta vieja aquí es peor que un error.
 *   - El HTML de la aplicación: ver arriba.
 *
 * Qué sí:
 *   - `/assets/*`, que Vite genera con un hash en el nombre: si el contenido cambia, el nombre cambia, así que servir
 *     desde caché no puede devolver nada obsoleto.
 *   - La página de «sin conexión» y los iconos, que es lo que hace falta para arrancar sin red.
 */
const VERSION = 'tec-v1';
const ESENCIALES = ['/offline.html', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', evento => {
    // `skipWaiting`: la versión nueva toma el control sin esperar a que se cierren las pestañas abiertas.
    evento.waitUntil(caches.open(VERSION).then(c => c.addAll(ESENCIALES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', evento => {
    evento.waitUntil(
        caches.keys()
            .then(claves => Promise.all(claves.filter(c => c !== VERSION).map(c => caches.delete(c))))
            .then(() => self.clients.claim()),
    );
});

self.addEventListener('fetch', evento => {
    const peticion = evento.request;
    if (peticion.method !== 'GET') return;

    const url = new URL(peticion.url);
    if (url.origin !== self.location.origin) return;     // CDNs y APIs de terceros: sin tocar
    if (url.pathname.startsWith('/api/')) return;        // datos y sesión: nunca desde caché

    // Navegación: red primero; el caché es solo el plan B cuando no hay conexión.
    //
    // `cache: 'no-store'` no es un detalle: sin él, un `fetch` sin red puede resolverse desde el caché HTTP del propio
    // navegador y devolver el HTML antiguo. Medido el 2026-09-21: en vez de la página de «sin conexión» salía la
    // aplicación cargando para siempre, porque el armazón sí estaba en caché pero la API no respondía. Pidiéndolo
    // siempre a la red, sin conexión falla de verdad y se muestra el aviso honesto; y con conexión, nadie se queda con
    // una versión vieja tras un despliegue. El HTML pesa dos kilobytes: el coste es irrelevante.
    if (peticion.mode === 'navigate') {
        evento.respondWith(
            fetch(peticion.url, { cache: 'no-store', credentials: 'same-origin' })
                .catch(() => caches.match('/offline.html')),
        );
        return;
    }

    // Recursos con hash en el nombre: seguros de cachear, porque otro contenido implica otro nombre.
    if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
        evento.respondWith(
            caches.match(peticion).then(guardado => guardado || fetch(peticion).then(respuesta => {
                if (respuesta.ok) { const copia = respuesta.clone(); caches.open(VERSION).then(c => c.put(peticion, copia)); }
                return respuesta;
            })),
        );
    }
});
