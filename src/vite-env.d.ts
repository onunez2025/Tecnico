/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_COOKIE_DOMAIN?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
