## Why

Techost SRI API no tiene presencia web comercial. No hay una landing page que explique el producto, muestre precios, y convierta visitantes en clientes. Sin ella, la API es invisible para PYMEs ecuatorianas que necesitan facturación electrónica SRI.

## What Changes

- Crear landing page comercial en `public/index.html` servida en `/`
- Diseño moderno, minimalista, detallado (estilo Stripe/Linear) — sin neón, sin trial gratis
- Precios correctos: pay-per-use $0.05/comprobante con bundles ($10/$25/$50/$100)
- Copys orientados a PYMEs ecuatorianas, explicando términos SRI en lenguaje simple
- Integrar link a documentación existente en `/docs`
- Actualizar `src/app.module.ts` para servir `public/` como raíz sin romper rutas existentes

## Capabilities

### New Capabilities
- `landing-page-ui`: Página de inicio completa con hero, features, pricing, cómo funciona, specs, CTA, footer
- `pricing-bundles-seccion`: Sección de precios con los 4 bundles, explicación pay-per-use, tabla comparativa

### Modified Capabilities
- Ninguna. La landing es nueva, no modifica specs existentes.

## Impact

- `public/index.html` — archivo nuevo, la página completa
- `src/app.module.ts` — agregar ServeStaticModule entry para `/` apuntando a `public/`
- Sin cambios a APIs, DB, servicios, o configuraciones existentes
- Sin breaking changes
