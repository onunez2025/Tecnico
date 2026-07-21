---
name: Technical (Gestión Técnica)
description: Herramienta operativa de campo para técnicos y supervisores de MT Industrial/Sole — registro confiable incluso con mala señal.
colors:
  primary: "#4C5F80"
  primary-dark: "#707F99"
  primary-foreground: "#FFFFFF"
  neutral-bg: "#F9FAFB"
  neutral-bg-dark: "#050F1A"
  neutral-card: "#FFFFFF"
  neutral-card-dark: "#111C2A"
  neutral-border: "#D1D5DB"
  neutral-border-dark: "#1E293B"
  cb-text-primary: "#1A1C1E"
  cb-text-primary-dark: "#F9FAFB"
  cb-text-secondary: "#515254"
  cb-text-secondary-dark: "#8A919E"
  cb-neutral: "#8A919E"
  cb-slate: "#5B616E"
  success: "#05B169"
  warning: "#F0AD4E"
  error: "#DF2935"
typography:
  display:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "0.06em"
  mono-data:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "16px"
    fontWeight: 500
    letterSpacing: "-0.01em"
rounded:
  chip: "4px"
  button: "8px"
  input: "8px"
  card: "12px"
  modal: "16px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.button}"
    padding: "0 16px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.neutral-card}"
    textColor: "{colors.cb-text-primary}"
    rounded: "{rounded.button}"
    padding: "0 16px"
    height: "36px"
  input-field:
    backgroundColor: "{colors.neutral-card}"
    textColor: "{colors.cb-text-primary}"
    rounded: "{rounded.input}"
    padding: "0 16px"
    height: "36px"
  card-container:
    backgroundColor: "{colors.neutral-card}"
    rounded: "{rounded.card}"
---

# Design System: Technical (Gestión Técnica)

## 1. Overview

**Creative North Star: "El Registro de Campo Confiable" (The Reliable Field Ledger)**

Technical existe para que un técnico registre su trabajo en la calle — con una mano ocupada, bajo sol directo, con señal que puede caerse en cualquier momento — sin perder ese registro ni tener que volver a hacerlo. Todo en el sistema visual sirve a esa promesa: colores sobrios que no compiten con el contenido, tipografía legible a distancia y bajo luz dura, y componentes que confirman cada acción con claridad porque un técnico no puede darse el lujo de dudar si su registro se guardó. Es una herramienta seria y profesional (moderna, ágil, profesional — no una vitrina, no una app de consumo), pensada para gente que ya sabe usarla y solo quiere terminar la tarea rápido y sin errores.

El sistema rechaza explícitamente cualquier decoración que reste velocidad de uso en campo, y rechaza asumir silenciosamente el mismo contexto físico que un escritorio de oficina (dos manos libres, buena luz, conexión estable) — la superficie móvil/tablet se diseña desde el contexto real, no como un escritorio encogido.

**Key Characteristics:**
- Paleta sobria de azul acero, sin colores vibrantes que compitan con datos operativos.
- Jerarquía tipográfica compacta y funcional, optimizada para escaneo rápido, no para impacto editorial.
- Elevación mínima y deliberada: plana donde importa la velocidad (móvil), sutil donde hay espacio para jerarquía (escritorio/tablet).
- Cada componente confirma su estado (guardado, pendiente, error) de forma visible — nunca silenciosa.

## 2. Colors

Paleta restringida (`Restrained`): neutrales con leve inclinación hacia el acento, y un solo acento — el azul acero — usado con moderación sobre superficies neutras.

### Primary
- **Azul Acero Técnico** (`#4C5F80` claro / `#707F99` oscuro): la única voz de acento del sistema — botones primarios, enlaces, focus rings, iconografía activa. Transmite precisión e ingeniería, nunca urgencia ni entusiasmo.

