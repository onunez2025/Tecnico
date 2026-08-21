import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

/*
 * ── Convenciones de interfaz del Ecosistema SIATC ────────────────────────────────────────────
 *
 * Lo que estas reglas impiden ya paso de verdad, y paso con lint, build y tipos EN VERDE: por eso
 * son reglas y no un acuerdo verbal. Cada mensaje dice QUE usar en su lugar, para que el aviso
 * resuelva en vez de solo prohibir.
 *
 * Los selectores se declaran sueltos porque las excepciones NO son "apagar la regla en este
 * fichero", sino "aqui esta permitida esta parte y el resto sigue vigilado". Un fichero que define
 * colores puede escribir hex, pero no por eso se le permite un <table> a mano.
 */
const SEL_TABLA = {
  selector: "JSXOpeningElement[name.name='table']",
  message: 'Usa <SIATCTable> de components/siatc/table, no un <table> suelto: trae cabecera pegajosa, filas de 64px, pie con paginacion y columnas redimensionables.',
}

const SEL_COLOR = [
  {
    selector: "Literal[value=/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/]",
    message: 'No pongas colores en crudo: usa los tokens de utils/siatc-theme.ts. Un hex fijo no cambia con el modo oscuro.',
  },
  {
    selector: "Literal[value=/(bg|text|border|ring|fill|stroke)-\\[#[0-9a-fA-F]{3,8}\\]/]",
    message: 'No pongas colores en crudo dentro de clases: usa los tokens de utils/siatc-theme.ts.',
  },
  {
    selector: "TemplateElement[value.raw=/(bg|text|border|ring|fill|stroke)-\\[#[0-9a-fA-F]{3,8}\\]/]",
    message: 'No pongas colores en crudo dentro de clases: usa los tokens de utils/siatc-theme.ts.',
  },
]

const SEL_FETCH = {
  selector: "CallExpression[callee.name='fetch']",
  message: 'Usa apiClient de services/apiClient, no fetch() directo: pone el token, resuelve la URL base y trata los errores igual en todas las apps.',
}

/*
 * La frontera de autenticacion. Estos ficheros corren ANTES de que exista sesion —o son los que la
 * cierran—, asi que no pueden pasar por apiClient: apiClient lee el token del almacenamiento, y
 * aqui todavia no hay token, o llega por cookie, o es el propio inicio de sesion quien lo pide.
 * Encauzarlos por apiClient no los mejoraria: crearia una dependencia circular con la sesion.
 *
 * Los colores y las tablas SI se les siguen exigiendo.
 */
const FRONTERA_AUTENTICACION = [
  '**/hooks/useAuth.tsx',
  '**/context/AppConfigContext.tsx',
  '**/pages/LoginPage.tsx',
  '**/pages/SsoLoginPage.tsx',
  '**/pages/SsoStatusPage.tsx',
]

/*
 * Ficheros donde el color NO puede salir del tema. Son de tres clases, y ninguna es descuido:
 *
 *   1. Donde el color se DEFINE: el tema y la paleta de la animacion de carga.
 *   2. Marcas de terceros: el azul de Google es `#4285F4` y no puede depender de nuestro modo
 *      oscuro — sus guias exigen reproducir el logo con sus colores exactos.
 *   3. Lo que se IMPRIME: tinta sobre papel. Una etiqueta con un token saldria en blanco sobre
 *      blanco si el usuario la manda a imprimir desde el tema oscuro.
 *
 * A todos se les siguen exigiendo las tablas y el apiClient.
 */
const DEFINICIONES_DE_COLOR = [
  '**/utils/siatc-theme.ts',
  '**/utils/lottie-carga.ts',
  '**/components/common/LogosProveedores.tsx',
  '**/components/common/EtiquetaImpresion.tsx',
]

export default defineConfig([
  globalIgnores(['dist', 'scratch']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      'no-restricted-syntax': ['error', SEL_TABLA, ...SEL_COLOR, SEL_FETCH],
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
  {
    // La frontera de autenticacion: se le perdona `fetch`, no los colores ni las tablas.
    files: FRONTERA_AUTENTICACION,
    rules: { 'no-restricted-syntax': ['error', SEL_TABLA, ...SEL_COLOR] },
  },
  {
    // Donde el color se define: se le perdona el hex, no las tablas ni el `fetch`.
    files: DEFINICIONES_DE_COLOR,
    rules: { 'no-restricted-syntax': ['error', SEL_TABLA, SEL_FETCH] },
  },
  {
    // El unico sitio donde `fetch` es correcto por definicion.
    files: ['**/services/apiClient.ts'],
    rules: { 'no-restricted-syntax': ['error', SEL_TABLA, ...SEL_COLOR] },
  },
  {
    // El componente que DEFINE la tabla: es el unico <table> legitimo del proyecto.
    files: ['**/components/siatc/table/**'],
    rules: { 'no-restricted-syntax': ['error', ...SEL_COLOR, SEL_FETCH] },
  },
  {
    // El servidor: ni JSX, ni tema, ni apiClient.
    files: ['server/**'],
    rules: { 'no-restricted-syntax': 'off' },
  },
])
