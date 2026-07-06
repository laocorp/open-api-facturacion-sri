## ADDED Requirements

### Requirement: Bundles display with correct pricing
The pricing section SHALL display exactly 4 bundles with the following data:
- Básico $10: cents=1000, bonus=0, comprobantes=200
- Popular $25: cents=2500, bonus=250, comprobantes=550
- Pro $50: cents=5000, bonus=750, comprobantes=1250
- Business $100: cents=10000, bonus=2000, comprobantes=3000

#### Scenario: All bundles render with correct values
- **WHEN** viewing the pricing table
- **THEN** all 4 bundles show the correct dollar price and corresponding comprobante count

### Requirement: Pay-per-use pricing callout
The section SHALL prominently display the rate "$0.05 por comprobante" and the message "Sin mensualidad, sin planes, solo pagas por lo que emites".

#### Scenario: Pricing callout is visible
- **WHEN** viewing the pricing section
- **THEN** the "$0.05 por comprobante" rate and "Sin mensualidad" message are prominently displayed above the bundles

### Requirement: No free trial mention
The pricing section SHALL NOT include any mention of free trials, free tiers, or prueba gratis.

#### Scenario: No free text
- **WHEN** searching the pricing section for "gratis", "trial", "prueba"
- **THEN** no matches are found

### Requirement: CTA in pricing section
Each bundle card SHALL have a CTA button "Comenzar ahora" linking to `/docs`.

#### Scenario: Pricing CTA buttons render
- **WHEN** hovering over any bundle card
- **THEN** a "Comenzar ahora" button is visible and links to `/docs`
