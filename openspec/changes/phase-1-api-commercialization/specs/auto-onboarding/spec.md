## ADDED Requirements

### Requirement: Auto-onboarding endpoint
The system SHALL provide a single endpoint that creates a complete client setup: tenant + admin user + emisor + establecimiento + punto emision + API Key.

#### Scenario: Successful onboarding
- **WHEN** SUPERADMIN calls POST /onboarding with `{ email, password, nombre, ruc, razonSocial, tenantName }`
- **THEN** system creates: Tenant, Usuario (ADMIN), Emisor, Establecimiento (001), PuntoEmision (001), Secuenciales (cero), API Key (tier "professional")
- **AND** returns `{ tenantId, userId, emisorId, apiKey, apiSecret, establecimiento, puntoEmision }`

#### Scenario: Duplicate RUC
- **WHEN** SUPERADMIN calls POST /onboarding with an RUC that already exists
- **THEN** system returns 409 Conflict

#### Scenario: Invalid RUC
- **WHEN** SUPERADMIN calls POST /onboarding with an invalid Ecuadorian RUC
- **THEN** system returns 400 Bad Request with validation error

#### Scenario: Duplicate email
- **WHEN** SUPERADMIN calls POST /onboarding with an email that already exists
- **THEN** system returns 409 Conflict

### Requirement: Onboarding is transactional
The system SHALL create all onboarding resources in a single database transaction. If any step fails, everything rolls back.

#### Scenario: Partial failure rolls back
- **WHEN** tenant is created but emisor creation fails
- **THEN** tenant is also rolled back
- **AND** system returns 500 error
- **AND** no orphan records exist in the database