### Neutral
- **Niebla Fría** (`#F9FAFB` claro / `#050F1A` oscuro — fondo base): la superficie de trabajo, nunca protagonista.
- **Tarjeta Clara** (`#FFFFFF` claro / `#111C2A` oscuro): superficie elevada mínima para agrupar contenido relacionado.
- **Texto Primario** (`#1A1C1E` claro / `#F9FAFB` oscuro): texto de lectura principal — cumple contraste alto incluso bajo luz solar directa.
- **Texto Secundario** (`#515254` claro / `#8A919E` oscuro): metadatos, ayudas, texto de apoyo — nunca el color de un dato que el técnico necesita accionar.
- **Borde Frío** (`#D1D5DB` / `#E2E4E9` claro, `#1E293B` oscuro): divisores y contornos, siempre discretos.
- **Neutral de Sistema** (`#8A919E`): iconografía inactiva, placeholders, texto terciario.

### Named Rules
**La Regla del Acento Único.** El azul acero es el único color con intención de marca en toda la interfaz — cualquier otro color en pantalla es semántico (éxito, error, advertencia) o neutro. Nunca se introduce un segundo acento decorativo.

## 3. Typography

**Display/Body Font:** DM Sans (con fallback `ui-sans-serif, system-ui, sans-serif`)
**Mono/Data Font:** JetBrains Mono (con fallback `monospace`)

**Character:** Una sola familia sans para todo el texto de lectura — sin la fricción de mezclar dos voces — y una mono dedicada exclusivamente a datos tabulares (montos, IDs, horarios) donde la alineación importa más que la personalidad.

### Hierarchy
- **Display** (700, 40px, line-height 1.2, tracking -0.02em): títulos de página principales únicamente.
- **Headline** (700, 18px, line-height 1.2, tracking -0.02em): encabezados de sección/card destacada.
- **Title** (700, 15px, line-height 1.3, tracking -0.01em): subtítulos de sección, nombres de tarjeta.
- **Body** (400, 16px, line-height 1.5): texto de lectura general, máximo 65-75ch por línea.
- **Label** (500, 12px, line-height 1.5, tracking 0.06em, uppercase): etiquetas de campo, captions, metadatos.

### Named Rules
**La Regla del Dato Monoespaciado.** Cualquier valor tabular (montos, códigos, horas, IDs) usa JetBrains Mono con `tabular-nums` — nunca DM Sans — para que las columnas alineen visualmente y el técnico escanee números sin re-leer.

## 4. Elevation

Sistema de capas mínimas, deliberadamente asimétrico entre dispositivos: **plano en móvil, sutil en escritorio y tablet.** Bajo luz solar directa una sombra decorativa es ruido, no jerarquía — el celular prioriza contraste de color y borde sobre sombra. En escritorio/tablet, donde hay más espacio de pantalla y menos limitación lumínica, capas suaves ayudan a separar contenido.

### Shadow Vocabulary
- **Nivel 1** (`box-shadow: 0 1px 3px rgba(5,15,26,0.06)`): tarjetas de contenido en reposo (escritorio/tablet).
- **Nivel 2** (`box-shadow: 0 4px 12px rgba(5,15,26,0.08)`): elementos flotantes, dropdowns, hover de tarjeta.
- **Nivel 3** (`box-shadow: 0 12px 24px rgba(5,15,26,0.12)`): modales y overlays.

### Named Rules
**La Regla del Sol de Mediodía.** Por debajo de 768px de viewport, toda sombra decorativa y todo borde de layout colapsan a plano — la jerarquía se sostiene con color y espaciado, no con profundidad, porque una sombra sutil es invisible (y por tanto inútil) bajo sol directo.

## 5. Components

