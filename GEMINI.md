# SIATC — Reglas de Seguridad para Agentes AI

> ⚠️ **Codificación de este archivo: UTF-8, sin BOM.** Guardar siempre en UTF-8 (no Windows-1252/Latin-1/ANSI). Antes de editar este archivo con cualquier herramienta o editor, confirmar que su codificación de guardado esté configurada como UTF-8 — de lo contrario los acentos, "—" y "✅/❌" se corrompen (mojibake) de forma silenciosa y acumulativa cada vez que se vuelve a guardar con la codificación incorrecta.

Estas reglas aplican a todos los repos del ecosistema SIATC. Son obligatorias en cada cambio de código.

## 1. Autenticación — Dos middlewares, no uno

- **`verifyToken`** → solo acepta `Authorization: Bearer <token>`. Usar en **todos** los endpoints.
- **`verifyTokenForDownload`** → acepta header Y `req.query.token`. Usar **únicamente** en endpoints GET que sirven archivos descargados directamente por el browser (`window.location.href`, Excel, PDF).

**Nunca** agregar `req.query.token` al `verifyToken` principal. Si necesitas un endpoint de descarga, usa `verifyTokenForDownload`.

## 2. Row Level Security (RLS)

Todo endpoint que sirva datos (tickets, pagos, penalidades, colaboradores, técnicos) debe filtrar por empresa CAS:

```typescript
if (currentUser.casId !== null) {
    // Usuario empresa CAS — solo ve sus propios datos
    request.input('casId', sql.VarChar(50), currentUser.casId);
    query += ' AND ID_cas = @casId';
}
// casId === null → empleado Sole, ve todo
```

## 3. Tipos SQL Explícitos en .input()

Todos los `.input()` deben declarar el tipo SQL. Nunca pasar `req.params` o `req.body` directamente:

```typescript
// ✅ Correcto
.input('id', sql.UniqueIdentifier, req.params.id)
.input('name', sql.VarChar(100), req.body.name)
.input('amount', sql.Decimal(10, 2), amount)

// ❌ Incorrecto — susceptible a type confusion
.input('id', req.params.id)
```

Tipos de referencia por campo:
| Campo | Tipo SQL |
|---|---|
| EBM.Users.Id | `sql.UniqueIdentifier` |
| ID penalidad (hex 4 bytes) | `sql.VarChar(8)` |
| CAS ID | `sql.VarChar(50)` |
| RUC | `sql.VarChar(20)` |
| Nombres, textos | `sql.VarChar(N)` |
| Montos | `sql.Decimal(10, 2)` |

## 4. Path Traversal — path.resolve + startsWith

Para endpoints que sirven archivos desde una carpeta base:

```typescript
// ✅ Correcto
const fullPath = path.resolve(BASE_DIR, userInput);
if (!fullPath.startsWith(path.resolve(BASE_DIR) + path.sep)) {
    return res.status(400).json({ error: 'Ruta inválida.' });
}

// ❌ Incorrecto — la regex no cubre todos los casos de traversal
const safePath = path.normalize(input).replace(/^(\.\.[\/\\])+/, '');
```

## 5. Variables de Entorno — Sin Paths Hardcodeados

Nunca usar rutas absolutas de sistemas de archivos locales:

```typescript
// ✅ Correcto
const STORAGE_PATH = process.env.STORAGE_PATH || '';
if (!STORAGE_PATH) return res.status(503).json({ error: 'Almacenamiento no configurado.' });

// ❌ Incorrecto — ruta local que no existe en el servidor Dokploy
const STORAGE_PATH = 'C:\\Users\\someone\\OneDrive\\...';
```

## 6. Guards de Producción

Los warnings de configuración (CORS, env vars) solo deben activarse en producción:

```typescript
// ✅ Correcto
if (process.env.NODE_ENV === 'production' && !(process.env.ALLOWED_ORIGINS || '').trim()) {
    console.warn('WARNING: ALLOWED_ORIGINS no configurado.');
}
```

## 7. AppConfigContext — Autenticación en /api/applications

El endpoint `GET /api/applications` siempre debe tener `verifyToken`. El frontend (`AppConfigContext.tsx`) usa `StorageService.getToken()` para enviar el header cuando hay sesión activa. No revertir este patrón.

## 8. Antes de hacer push

Ejecutar el verificador automático:
```bash
./check-security.sh
```

O instalar como hook permanente:
```bash
cp check-security.sh .git/hooks/pre-push && chmod +x .git/hooks/pre-push
```

### 8.1 `git push` — usar siempre un timeout largo

El hook `pre-push` corre `check-security.sh` completo (`tsc`, `build` y `npm audit` sobre todo el repo) antes de dejar pasar el push. Esto puede tardar varios minutos según el tamaño del repo y la carga de la máquina — con frecuencia más de los 120 segundos que muchas herramientas de agentes usan como timeout por defecto.

**Todo agente que ejecute `git push` en cualquier repo de este ecosistema DEBE usar un timeout explícito de al menos 300000 ms (5 minutos)**, no el valor por defecto de su herramienta de shell. Un timeout corto no cancela el hook — solo mata el proceso de la terminal del agente a mitad de camino, dejando el push a medio subir (un remoto puede quedar actualizado y el otro no) sin ningún error real de Git ni del hook.

Si el push aun así no termina dentro de ese margen, verificar con `git ls-remote <remoto> <rama>` cuál de los remotos (GitHub/Forgejo) quedó desactualizado y reintentar el push únicamente contra ese remoto — no asumir que un timeout del lado del agente significa que el push falló del lado de Git.

