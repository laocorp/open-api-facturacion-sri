## 1. Base de datos — Migraciones

- [ ] 1.1 Crear tabla `api_keys` (id, tenant_id FK, key_hash, name, tier, is_active, last_used_at, created_at, updated_at)
- [ ] 1.2 Crear tabla `usage_logs` (id, tenant_id FK, api_key_id FK, endpoint, method, comprobante_type, clave_acceso, estado, response_time_ms, ip_address, created_at)
- [ ] 1.3 Agregar índices: usage_logs por tenant_id + created_at, api_keys por key_hash (UNIQUE)
- [ ] 1.4 Agregar trigger update_updated_at_column a api_keys

## 2. Módulo API Keys

- [ ] 2.1 Generar módulo NestJS: `src/modules/api-keys/` con controller, service, module
- [ ] 2.2 Implementar ApiKeyService.create(): generar key (sk_live_ + 32 chars) + secret (64 chars), hashear secret con bcrypt
- [ ] 2.3 Implementar ApiKeyService.validate(): buscar por key_hash, verificar is_active, verificar HMAC signature
- [ ] 2.4 Implementar CRUD endpoints: GET /api-keys, POST /api-keys, DELETE /api-keys/:id, POST /api-keys/:id/rotate
- [ ] 2.5 Implementar ApiKeyGuard (canActivate: extraer header, validar key, poblar req.tenant/req.apiKey)
- [ ] 2.6 Aplicar ApiKeyGuard a rutas SRI (/api/v1/*) como alternativa a JwtAuthGuard
- [ ] 2.7 Agregar endpoint POST /api-keys/:id/deactivate (soft delete)

## 3. Rate limiting por API Key

- [ ] 3.1 Implementar RateLimitService con Redis sorted sets (sliding window)
- [ ] 3.2 Configurar tiers: basic=30/min, professional=120/min, enterprise=600/min, unlimited=0
- [ ] 3.3 Crear decorador @RateLimit(tier) para endpoints
- [ ] 3.4 Integrar rate limit check en ApiKeyGuard (o middleware separado)
- [ ] 3.5 Retornar headers X-RateLimit-* en todas las respuestas

## 4. Usage tracking

- [ ] 4.1 Crear UsageService.log() fire-and-forget (INSERT asíncrono a usage_logs)
- [ ] 4.2 Crear interceptor/applicación: capturar peticiones SRI y llamar a UsageService.log()
- [ ] 4.3 Implementar GET /usage con filtros: tenantId, from, to, page, limit
- [ ] 4.4 Implementar GET /usage/summary con agregaciones (total, por endpoint, por día)
- [ ] 4.5 Implementar job BullMQ semanal para purgar registros > 6 meses

## 5. Auto-onboarding

- [ ] 5.1 Crear OnboardingService.onboard(): transacción que crea Tenant + Usuario + Emisor + Establecimiento + PuntoEmision + Secuenciales + ApiKey
- [ ] 5.2 Implementar POST /onboarding con DTO de entrada (email, password, ruc, razonSocial, tenantName)
- [ ] 5.3 Validar RUC ecuatoriano, email único, RUC único antes de crear
- [ ] 5.4 Manejar rollback transaccional si falla algún paso
- [ ] 5.5 Retornar credenciales completas en respuesta (incluyendo apiKey + apiSecret mostrado una vez)

## 6. Documentación pública

- [ ] 6.1 Crear directorio `public/docs/` con archivos HTML estáticos
- [ ] 6.2 Escribir guía de inicio rápido con ejemplos en cURL, JS, Python, PHP
- [ ] 6.3 Escribir guía de autenticación con generación de HMAC
- [ ] 6.4 Escribir referencia de errores (códigos y soluciones)
- [ ] 6.5 Generar Postman collection actualizada con endpoints SRI
- [ ] 6.6 Configurar NestJS para servir `/docs` como static assets
- [ ] 6.7 Vincular `/docs` en Swagger (link en la descripción de la API)

## 7. Configuración y limpieza

- [ ] 7.1 Agregar env vars: `API_KEY_TIER_DEFAULT`, `RATE_LIMIT_BASIC`, `RATE_LIMIT_PRO`, `RATE_LIMIT_ENTERPRISE`, `USAGE_RETENTION_DAYS`
- [ ] 7.2 Actualizar `validationSchema` en configuration.ts con defaults
- [ ] 7.3 Actualizar `docs/SISTEMA-ACTUAL.md` con nuevos módulos
- [ ] 7.4 Actualizar `despliegue.md` sección 5 con nuevas env vars
