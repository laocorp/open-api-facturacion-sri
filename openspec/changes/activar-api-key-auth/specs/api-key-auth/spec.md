## ADDED Requirements

### Requirement: API Key authentication en endpoints SRI
Los endpoints de emisión SRI (`POST /sri/factura`, `POST /sri/nota-credito`, `POST /sri/guia-remision`, `POST /sri/comprobante-retencion`) DEBEN aceptar autenticación mediante API Key (header `X-Api-Key`) ademas de JWT (header `Authorization: Bearer`).

#### Scenario: Autenticación con API Key válida
- **WHEN** request incluye header `X-Api-Key` con una API Key activa y válida
- **THEN** el endpoint procesa la solicitud normalmente, rate limiting por tier aplica

#### Scenario: Autenticación con JWT válido (compatibilidad)
- **WHEN** request incluye header `Authorization: Bearer` con JWT válido (sin X-Api-Key)
- **THEN** el endpoint procesa la solicitud normalmente (comportamiento actual)

#### Scenario: Ambos headers presentes
- **WHEN** request incluye tanto `Authorization: Bearer` como `X-Api-Key`
- **THEN** JWT tiene precedencia, API Key se ignora

#### Scenario: API Key inválida o inactiva
- **WHEN** request incluye `X-Api-Key` con key inválida o `is_active = false`
- **THEN** response 401 Unauthorized con mensaje "API Key inválida o inactiva"

#### Scenario: Sin autenticación
- **WHEN** request no incluye ni JWT ni API Key
- **THEN** response 401 Unauthorized

### Requirement: Rate limiting por tier de API Key
Cuando un request se autentica con API Key, el rate limit DEBE aplicar según el tier de la key (basic 30/min, pro 120/min, enterprise 600/min).

#### Scenario: Rate limit no excedido
- **WHEN** request autenticado con API Key no ha excedido el límite de su tier
- **THEN** response incluye headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- **THEN** request se procesa normalmente

#### Scenario: Rate limit excedido
- **WHEN** request autenticado con API Key ha excedido el límite de su tier
- **THEN** response 429 Too Many Requests

### Requirement: req.user disponible con API Key
Cuando un request se autentica con API Key, `@CurrentUser()` DEBE devolver un objeto `JwtPayload` con los datos del usuario primario del tenant.

#### Scenario: Usuario primario existe
- **WHEN** request se autentica con API Key y el tenant tiene un usuario activo
- **THEN** `req.user` contiene `{ userId, email, rol, tenantId }` del usuario primario

#### Scenario: Usuario primario no existe
- **WHEN** request se autentica con API Key pero el tenant no tiene usuarios activos
- **THEN** response 401 Unauthorized

### Requirement: Documentación Swagger actualizada
La descripción en Swagger DEBE reflejar que SRI acepta tanto JWT como API Key.

#### Scenario: Esquemas de auth documentados
- **WHEN** se navega a `/api` (Swagger UI)
- **THEN** la descripción indica que JWT y API Key son ambos válidos para endpoints SRI
- **THEN** `X-Api-Key` ya no se describe como el único método para emisión
