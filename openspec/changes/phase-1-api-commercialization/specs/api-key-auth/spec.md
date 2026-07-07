## ADDED Requirements

### Requirement: Create API Key
The system SHALL allow SUPERADMIN and ADMIN users to create new API Keys for any tenant.

#### Scenario: Create API Key successfully
- **WHEN** SUPERADMIN calls POST /api-keys with `{ tenantId, name, tier }`
- **THEN** system returns `{ apiKey, apiSecret, tenantId, name, tier, isActive }`
- **AND** `apiKey` starts with `sk_live_` followed by 32 alphanumeric chars
- **AND** `apiSecret` is shown only once
- **AND** the `apiSecret` is stored as bcrypt hash in the database

#### Scenario: Create API Key without admin role
- **WHEN** a USER role calls POST /api-keys
- **THEN** system returns 403 Forbidden

### Requirement: Authenticate with API Key
The system SHALL authenticate requests using `Authorization: Bearer <api_key>` header combined with `X-API-Signature` HMAC header.

#### Scenario: Successful authentication
- **WHEN** client sends request with `Authorization: Bearer sk_live_abc...` and `X-API-Signature: <hmac_of_request_body>`
- **THEN** system validates the API Key exists and is active
- **AND** system verifies HMAC signature using the stored api_secret hash
- **AND** request proceeds to the controller with `req.tenant` and `req.apiKey` populated

#### Scenario: Invalid API Key
- **WHEN** client sends request with non-existent API Key
- **THEN** system returns 401 Unauthorized with error `invalid_api_key`

#### Scenario: Inactive API Key
- **WHEN** client sends request with a deactivated API Key
- **THEN** system returns 403 Forbidden with error `api_key_inactive`

#### Scenario: Invalid HMAC signature
- **WHEN** client sends request with incorrect X-API-Signature
- **THEN** system returns 401 Unauthorized with error `invalid_signature`

### Requirement: List API Keys
The system SHALL allow SUPERADMIN and ADMIN to list all API Keys, showing metadata but masking the secret.

#### Scenario: List keys successfully
- **WHEN** SUPERADMIN calls GET /api-keys
- **THEN** system returns paginated list of API Keys
- **AND** each key shows `{ apiKey, name, tier, isActive, lastUsedAt, createdAt }`
- **AND** `apiSecret` is never returned (always masked as `***`)

### Requirement: Revoke API Key
The system SHALL allow SUPERADMIN and ADMIN to deactivate an API Key immediately.

#### Scenario: Revoke key successfully
- **WHEN** SUPERADMIN calls DELETE /api-keys/:apiKey
- **THEN** system sets `isActive = false` immediately
- **AND** subsequent requests with this key return 403

### Requirement: Rotate API Secret
The system SHALL allow generating a new secret for an existing API Key without changing the key identifier.

#### Scenario: Rotate secret
- **WHEN** SUPERADMIN calls POST /api-keys/:apiKey/rotate
- **THEN** system returns a new `apiSecret`
- **AND** the old secret is invalidated immediately
- **AND** `apiKey` remains the same
