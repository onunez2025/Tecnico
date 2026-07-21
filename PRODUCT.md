# Product

## Register

product

## Platform

web

## Users

Dos audiencias igual de prioritarias, con contextos físicos muy distintos entre sí. **Técnicos de campo** usan la app desde el celular en la calle o en el domicilio del cliente — a menudo con una mano ocupada sosteniendo una herramienta o equipo, bajo luz solar directa, con conectividad intermitente en zonas sin buena señal. Sus tareas típicas son consultar el ticket/agenda del día, registrar una visita completada, cargar un pago o voucher, y reportar una oportunidad de venta. **Supervisores** usan la app desde tablet, normalmente en oficina o vehículo, con ambas manos libres, sesiones más largas y conectividad estable — revisan cumplimiento del equipo, aprueban pagos y consultan auditoría/configuración. El diseño móvil-tablet debe servir bien a ambos desde el inicio, no priorizar uno y adaptar el otro después.

## Product Purpose

Technical (Gestión Técnica) es la herramienta operativa donde los técnicos de campo de MT Industrial / Sole registran su trabajo diario — agenda, visitas, pagos/vouchers, oportunidades de venta — y donde supervisores controlan y auditan esa operación. Existe para reemplazar el registro disperso en papel, WhatsApp y llamadas por un flujo único y confiable. El éxito de la iniciativa de UI/UX móvil-tablet se mide en **menos errores y menos retrabajo**: menos visitas mal registradas, pagos con datos incompletos o información perdida por dificultad de uso en el celular — no solo en que la app se vea mejor.

## Positioning

Registro confiable incluso con mala señal: el técnico completa su trabajo (marcar visita, registrar pago, reportar venta) aunque la conectividad falle en campo, sin depender de papel ni de WhatsApp y sin perder información en el camino.

## Brand Personality

Moderna, ágil, profesional. La experiencia debe sentirse a la altura de una empresa seria (no una herramienta improvisada) pero liviana y rápida de usar con una sola mano — nunca una réplica encogida del dashboard de escritorio.

## Anti-references

Sin anti-referencias puntuales de producto — el usuario prefiere que el diseño derive del contexto de uso real (campo, una mano, sol directo, conectividad intermitente) en vez de imitar una app específica. Evitar explícitamente: decoración que reste velocidad de uso en campo, y cualquier patrón que asuma silenciosamente el mismo contexto físico que un escritorio de oficina (dos manos libres, buena luz, conexión estable).

## Design Principles

- **Una mano, sol directo, sin asumir escritorio.** Cada decisión táctil, de contraste y de densidad se valida contra el contexto real de un técnico en la calle, no contra un monitor de oficina.
- **La confiabilidad ante mala conectividad es la ventaja estratégica, no un detalle técnico.** El diseño debe comunicar y sostener visiblemente el estado de guardado/sincronización (pendiente, guardado, error, reintento) — no ocultarlo como si la conexión siempre fuera estable.
- **Reducir errores y retrabajo es la métrica de éxito, no la estética por sí sola.** Priorizar claridad, prevención de error y confirmación explícita sobre densidad visual o adornos.
- **Un mismo sistema de tokens sirve a dos contextos físicos distintos** (campo con una mano / oficina con tablet) — se resuelve con tokens que se adaptan por breakpoint/dispositivo, nunca duplicando la app o el sistema de diseño.
- **Coherencia con `SIATC_THEME`.** Todo patrón nuevo de esta iniciativa se define una sola vez en el sistema de tokens compartido y se vuelve configurable desde SIATC Console, igual que ya sucede hoy con el branding de escritorio (`theme_config`) — nunca se resuelve app por app de forma ad-hoc.

## Accessibility & Inclusion

Sin nivel WCAG formal exigido. Cuidar lo básico de forma no negociable: buen contraste (incluida la legibilidad bajo luz solar directa, no solo en laboratorio), texto legible a distintos tamaños, y áreas táctiles suficientemente grandes para uso con una mano o con guantes.
