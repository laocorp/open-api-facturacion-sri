## ADDED Requirements

### Requirement: Log API usage
The system SHALL log every request to SRI emission endpoints per API Key.

#### Scenario: Log emission request
- **WHEN** client emits a comprobante via API Key
- **THEN** system inserts a record in `usage_logs` with: `tenantId`, `apiKey`, `endpoint`, `method`, `comprobanteType`, `claveAcceso`, `estado`, `responseTimeMs`, `createdAt`
- **AND** the log insert is fire-and-forget (does not block the response)

#### Scenario: Include error requests
- **WHEN** client request fails (validation error, SRI error, etc.)
- **THEN** the failed request is still logged with error details

### Requirement: Query usage
The system SHALL allow SUPERADMIN and ADMIN to query usage logs with date range, tenant, and API Key filters.

#### Scenario: Query usage by date range
- **WHEN** SUPERADMIN calls GET /usage?from=2026-01-01&to=2026-01-31&tenantId=1
- **THEN** system returns paginated results with total count and aggregate stats

#### Scenario: Query usage summary
- **WHEN** SUPERADMIN calls GET /usage/summary?tenantId=1&from=2026-06-01&to=2026-06-30
- **THEN** system returns `{ totalRequests, byEndpoint: {}, byComprobanteType: {}, byDay: [], successRate, avgResponseTime }`

### Requirement: Usage data retention
The system SHALL automatically purge usage logs older than 6 months.

#### Scenario: Auto-purge old logs
- **WHEN** a usage log record is older than 6 months
- **THEN** it is automatically deleted by a scheduled job (cron or BullMQ repeatable)
