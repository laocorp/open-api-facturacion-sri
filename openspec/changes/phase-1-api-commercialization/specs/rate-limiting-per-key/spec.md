## ADDED Requirements

### Requirement: Rate limit per API Key
The system SHALL enforce request rate limits per API Key using a sliding window algorithm stored in Redis.

#### Scenario: Request within limit
- **WHEN** client sends requests within the configured rate limit for their tier
- **THEN** all requests proceed normally

#### Scenario: Request exceeds limit
- **WHEN** client exceeds the rate limit for their tier (e.g., > 60 requests in 1 minute)
- **THEN** system returns 429 Too Many Requests
- **AND** response includes headers `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### Requirement: Rate limit tiers
The system SHALL support configurable rate limit tiers per API Key.

#### Scenario: Different tiers have different limits
- **WHEN** API Key has tier "basic" (30 req/min)
- **AND** API Key has tier "professional" (120 req/min)
- **AND** API Key has tier "enterprise" (600 req/min)
- **THEN** each key enforces its respective limit

### Requirement: Rate limit bypass for whitelisted keys
The system SHALL allow marking API Keys with unlimited rate limit for internal/admin use.

#### Scenario: Whitelisted key has no limit
- **WHEN** API Key has `tier = "unlimited"`
- **THEN** no rate limit is enforced for that key
