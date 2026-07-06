## ADDED Requirements

### Requirement: Landing page with hero section
The landing page SHALL display a hero section with the Techost brand, value proposition, subtitle explaining the SRI API, and a prominent CTA button linking to `/docs`.

#### Scenario: Hero section renders
- **WHEN** a user visits `/`
- **THEN** they see the Techost logo, headline "API de facturación electrónica SRI", subtitle explaining pay-per-use, and a "Comenzar ahora" CTA button

### Requirement: Landing page with features grid
The landing page SHALL display a features section with 6-8 capability cards explaining: API Keys, factura electrónica, nota de crédito/débito, retención, guía de remisión, PDF automáticos, firma electrónica, documentación interactiva.

#### Scenario: Features section renders
- **WHEN** scrolling past the hero
- **THEN** a grid of feature cards is visible with icons and descriptions

### Requirement: Pricing section with pay-per-use bundles
The pricing section SHALL display 4 bundle options (Básico $10, Popular $25, Pro $50, Business $100) with comprobantes count per bundle. MUST include a callout that there is no monthly fee ("Sin mensualidad").

#### Scenario: Pricing section renders with correct values
- **WHEN** scrolling to the pricing section
- **THEN** the 4 bundles are displayed with correct prices and comprobante counts: Básico $10 (200), Popular $25 (550), Pro $50 (1250), Business $100 (3000)

### Requirement: How it works section
A 3-step guide explaining: 1) Obtén tu API Key, 2) Envía tu comprobante, 3) Recibe tu PDF autorizado por SRI.

#### Scenario: How it works section renders
- **WHEN** scrolling past pricing
- **THEN** a 3-step visual guide is displayed

### Requirement: Technical specs section
A section listing technical details: REST API, SRI Ecuador Ambientes 1 y 2, formato XML + firma XAdES-BES, PDF automático.

#### Scenario: Tech specs section renders
- **WHEN** scrolling past how-it-works
- **THEN** technical specifications are displayed

### Requirement: Responsive design
The page SHALL be fully responsive, working on mobile, tablet, and desktop without horizontal scroll or broken layouts.

#### Scenario: Mobile viewport renders correctly
- **WHEN** viewing on a 375px wide viewport
- **THEN** all sections render without overflow, text is readable, CTA buttons are tappable

### Requirement: No external dependencies except Google Fonts
The page SHALL NOT load any external JavaScript. Google Fonts (Inter) is the only allowed external dependency.

#### Scenario: Page loads without JS errors
- **WHEN** loading the page with JavaScript disabled
- **THEN** the page renders fully with correct styling and layout

### Requirement: Serve at `/` without breaking existing routes
The page SHALL be served at the root path `/` of the API server. Existing routes `/api`, `/docs`, `/payment`, `/pay`, `/pdfs` SHALL continue to work.

#### Scenario: Root path returns landing page
- **WHEN** requesting `GET /`
- **THEN** the landing page HTML is returned

#### Scenario: Existing routes are not affected
- **WHEN** requesting `GET /docs` and `GET /api`
- **THEN** the existing documentation and Swagger pages are returned correctly
