## ADDED Requirements

### Requirement: Public documentation page
The system SHALL serve a static documentation page at GET /docs with integration guides.

#### Scenario: Access docs page
- **WHEN** client navigates to GET /docs
- **THEN** system returns an HTML page with: Authentication guide, Quick start guide, API reference, Error codes, Rate limiting info

### Requirement: Quick start guide
The documentation SHALL include a quick start guide with copy-paste examples for at least 3 languages.

#### Scenario: Quick start has code examples
- **WHEN** client reads the quick start section
- **THEN** they see working code examples in cURL, JavaScript (fetch/axios), Python (requests), and PHP

### Requirement: Authentication guide
The documentation SHALL explain how to authenticate with API Keys including HMAC signature generation.

#### Scenario: Auth guide includes HMAC examples
- **WHEN** client reads the authentication section
- **THEN** they see how to generate the `X-API-Signature` header with code examples in each supported language

### Requirement: Postman collection
The system SHALL provide a downloadable Postman collection at GET /docs/postman.json.

#### Scenario: Download Postman collection
- **WHEN** client calls GET /docs/postman.json
- **THEN** system returns a JSON file importable into Postman
- **AND** the collection includes all SRI emission endpoints with variable placeholders for apiKey and apiSecret
