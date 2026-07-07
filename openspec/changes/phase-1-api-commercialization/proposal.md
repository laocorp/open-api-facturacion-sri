## Why

El sistema actual puede emitir comprobantes electrónicos SRI pero no tiene los mecanismos mínimos para comercializarlo como servicio: no hay API Keys por cliente, no hay tracking de uso, no hay onboarding automatizado, y la documentación es insuficiente para que un cliente externo integre sin asistencia. Sin esto no se puede cobrar ni escalar.

## What Changes

1. **Sistema de API Keys** — cada cliente obtiene una API Key + Secret. Autenticación via header `X-API-Key` + `X-API-Secret` o `Authorization: Bearer <api-key>`. Las claves se gestionan via CRUD protegido para SUPERADMIN/ADMIN.
2. **Rate limiting por API Key** — límite de peticiones/minuto configurable por key. Reemplaza el rate limit global actual.
3. **Usage tracking** — cada petición a endpoints SRI se contabiliza por cliente (tenant). Tabla `usage_logs` con timestamp, endpoint, API Key usada, y metadata.
4. **Onboarding automático** — endpoint `POST /onboarding` que en un solo llamado crea: tenant, usuario admin, emisor default, establecimiento, punto de emisión, y API Key. Retorna credenciales listas para usar.
5. **Documentación pública** — página estática o sección en Swagger con: guía de inicio rápido, ejemplos en cURL/JS/Python/PHP, referencia de errores, y Postman collection.

## Capabilities

### New Capabilities
- `api-key-auth`: Autenticación mediante API Keys con soporte multi-tenant, activación/desactivación, y rotación de secrets
- `rate-limiting-per-key`: Rate limiting configurable por API Key con diferentes niveles (tiers)
- `usage-tracking`: Registro de uso por cliente para facturación posterior
- `auto-onboarding`: Creación automatizada de tenant + emisor + credenciales en un solo paso
- `public-docs`: Documentación pública para integradores externos

### Modified Capabilities
- *(ninguna — no hay specs previas)*

## Impact

- **Nuevas tablas**: `api_keys`, `usage_logs`, `key_rate_limits`
- **Nuevos endpoints**: CRUD `/api-keys`, POST `/onboarding`, GET `/usage`, docs estáticos
- **Middleware nuevo**: `ApiKeyGuard` (alternativa a JwtAuthGuard en endpoints públicos)
- **Config**: nuevas env vars para default rate limits, tiers de precio
- **Dependencias**: posiblemente `@nestjs/throttler` configurable por key (o implementación custom)
- No hay breaking changes en endpoints existentes.
