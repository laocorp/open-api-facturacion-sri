## 1. Modificar ApiKeyGuard para poblar req.user

- [ ] 1.1 Inyectar `DatabaseService` en `ApiKeyGuard`
- [ ] 1.2 Tras validar API Key, hacer query para obtener usuario primario del tenant
- [ ] 1.3 Asignar `req.user` con `{ userId, email, rol, tenantId }`
- [ ] 1.4 Si el tenant no tiene usuarios activos, retornar 401

## 2. Crear guardia compuesto OptionalAuthGuard

- [ ] 2.1 Crear `src/modules/auth/guards/optional-auth.guard.ts`
- [ ] 2.2 Detectar si hay `Authorization: Bearer` y delegar a JwtAuthGuard
- [ ] 2.3 Detectar si hay `X-Api-Key` y delegar a ApiKeyGuard
- [ ] 2.4 Si no hay ninguno, 401 Unauthorized
- [ ] 2.5 Si ambos, dar precedencia a JWT

## 3. Aplicar OptionalAuthGuard a endpoints SRI

- [ ] 3.1 Agregar `@UseGuards(OptionalAuthGuard)` a nivel clase en `SriController`
- [ ] 3.2 Verificar que `@CurrentUser()` funciona con ambos flujos
- [ ] 3.3 NO tocar endpoints públicos (catálogos, status)

## 4. Corregir descripción Swagger

- [ ] 4.1 Actualizar descripción en `main.ts` para indicar que SRI acepta JWT O API Key
- [ ] 4.2 Remover lenguaje que sugiere que API Key es el único método

## 5. Verificación

- [ ] 5.1 Test: request con JWT a SRI funciona (regresión)
- [ ] 5.2 Test: request con API Key a SRI funciona
- [ ] 5.3 Test: request sin auth a SRI retorna 401
- [ ] 5.4 Test: request con API Key inválida retorna 401
- [ ] 5.5 Test: rate limit headers presentes con API Key
- [ ] 5.6 Confirmar que Swagger UI muestra ambos esquemas
