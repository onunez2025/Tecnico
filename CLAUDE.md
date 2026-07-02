# SIATC ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Reglas de Seguridad para Agentes AI

Estas reglas aplican a todos los repos del ecosistema SIATC. Son obligatorias en cada cambio de cÃƒÆ’Ã‚Â³digo.

## 1. AutenticaciÃƒÆ’Ã‚Â³n ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Dos middlewares, no uno

- **`verifyToken`** ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ solo acepta `Authorization: Bearer <token>`. Usar en **todos** los endpoints.
- **`verifyTokenForDownload`** ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ acepta header Y `req.query.token`. Usar **ÃƒÆ’Ã‚Âºnicamente** en endpoints GET que sirven archivos descargados directamente por el browser (`window.location.href`, Excel, PDF).

**Nunca** agregar `req.query.token` al `verifyToken` principal. Si necesitas un endpoint de descarga, usa `verifyTokenForDownload`.

## 2. Row Level Security (RLS)

Todo endpoint que sirva datos (tickets, pagos, penalidades, colaboradores, tÃƒÆ’Ã‚Â©cnicos) debe filtrar por empresa CAS:

```typescript
if (currentUser.casId !== null) {
    // Usuario empresa CAS ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â solo ve sus propios datos
    request.input('casId', sql.VarChar(50), currentUser.casId);
    query += ' AND ID_cas = @casId';
}
// casId === null ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ empleado Sole, ve todo
```

## 3. Tipos SQL ExplÃƒÆ’Ã‚Â­citos en .input()

Todos los `.input()` deben declarar el tipo SQL. Nunca pasar `req.params` o `req.body` directamente:

```typescript
// ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Correcto
.input('id', sql.UniqueIdentifier, req.params.id)
.input('name', sql.VarChar(100), req.body.name)
.input('amount', sql.Decimal(10, 2), amount)

// ÃƒÂ¢Ã‚ÂÃ…â€™ Incorrecto ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â susceptible a type confusion
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

## 4. Path Traversal ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â path.resolve + startsWith

Para endpoints que sirven archivos desde una carpeta base:

```typescript
// ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Correcto
const fullPath = path.resolve(BASE_DIR, userInput);
if (!fullPath.startsWith(path.resolve(BASE_DIR) + path.sep)) {
    return res.status(400).json({ error: 'Ruta invÃƒÆ’Ã‚Â¡lida.' });
}

// ÃƒÂ¢Ã‚ÂÃ…â€™ Incorrecto ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â la regex no cubre todos los casos de traversal
const safePath = path.normalize(input).replace(/^(\.\.[\/\\])+/, '');
```

## 5. Variables de Entorno ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Sin Paths Hardcodeados

Nunca usar rutas absolutas de sistemas de archivos locales:

```typescript
// ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Correcto
const STORAGE_PATH = process.env.STORAGE_PATH || '';
if (!STORAGE_PATH) return res.status(503).json({ error: 'Almacenamiento no configurado.' });

// ÃƒÂ¢Ã‚ÂÃ…â€™ Incorrecto ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â ruta local que no existe en el servidor Dokploy
const STORAGE_PATH = 'C:\\Users\\someone\\OneDrive\\...';
```

## 6. Guards de ProducciÃƒÆ’Ã‚Â³n

Los warnings de configuraciÃƒÆ’Ã‚Â³n (CORS, env vars) solo deben activarse en producciÃƒÆ’Ã‚Â³n:

```typescript
// ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Correcto
if (process.env.NODE_ENV === 'production' && !(process.env.ALLOWED_ORIGINS || '').trim()) {
    console.warn('WARNING: ALLOWED_ORIGINS no configurado.');
}
```

## 7. AppConfigContext ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â AutenticaciÃƒÆ’Ã‚Â³n en /api/applications

El endpoint `GET /api/applications` siempre debe tener `verifyToken`. El frontend (`AppConfigContext.tsx`) usa `StorageService.getToken()` para enviar el header cuando hay sesiÃƒÆ’Ã‚Â³n activa. No revertir este patrÃƒÆ’Ã‚Â³n.

## 8. Antes de hacer push

Ejecutar el verificador automÃƒÆ’Ã‚Â¡tico:
```bash
./check-security.sh
```

O instalar como hook permanente:
```bash
cp check-security.sh .git/hooks/pre-push && chmod +x .git/hooks/pre-push
```

## 9. Decisiones de Seguridad Descartadas Permanentemente

Estas medidas fueron evaluadas y **descartadas de forma deliberada**. No son olvidos ni deuda tÃƒÆ’Ã‚Â©cnica ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â no deben reimplementarse ni levantarse como hallazgos en auditorÃƒÆ’Ã‚Â­as futuras.

### 9.1 Cookies HttpOnly para tokens JWT

**Descartado:** Los JWT se almacenan en memoria del cliente y viajan en el header `Authorization: Bearer <token>`. No se usan cookies.

**Motivo:** La arquitectura SSO multi-app sobre `.siatc.cloud` requiere que el JavaScript del browser pueda leer y compartir el token entre subdominios. `HttpOnly` impide ese acceso y rompe el SSO.

**Mitigaciones activas que sustituyen HttpOnly:**
- JWT blacklist en Redis con TTL = tiempo restante del token (logout inmediato)
- Rate limiting persistente en Redis (general + auth por app)
- `secure: true` y `sameSite: lax` en la cookie de sesiÃƒÆ’Ã‚Â³n donde aplica
- ExpiraciÃƒÆ’Ã‚Â³n de token en 12 horas

### 9.2 Rechazar requests sin header `Origin` en CORS

**Descartado:** El patrÃƒÆ’Ã‚Â³n `if (!origin || allowedOrigins.includes(origin))` en todas las apps permite requests sin header `Origin`. No se cambiarÃƒÆ’Ã‚Â¡ a rechazar `!origin` en producciÃƒÆ’Ã‚Â³n.

**Motivo:** CORS protege navegadores, no APIs. Un atacante con servidor propio puede fabricar cualquier `Origin`. Rechazar `!origin` solo rompe clientes legÃƒÆ’Ã‚Â­timos que no son navegadores (AppSheet, scripts de migraciÃƒÆ’Ã‚Â³n, Postman del equipo, llamadas server-to-server) sin agregar protecciÃƒÆ’Ã‚Â³n real.

**Por quÃƒÆ’Ã‚Â© no es una brecha:** El JWT sigue siendo obligatorio en cada endpoint mediante `verifyToken`. Un request sin `Origin` y sin token vÃƒÆ’Ã‚Â¡lido recibe 401. La protecciÃƒÆ’Ã‚Â³n real es el JWT, no CORS.

**Lo que CORS sÃƒÆ’Ã‚Â­ hace en este ecosistema:** Impide que scripts en dominios no autorizados usen las credenciales del usuario logueado para llamar a la API desde el browser del usuario. Eso funciona correctamente con el patrÃƒÆ’Ã‚Â³n actual.

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