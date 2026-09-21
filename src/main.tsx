import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppConfigProvider } from './context/AppConfigContext';
import './index.css';
import './i18n';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppConfigProvider>
      <App />
    </AppConfigProvider>
  </React.StrictMode>
);

/**
 * Service worker: lo que hace que Chrome ofrezca «Instalar». Se registra después de `load` para no competir con la
 * carga de la aplicación, y solo en producción: en desarrollo un worker cacheando estorba más de lo que ayuda.
 *
 * `updateViaCache: 'none'` obliga al navegador a pedir el propio `sw.js` a la red en cada comprobación, que es como se
 * entera de que hay una versión nueva tras un despliegue.
 */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .catch(err => console.warn('[PWA] No se pudo registrar el service worker:', err));
  });
}
