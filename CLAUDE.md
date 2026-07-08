# TechOST API — Memoria del Proyecto

## Stack
- NestJS + Express, PostgreSQL, TypeORM, JWT auth, Swagger/OpenAPI
- Sirve estáticos en `public/` via `@nestjs/serve-static`
- Host: `https://api.techost.ec`

## Arquitectura de autenticación
- **JWT global guard**: `@UseGuards(JwtAuthGuard)` en todos los controladores de negocio. NO usa X-Api-Key para requests entrantes.
- `@ApiKey()` decorator existe pero **nunca se activó** como guardia global.
- Login: `POST /auth/login` → `{ access_token, refresh_token, expires_in }`
- Refresh: `POST /auth/refresh` (protegido con JWT)
- Perfil: `GET /auth/perfil`
- HMAC-SHA256 solo se usa para **firmar webhooks salientes** (header `x-techost-signature`). No hay middleware HMAC para requests entrantes.

## Rate limiting
- Global: 100 req/min (ThrottlerModule NestJS)
- Endpoint factura: 10 req/min (`@Throttle(10, 60)` en `POST /sri/factura`)
- Por tier API Key: basic 30/min, pro 120/min, enterprise 600/min (definido en servicio, guardia NO activo)

## Endpoints SRI

### Emisión (requieren JWT)
| Método | Endpoint | Rate limit |
|--------|----------|-----------|
| POST | `/sri/factura` | 10/min |
| POST | `/sri/nota-credito` | global |
| POST | `/sri/guia-remision` | global |
| POST | `/sri/comprobante-retencion` | global |

### Consulta y gestión (requieren JWT)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/sri/comprobantes` | Lista paginada con filtros (page, limit, estado, tipoDocumento, desde, hasta) |
| GET | `/sri/comprobantes/:claveAcceso` | Obtener por clave (49 dígitos) |
| PATCH | `/sri/comprobantes/:claveAcceso/anular` | Anular comprobante (solo AUTORIZADO) |
| POST | `/sri/comprobantes/:claveAcceso/reintentar` | Reenviar al SRI (PENDIENTE/RECHAZADO) |

### Verificación SRI
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/sri/autorizar/:claveAcceso` | Consulta SRI + actualiza registro local |
| GET | `/sri/verificar/:claveAcceso` | Consulta SRI sin actualizar local |

### Preview y validación
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/sri/preview/factura` | Genera XML firmado sin enviar al SRI |
| POST | `/sri/validar` | Multipart. Valida XML contra XSD SRI |
| POST | `/sri/debug/factura-firmada` | Depuración: XML firmado del flujo interno |