## 9. Decisiones de Seguridad Descartadas Permanentemente

Estas medidas fueron evaluadas y **descartadas de forma deliberada**. No son olvidos ni deuda técnica — no deben reimplementarse ni levantarse como hallazgos en auditorías futuras.

### 9.1 Cookies HttpOnly para tokens JWT

**Descartado:** Los JWT se almacenan en memoria del cliente y viajan en el header `Authorization: Bearer <token>`. No se usan cookies.

**Motivo:** La arquitectura SSO multi-app sobre `.siatc.cloud` requiere que el JavaScript del browser pueda leer y compartir el token entre subdominios. `HttpOnly` impide ese acceso y rompe el SSO.

**Mitigaciones activas que sustituyen HttpOnly:**
- JWT blacklist en Redis con TTL = tiempo restante del token (logout inmediato)
- Rate limiting persistente en Redis (general + auth por app)
- `secure: true` y `sameSite: lax` en la cookie de sesión donde aplica
- Expiración de token en 12 horas

### 9.2 Rechazar requests sin header `Origin` en CORS

**Descartado:** El patrón `if (!origin || allowedOrigins.includes(origin))` en todas las apps permite requests sin header `Origin`. No se cambiará a rechazar `!origin` en producción.

**Motivo:** CORS protege navegadores, no APIs. Un atacante con servidor propio puede fabricar cualquier `Origin`. Rechazar `!origin` solo rompe clientes legítimos que no son navegadores (AppSheet, scripts de migración, Postman del equipo, llamadas server-to-server) sin agregar protección real.

**Por qué no es una brecha:** El JWT sigue siendo obligatorio en cada endpoint mediante `verifyToken`. Un request sin `Origin` y sin token válido recibe 401. La protección real es el JWT, no CORS.

**Lo que CORS sí hace en este ecosistema:** Impide que scripts en dominios no autorizados usen las credenciales del usuario logueado para llamar a la API desde el browser del usuario. Eso funciona correctamente con el patrón actual.

## 10. Reglas de Memoria y Documentación (Obsidian)

- **Lectura Obligatoria al Iniciar**: Antes de realizar cualquier análisis de código, propuesta de mejora, o modificación en esta aplicación, el agente DEBE buscar y leer las notas relevantes de la bitácora, planes e informes ubicados en la carpeta D:\diego\Documentos\Antigravity\Ecosistema SIATC\SIATC Memory\ para entender el historial del proyecto, decisiones previas y patrones de diseño existentes.

### 10.1 Bitácoras de Cambio (post-commit)
- Al completar cualquier tarea o modificación, el agente DEBE abrir la nota autogenerada de Obsidian correspondiente a este cambio en D:\diego\Documentos\Antigravity\Ecosistema SIATC\SIATC Memory\bitacora-cambios\ y enriquecerla obligatoriamente con:
  - **Arquitectura del Cambio**: Explicación técnica detallada de la lógica implementada y las decisiones tomadas.
  - **Archivos y Funciones Clave**: Detalle de qué archivos y métodos principales fueron modificados o creados.
  - **Modificaciones de BD o .env**: Registro explícito de cualquier script SQL ejecutado, nuevas columnas/tablas, o variables de entorno añadidas.

### 10.2 Planes de Implementación
- Cuando el usuario solicite un **Plan de Implementación**, el agente DEBE generar un documento .md estructurado en D:\diego\Documentos\Antigravity\Ecosistema SIATC\SIATC Memory\planes-implementacion\<Nombre-Plan>.md con el siguiente contenido:
  - **Objetivo**: Descripción del problema, alcance y qué soluciona.
  - **Cambios Propuestos en BD**: Tablas, columnas, tipos de datos SQL y scripts ALTER/CREATE.
  - **Cambios Propuestos en Backend**: APIs, middlewares, controladores, types y nuevas variables .env.
  - **Cambios Propuestos en Frontend**: Páginas, componentes, hooks y clases CSS/tokens de estilo.
  - **Plan de Verificación**: Estrategia de pruebas locales y pasos para validar en el VPS.
  - **Plan de Reversión (Rollback)**: Pasos técnicos detallados para deshacer los cambios si algo falla en producción.

### 10.3 Informes de Análisis y Auditorías
- Cuando el usuario solicite un **Informe de Análisis** o **Auditoría**, el agente DEBE generar un documento .md estructurado en D:\diego\Documentos\Antigravity\Ecosistema SIATC\SIATC Memory\auditorias-analisis\<Nombre-Informe>.md con el siguiente contenido:
  - **Alcance**: Qué componentes, módulos o vulnerabilidades se auditan.
  - **Hallazgos**: Lista detallada de fallos detectados, clasificados por gravedad (Alta, Media, Baja), con su impacto respectivo.
  - **Recomendaciones**: Soluciones técnicas propuestas con código de ejemplo y mejores prácticas.
  - **Conclusiones**: Estado de salud general del sistema respecto al análisis.

### 10.4 Auto-Sincronización
- Inmediatamente después de crear o editar cualquier archivo dentro de SIATC Memory (bitácora, plan de implementación o informe de auditoría), el agente DEBE abrir una terminal en la ruta de la memoria (D:\diego\Documentos\Antigravity\Ecosistema SIATC\SIATC Memory\), hacer git add, git commit y git push para sincronizar los cambios de inmediato con Forgejo y asegurar la disponibilidad en tiempo real para el equipo.