### Buttons
- **Shape:** esquinas suavemente curvas (8px, `rounded-cb-btn`).
- **Primary:** fondo Azul Acero Técnico, texto blanco, altura 36px de escritorio — **en móvil/tablet la altura mínima sube a 44-48px** para cumplir área táctil cómoda con una mano o con guantes, sin cambiar de color ni de forma.
- **Secondary:** fondo tarjeta, borde frío, mismo radio y altura que Primary.
- **Semánticos (Success/Danger/Warning/Info):** mismo radio y altura; solo cambia el color de fondo (`#05B169` / `#DF2935` / iconografía de advertencia / azul acero) — nunca se introduce un color nuevo fuera de esta paleta semántica ya fijada.
- **Hover/Focus:** transición de 200ms, focus ring de 4px al 10-20% de opacidad del color primario — visible pero no invasivo.

### Cards / Containers
- **Corner Style:** 12px (`rounded-cb-card`).
- **Background:** superficie "Tarjeta Clara".
- **Shadow Strategy:** Nivel 1 en reposo en escritorio/tablet; plano en móvil (ver Elevation).
- **Border:** 1px "Borde Frío", se colapsa a 0 en móvil.
- **Internal Padding:** escala con `--padding-scale`, nunca fija — permite que Console ajuste densidad por dispositivo sin tocar código.

### Inputs / Fields
- **Style:** fondo tarjeta, borde frío, radio 8px, altura 36px en escritorio.
- **En móvil/tablet:** altura mínima 44-48px, tipografía a 16px mínimo (evita el zoom automático de iOS en focus) y separación vertical generosa entre campos para uso con una mano.
- **Focus:** ring de 4px del color primario al 10% de opacidad, borde cambia a color primario sólido.
- **Error:** fondo tintado del color de error al 20%, borde y ring en color de error — siempre acompañado de texto explicando qué corregir, nunca solo color.

### Badges / Estados
- **Style:** altura 26px, radio 4px (`rounded-cb-chip`), texto 11px bold uppercase con tracking amplio.
- **Semántica:** éxito (`#E6F6EF` fondo / `#05B169` texto), advertencia (`#FFF4E5` / `#F0AD4E`), error (`#FDECEE` / `#DF2935`), info (fondo neutro / azul acero) — el color siempre acompaña un ícono, nunca es la única señal.

### Navigation
- **Estado de guardado/sincronización visible.** Dado que la conectividad en campo es intermitente, cualquier acción de registro (visita, pago, venta) debe mostrar su estado explícitamente: pendiente de sincronizar, guardado, o error de red — nunca un ícono de éxito genérico que asuma conexión estable. Este patrón es nuevo para la capa móvil/tablet y debe definirse como componente propio, no como variante silenciosa de un toast existente.

## 6. Do's and Don'ts

### Do:
- **Do** mantener el azul acero técnico (`#4C5F80` / `#707F99`) como único acento — todo lo demás es neutro o semántico.
- **Do** subir el área táctil mínima a 44-48px de alto en cualquier control interactivo en móvil/tablet, incluso donde el equivalente de escritorio usa 36px.
- **Do** usar JetBrains Mono con `tabular-nums` para cualquier valor tabular (montos, horas, IDs).
- **Do** mostrar explícitamente el estado de guardado/sincronización de cualquier registro hecho en campo (pendiente / guardado / error) — la confiabilidad ante mala señal es la promesa central del producto, no un detalle técnico oculto.
- **Do** mantener la elevación plana en móvil (<768px) y reservar sombras Nivel 1-3 para escritorio/tablet.

### Don't:
- **Don't** introducir un segundo color de acento decorativo — cualquier color nuevo debe ser semántico (éxito/error/advertencia) o neutro.
- **Don't** aplicar sombras decorativas en viewport móvil — bajo sol directo son ruido invisible, no jerarquía.
- **Don't** diseñar controles móviles como una versión encogida de los de escritorio (mismo alto de 36px, mismo espaciado) — el contexto de una mano/guantes exige áreas táctiles más grandes, no una simple escala responsiva.
- **Don't** asumir conectividad estable en ningún flujo de registro de campo — todo estado de guardado debe ser visible, nunca silencioso.
- **Don't** usar `border-left`/`border-right` como acento decorativo de color en tarjetas o alertas.