### Utilidades
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/sri/sincronizar` | Sincroniza comprobantes PENDIENTES con el SRI |
| GET | `/sri/estadisticas` | Estadísticas de uso del usuario |
| GET | `/sri/status` | Health check público |

### Catálogos (públicos, sin auth)
| Método | Endpoint |
|--------|----------|
| GET | `/sri/catalogos/tipos-identificacion` |
| GET | `/sri/catalogos/tipos-documento` |
| GET | `/sri/catalogos/impuestos` |
| GET | `/sri/catalogos/formas-pago` |
| GET | `/sri/catalogos/tarifas-iva` |
| GET | `/sri/catalogos/retenciones` |

## DTOs clave (nombres de campo exactos del código fuente)

### EmisorDto (11 campos)
```
ruc, razonSocial, nombreComercial, codEstablecimiento, puntoEmision,
dirMatriz, contribuyenteEspecial, obligadoContabilidad, dirEstablecimiento,
llaveFirma, certificadoFirma
```
**Importante:** el campo es `puntoEmision`, NO `ptoEmision`.

### CompradorDto (6 campos)
```
identificacion, razonSocial, tipoIdentificacion, dirMatriz, obligadoContabilidad, email
```

### DetalleFacturaDto (7+ campos)
```
codigoPrincipal, codigoAuxiliar, descripcion, cantidad, precioUnitario, descuento, impuestos[]
```

### PagoDto (4 campos)
```
formaPago, total, plazo, unidadTiempo
```

### ImpuestoDetalleDto (5 campos)
```
codigo, codigoPorcentaje, tarifa, baseImponible, valor
```

### SujetoRetenidoDto (6 campos)
```
identificacion, razonSocial, tipoIdentificacion, dirMatriz, obligadoContabilidad, email
```

### Nota de crédito
Campos adicionales: `moneda`, `fechaEmisionDocSustento`, `numDocSustento`, `codDocSustento`, `motivo`

### Guía de remisión
Usa `destinatarios[]` con: `identificacion, razonSocial, tipoIdentificacion, dirEstablecimiento, dirDestinatario, motivoTraslado, detalles[]`
Campos adicionales: `fechaIniTransporte`, `fechaFinTransporte`, `placa`

### Comprobante de retención
Usa `sujetoRetenido` + `infoRetencion` con `fechaEmisionDocSustento, numDocSustento, codDocSustento, tipoRegimen, impuestos[]`
Cada impuesto de retención: `codigo, codigoRetencion, baseImponible, porcentajeRetener, valorRetenido, codDocSustento, numDocSustento, fechaEmisionDocSustento`

### ComprobanteResponse
```
id, claveAcceso, numero, fecha, estado, ambiente, tipoEmision, tipoDocumento,
valorTotal, fechaAutorizacion, numeroAutorizacion, comprobanteXml
```

## Notas importantes
- `codDoc` NO es campo del payload. Se determina por la ruta: `01` = factura, `04` = nota-credito, `06` = guia-remision, `07` = comprobante-retencion.
- `total` NO es campo directo de CreateFacturaDto. Se calcula de `detalles` + `pagos`.
- `ambiente` default: `1` (Pruebas), `tipoEmision` default: `"1"` (Normal).
- `tipoIdentificacion`: `04`=RUC, `05`=Cédula, `06`=Consumidor Final, `07`=Pasaporte.
- `formaPago`: `01`=Sin utilización, `15`=Compensación, `19`=Otros, `20`=Transferencia, `21`=Tarjeta crédito, etc.

## Webhooks
- 7 eventos: `DOCUMENTO.AUTORIZADO`, `RECHAZADO`, `DEVUELTO`, `ANULADO`, `PENDIENTE`, `GENERADO`, `REENVIADO`
- Firma HMAC-SHA256 en header `x-techost-signature`
- CRUD webhooks: `GET/POST /webhooks`, `GET/PUT/DELETE /webhooks/:id`, `GET /webhooks/:id/logs`
- Payload: `{ event, claveAcceso, estado, numero, tipoDocumento, fechaAutorizacion, numeroAutorizacion, ambiente, timestamp }`

## Recursos CRUD (todos requieren JWT)

### Emisores
`POST/GET /emisores`, `GET/PUT/DELETE /emisores/:id`, `POST /emisores/onboarding`

### Puntos de emisión
`POST/GET /puntos-emision`, `GET/PUT/DELETE /puntos-emision/:id`

### Secuenciales
`POST/GET /secuenciales`, `GET/PUT/DELETE /secuenciales/:id`

### API Keys
`POST/GET /api-keys`, `GET/PUT/DELETE /api-keys/:id`, `POST /api-keys/:id/rotate`

## Payphone
`POST /payphone/webhook` (notificación de transacción), `GET /payphone/transactions`

## Códigos de error HTTP
- `400`: DTO inválido, validación o error de negocio
- `401`: JWT faltante/expirado/inválido
- `403`: API Key inactiva o rate limit
- `404`: Recurso no existe
- `409`: Comprobante duplicado o estado inválido
- `422`: Error SRI (firma, XML, autorización)
- `429`: Rate limit excedido

## Frontend (archivos estáticos en `public/`)

### Landing page
- `public/index.html` + `public/landing.js` + `public/main.css` + `public/index.css`
- Animaciones scroll con IntersectionObserver: `reveal-left`, `reveal-right`, `reveal-up`, `reveal-scale`
- Contador animado para métricas (soporta decimales)
- Línea de conexión entre pasos con relleno progresivo
- Paleta: `#059669` (verde principal), `#10b981` (verde secundario), fondos navy oscuro

### Docs
- `public/docs/index.html` — documentación técnica completa (885 líneas, 57KB)
- Copy button en bloques de código (clipboard API + toast)
- TOC flotante con highlight activo en scroll
- Búsqueda en sidebar (filtro en vivo)
- Drawer móvil con toggle flotante + overlay
- Animaciones reveal en scroll
- Sidebar highlight activo sincronizado con scroll

## Commits del día
```
56c2cfc docs: reescritura completa con DTOs reales, JWT, todos los endpoints
dcf5db5 feat(docs): copy btn, floating TOC, search, animations, mobile drawer
9f37db0 fix: IO callback this -> obs param, counter decimal support
de25a8c feat: scroll animations, counter, step line, direction variants
```
