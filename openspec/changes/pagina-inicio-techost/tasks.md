## 1. Layout y estructura base

- [ ] 1.1 Crear `public/index.html` con DOCTYPE, viewport meta, y estructura HTML semántica
- [ ] 1.2 Agregar Google Fonts (Inter) via `<link>` en `<head>`
- [ ] 1.3 Agregar CSS reset inline y variables de diseño (colores, spacing, tipografía)
- [ ] 1.4 Definir layout responsivo con CSS Grid/Flexbox (mobile-first)

## 2. Hero section

- [ ] 2.1 Crear hero con logo Techost, headline, subtitle, y CTA "Comenzar ahora"
- [ ] 2.2 Añadir badge "Sin mensualidad — solo $0.05 por comprobante" debajo del CTA
- [ ] 2.3 Hero responsivo: texto centrado en mobile, más ancho en desktop

## 3. Features grid

- [ ] 3.1 Crear grid de 6-8 tarjetas de funcionalidad con iconos SVG inline
- [ ] 3.2 Features: API Keys, Factura Electrónica, NC/ND/Retención/Guía, PDF Automáticos, Firma Electrónica, Documentación
- [ ] 3.3 Responsive: 1 columna mobile, 2 tablet, 3-4 desktop

## 4. Pricing section

- [ ] 4.1 Mostrar "Precios" con rate callout "$0.05 por comprobante — Sin mensualidad"
- [ ] 4.2 Crear 4 bundle cards: Básico $10, Popular $25, Pro $50, Business $100
- [ ] 4.3 Cada card muestra: nombre, precio, comprobantes, bonus si aplica, CTA
- [ ] 4.4 Highlight "Popular" como recomendado

## 5. How it works section

- [ ] 5.1 Crear 3-paso visual: 1) Registro + API Key, 2) Envía comprobante, 3) Recibe PDF autorizado
- [ ] 5.2 Incluir iconos y flechas de conexión entre pasos

## 6. Tech specs y CTA final

- [ ] 6.1 Sección de especificaciones técnicas: REST API, SRI Ambientes, XML+XAdES, PDF
- [ ] 6.2 CTA final "Empieza a facturar hoy" con link a `/docs`

## 7. Footer

- [ ] 7.1 Footer con: Techost brand, links a Docs, Términos, Política
- [ ] 7.2 Responsive: centrado en mobile, columnas en desktop

## 8. Configuración del servidor

- [ ] 8.1 Agregar ServeStaticModule entry para `/` en `src/app.module.ts`
- [ ] 8.2 Verificar que rutas existentes (`/docs`, `/api`, `/pay`, `/payment`, `/pdfs`) siguen funcionando
- [ ] 8.3 Ejecutar `npm run build` y confirmar sin errores
