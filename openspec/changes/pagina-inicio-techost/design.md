## Context

Techost SRI API actualmente no tiene presencia web. Los usuarios interactúan via Swagger en `/api` y docs estáticos en `/docs`. No hay landing page que explique el producto a PYMEs no técnicas. Necesitamos una página comercial servida en la raíz `/` del mismo servidor.

Stack actual: NestJS + ServeStaticModule para archivos estáticos. La landing será HTML+CSS puro sin framework JS.

## Goals / Non-Goals

**Goals:**
- Landing page comercial profesional servida en `/`
- Diseño minimalista moderno (referencia: Stripe, Linear, Apple)
- Precios pay-per-use correctos con bundles
- Copys orientados a PYMEs ecuatorianas explicando términos SRI
- Responsive (mobile-first)
- Cargar rápido sin dependencias externas pesadas
- No romper rutas existentes (`/docs`, `/api`, `/payment`, `/pay`, `/pdfs`)

**Non-Goals:**
- No incluir formularios de registro (el onboarding via API ya existe)
- No incluir demo interactiva
- No cambiar diseño de docs existentes
- No agregar analytics ni trackers

## Decisions

1. **HTML inline sin framework.** La landing es estática. Usar CSS inline en un solo archivo evita build steps, bundlers, y dependencias. Google Fonts (Inter) como única external dependency vía CDN.

2. **Servir en `/` desde NestJS ServeStaticModule.** Se agrega un entry antes de los existentes con `rootPath: join(process.cwd(), 'public')` y `serveRoot: '/'`. El orden importa: las rutas específicas (`/docs`, `/api`, `/pay`) se definen antes en NestJS y tienen prioridad sobre el static catch-all.

3. **Sin imágenes externas.** Usar SVG inline para iconos. Cero requests a servidores de terceros (excepto Google Fonts). Carga instantánea.

4. **Pricing hardcodeado.** Los bundles están definidos en `payphone.service.ts` y son fijos. La landing usa los mismos valores hardcodeados. No necesita datos dinámicos del backend.

5. **Sin JavaScript runtime.** Cero JS. Solo HTML + CSS. Máxima simplicidad y compatibilidad.

## Risks / Trade-offs

- [Routing conflict] ServeStaticModule en `/` podría atrapar rutas antes que NestJS controllers. → Mitigación: definir controllers específicos primero, ServeStaticModule después en `app.module.ts`. NestJS procesa controllers ANTES que static files.
- [Caché] Static file podría cachearse y no actualizarse tras cambios. → Mitigación: usar `?v=` query param en CI o reiniciar servidor.
- [Sin analytics] No saber conversión. → Mitigación: se puede agregar después vía script opcional. Fuera de scope actual.
