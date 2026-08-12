import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
    .use(Backend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: 'es',
        // El navegador pide el idioma con region: en Peru lo normal es `es-419` (espanol de
        // Latinoamerica), y tambien aparecen `es-PE` o `en-US`. i18next pedia entonces
        // /locales/es-419.json, que no existe; el servidor respondia con el index.html y la
        // carga fallaba con "failed parsing ... to json" en cada arranque. Funcionaba igual
        // porque caia al respaldo, pero dejaba un error en la consola de todo usuario con
        // idioma regional configurado.
        //
        // `languageOnly` normaliza es-419 / es-PE / es-ES a `es` antes de pedir el archivo, asi
        // que la peticion fallida no llega a hacerse. Comprobado que ninguna app tiene ficheros
        // de idioma por region que se pudieran perder.
        load: 'languageOnly',
        debug: true,
        interpolation: {
            escapeValue: false,
        },
        backend: {
            loadPath: '/locales/{{lng}}.json',
        },
    });

export default i18n;
