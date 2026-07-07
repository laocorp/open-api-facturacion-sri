## Context

Sistema NestJS funcionando con autenticación JWT, multi-tenant, emisión SRI y webhooks. Actualmente no hay forma de que clientes externos consuman la API sin compartir credenciales de usuario, ni hay tracking de uso para facturar.

## Goals / Non-Goals

**Goals:**
- Cada cliente tiene una API Key única que identifica su tenant
- Rate limits configurables por key (no global)
- Tracking de uso por cliente (endpoint, fecha, comprobantes)
- Onboarding automático: crear cliente completo en 1 POST
- Documentación pública para integradores

**Non-Goals:**
- Dashboard web (se hará en Fase 2)
- Facturación/cobros automáticos (Fase 3)
- White-label (Fase 3)
- Portal de clientes con login web (Fase 2)

## Decisions

### 1. API Key + Secret (no solo API Key)
- **Decisión**: Cada cliente recibe `api_key` (identificador público tipo `sk_live_xxx`) + `api_secret` (clave secreta)
- **Por qué**: Si solo usas API Key, cualquiera que la intercepta tiene acceso total. El Secret se usa para firmar HMAC de cada petición.
- **Alternativa**: Solo API Key como Bearer token → rechazado por seguridad insuficiente

### 2. Hash del api_secret en BD (nunca plain text)
- **Decisión**: Almacenar solo hash bcrypt del api_secret. El secret original se muestra UNA vez al crear la key.
- **Por qué**: Misma razón que passwords — si alguien accede a la BD no puede robar secrets activos.

### 3. Middleware ApiKeyGuard (no reemplazar JwtAuthGuard)
- **Decisión**: Nuevo guard `ApiKeyGuard` que se aplica selectivamente en endpoints públicos. JwtAuthGuard sigue protegiendo endpoints internos.
- **Por qué**: Los endpoints internos (admin, configuración) deben seguir usando JWT. La API Key es solo para los endpoints de emisión SRI.

### 4. Rate limiting custom vía Redis (no @nestjs/throttler)
- **Decisión**: Implementación custom usando Redis sorted sets (sliding window). Cada API Key tiene su propio contador.
- **Por qué**: @nestjs/throttler es global y no soporta límites por API Key fácilmente.
- **Alternativa**: Modificar ThrottlerModule para leer api-key del header → complejo, mejor custom.

### 5. Tabla usage_logs como append-only
- **Decisión**: Cada petición a endpoints SRI inserta un registro en `usage_logs` (async, fire-and-forget). Consultas de uso via endpoint protegido.
- **Por qué**: La contabilidad no se puede alterar retroactivamente.

### 6. Onboarding idempotente
- **Decisión**: Endpoint `POST /onboarding` que recibe `{ email, ruc, razonSocial, tenantName }` y crea todo. El RUC actúa como idempotency key (si ya existe, retorna error).
- **Por qué**: Evita duplicados accidentales.

### 7. Documentación en /docs (HTML estático)
- **Decisión**: Generar docs con Markdown + template HTML servido por NestJS como archivos estáticos.
- **Por qué**: Sin dependencias externas, se sirve desde el mismo proceso, sin CORS.

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|-----------|
| [R1] Cliente pierde su api_secret | Endpoint para rotar/re-generar secret (invalida el anterior) |
| [R2] Una API Key comprometida | Endpoint para desactivar key inmediatamente. Notificar al cliente |
| [R3] Rate limit mal configurado degrada experiencia | Límites conservadores al inicio (ej: 30 req/min), configurables por tenant |
| [R4] Tabla usage_logs crece sin control | TTL por índice en `created_at`, purge mensual de registros > 6 meses |
| [R5] Onboarding crea datos inválidos | Validación de RUC, email, y datos obligatorios antes de crear |
