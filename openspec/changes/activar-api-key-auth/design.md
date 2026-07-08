## Context

El proyecto tiene dos sistemas de autenticación completamente implementados pero incompatibles entre sí:

- **JWT** (`JwtAuthGuard`): Guardia global, extrae `req.user` con `{ userId, email, rol, tenantId }`. Usado en todos los controladores.
- **API Key** (`ApiKeyGuard`): Guardia por decorador `@ApiKey()`, extrae `req.tenant` con `{ tenantId, tier }`. Nunca activado.

El problema central: los endpoints SRI usan `@CurrentUser() user: JwtPayload` en todos los handlers. No podemos simplemente reemplazar JWT por API Key porque se perdería el contexto de usuario.

La solución es un guardia compuesto que acepte cualquiera de los dos métodos y, en el caso API Key, resuelva un usuario a partir del tenant.

## Goals / Non-Goals

**Goals:**
- Endpoints SRI acepten JWT (como hoy) O API Key (nuevo)
- `@CurrentUser()` funcione con ambos métodos
- Rate limiting por tier de API Key se active realmente
- Descripción Swagger refleje la realidad

**Non-Goals:**
- No cambiar la autenticación de otros controladores (auth, admin, etc.)
- No migrar datos ni romper sesiones existentes
- No implementar UI/UX para gestión de API Keys (ya existe el CRUD)

## Decisions

### Decisión 1: Guardia compuesto vs modificar ApiKeyGuard

**Opción A — Modificar ApiKeyGuard para poblar req.user:**
Hacer que ApiKeyGuard, cuando valida una API Key, busque el usuario primario del tenant y lo asigne a `req.user`. Luego aplicar `@UseGuards(ApiKeyGuard)` en SRI controller.

Problema: Si aplicamos ApiKeyGuard sin JwtAuthGuard, los requests con JWT fallarían porque ApiKeyGuard espera `X-Api-Key`. Habría que hacer que ApiKeyGuard también acepte JWT o saltarse cuando hay JWT.

**Opción B — Guardia compuesto nuevo (elegida):**
Crear `OptionalAuthGuard` que:
1. Si hay header `Authorization: Bearer` → delega a `JwtAuthGuard`
2. Si hay header `X-Api-Key` → delega a `ApiKeyGuard` (con modificación para poblar `req.user`)
3. Si no hay ninguno → 401

Razón: Separa responsabilidades, no toca los guards existentes, fácil de testear.

### Decisión 2: Cómo poblar req.user desde API Key

El ApiKeyGuard actual setea `req.tenant = { id: tenantId, tier }`. Necesitamos también `req.user`.

Opción A: Agregar campo `primary_user_id` a la tabla `api_keys` y buscarlo en el guard.

Opción B: Buscar el primer usuario activo del tenant en `users` table.

Opción C (elegida): El `ApiKeysService.validate()` ya retorna `{ tenantId, tier }`. Modificaremos el guard para que después de validar, haga una query al tenant y obtenga el usuario primario. Asumimos que cada tenant tiene al menos un usuario.

Razón: No requiere migración de DB, es simple, y el tenant siempre tiene dueño.

### Decisión 3: Orden de precedencia

Si un request incluye AMBOS headers (JWT + API Key), gana JWT. Esto permite que herramientas de administración usen JWT y scripts automatizados usen API Key sin conflictos.

## Risks / Trade-offs

- **Riesgo: API Key robada** → El guard ya valida `is_active` y usa bcrypt. El rate limiting por tier mitiga abuso. El endpoint `rotate` permite regenerar.
- **Riesgo: Usuario primario no existe** → Si el tenant no tiene usuarios activos, el guard debe fallar con 401 en lugar de crash.
- **Riesgo: Rate limit por tier bypass** → El guard de API Key ya implementa `rateLimitService.check()`. Solo asegurar que se ejecute en el flujo API Key.
- **Trade-off: Performance** → ApiKeyGuard itera todas las keys activas y hace bcrypt compare. Con pocas keys por tenant es aceptable. Si escala, migrar a hash lookup directo.
