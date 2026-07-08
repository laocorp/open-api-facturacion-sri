## Why

El `ApiKeyGuard`, `@ApiKey()` decorator, servicio de validación bcrypt, rate limiting por tier y CRUD de API Keys están 100% implementados pero nunca se activaron. La documentación Swagger dice que SRI usa `X-Api-Key` cuando en realidad solo funciona JWT. Activar la autenticación por API Key permite uso machine-to-machine, desacopla la emisión SRI de sesiones humanas, y hace que el sistema coincida con su documentación.

## What Changes

- Crear guardia compuesto `OptionalAuthGuard` que acepte JWT (header `Authorization: Bearer`) O API Key (header `X-Api-Key`) en endpoints SRI
- En flujo API Key: resolver `req.user` desde el tenant para mantener compatibilidad con `@CurrentUser()`
- Asegurar que `JwtAuthGuard` + `ApiKeyGuard` puedan coexistir sin conflicto
- Actualizar descripción Swagger en `main.ts` para reflejar la realidad (JWT + API Key funcionales)
- NO breaking: JWT sigue funcionando exactamente igual

## Capabilities

### New Capabilities
- `api-key-auth`: autenticación alternativa mediante API Key en endpoints de emisión SRI, con rate limiting por tier (basic 30/min, pro 120/min, enterprise 600/min)

### Modified Capabilities

<!-- Ninguna. No hay specs existentes que modificar. -->

## Impact

- `src/modules/api-keys/guards/api-key.guard.ts` — modificar para poblar `req.user`
- `src/modules/sri/sri.controller.ts` — agregar `@UseGuards(OptionalAuthGuard)` o similar
- `src/main.ts` — corregir descripción Swagger
- Posible nuevo archivo: guardia compuesto
