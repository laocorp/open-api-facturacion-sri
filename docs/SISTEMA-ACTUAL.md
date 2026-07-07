# Sistema Actual — Open API Facturación SRI

> Documento completo de arquitectura, seguridad, módulos, flujos y estado actual del sistema.

opencode -s ses_0d516e972ffeIREZ2XHIXe3bCO

---

## Índice

1. [Arquitectura General](#1-arquitectura-general)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Módulos del Sistema](#3-módulos-del-sistema)
4. [Base de Datos](#4-base-de-datos)
5. [Seguridad](#5-seguridad)
6. [API — Endpoints](#6-api--endpoints)
7. [Flujo de Emisión SRI](#7-flujo-de-emisión-sri)
8. [Modelo Multi-Tenant](#8-modelo-multi-tenant)
9. [Almacenamiento de Archivos](#9-almacenamiento-de-archivos)
10. [Webhooks](#10-webhooks)
11. [Auditoría](#11-auditoría)
12. [Despliegue](#12-despliegue)
13. [Variables de Entorno](#13-variables-de-entorno)

---

## 1. Arquitectura General

```
                    ┌──────────────────────────────────────────────┐
                    │              VPS (Dokploy)                    │
                    │                                               │
                    │  ┌──────────┐  ┌──────────┐                  │
                    │  │Postgres  │  │  Redis   │                  │
                    │  │ :5432    │  │ :6379    │                  │
                    │  └────┬─────┘  └────┬─────┘                  │
                    │       │              │                        │
                    │  ┌────▼──────────────▼──────┐                │
                    │  │    API NestJS :3001       │               │
                    │  │  (JWT + BullMQ + XAdES)   │               │
                    │  └────────────┬──────────────┘                │
                    │               │                               │
                    │  ┌────────────▼──────────┐                    │
                    │  │  Carbone.io :4000     │                    │
                    │  │  (Generación PDFs)   │                    │
                    │  └───────────────────────┘                    │
                    │                                               │
                    │  Dokploy (Nginx reverse proxy)                │
                    │  ┌────────────────────────────────────────┐   │
                    │  │  api.techost.cloud → :3005             │   │
                    │  └────────────────────────────────────────┘   │
                    └──────────────────────────────────────────────┘
```

### Puertos

| Contenedor  | Puerto host | Puerto interno | Expuesto |
|-------------|-------------|---------------|----------|
| API NestJS  | 3005        | 3001          | Sí (Dokploy reverse proxy) |
| Carbone.io  | 3006        | 4000          | No |
| PostgreSQL  | 5449        | 5432          | No |
| Redis       | —           | 6379          | No |

### Flujo de petición

```
Cliente HTTP
  → Helmet + CORS + Rate Limiting (ThrottlerModule)
  → Global JwtAuthGuard (excepto @Public())
  → Global RolesGuard (según @Roles())
  → AuditInterceptor (POST/PUT/PATCH/DELETE)
  → Controller
  → Service
  → DatabaseService (pg Pool directo)
```

---

## 2. Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Runtime | Node.js 22 (Alpine) |
| Framework | NestJS 10 + TypeScript |
| Base de datos | PostgreSQL 16 (SQL directo, sin ORM) |
| Cache / Colas | Redis 7 + BullMQ |
| Autenticación | JWT (access + refresh tokens) |
| Password hashing | bcrypt (12 rounds) |
| Encriptación datos | AES-256-CBC + scrypt KDF |
| Documentos PDF | Carbone.io (template → PDF) |
| Firma digital XML | XAdES-BES (xadesjs) |
| Firma digital PDF | PKCS#7 / CMS (@signpdf) |
| SOAP Client | soap npm package |
| QR codes | qrcode npm |
| Webhooks | HMAC-SHA256 |
| Contenedores | Docker + Docker Compose |
| Plataforma deploy | Dokploy |
| Proxy | Nginx (SSL automático Let's Encrypt) |
| Imagen base | node:22-alpine (multi-stage build) |

---

## 3. Módulos del Sistema

### 3.1 Auth (`/auth`)
- Login con email/password (rate-limited 5 peticiones/minuto)
- Refresh token rotativo
- Registro de usuarios
- Cambio de contraseña
- Perfil y permisos del usuario autenticado
- JWT con expiración 8h, refresh token 7d
- Estrategia: JWT Bearer Token en header `Authorization`

### 3.2 SRI (`/api/v1`)
Módulo principal. 5 tipos de comprobantes electrónicos:

| Comprobante | Endpoint | DTO |
|------------|----------|-----|
| Factura | `POST /api/v1/facturas` | FacturaDto |
| Nota de Crédito | `POST /api/v1/notas-credito` | NotaCreditoDto |
| Nota de Débito | `POST /api/v1/notas-debito` | NotaDebitoDto |
| Comprobante de Retención | `POST /api/v1/retenciones` | RetencionDto |
| Guía de Remisión | `POST /api/v1/guias-remision` | GuiaRemisionDto |

Cada comprobante soporta:
- Modo **síncrono** (espera autorización SRI)
- Modo **asíncrono** `?async=true` (encola en BullMQ, respuesta inmediata con jobId)
- Consulta por clave de acceso
- Descarga de XML firmado
- Descarga de PDF generado

Catálogos SRI: `GET /api/v1/catalogos/:tipo`

### 3.3 Emisores (`/emisores`)
- CRUD de emisores (empresas que emiten comprobantes)
- Cada emisor tiene: RUC, razón social, nombre comercial, dirección
- Jerarquía: Emisor → Establecimiento → Punto de Emisión → Secuencial
- Subida de certificado P12 por emisor (opcional, fallback a global)

### 3.4 Puntos de Emisión (`/establecimientos/:id/puntos-emision`)
- CRUD de establecimientos y puntos de emisión
- Manejo de secuenciales por tipo de comprobante
- Cada punto de emisión tiene: código (3 dígitos), dirección

### 3.5 Certificados (`/certificates`)
- Gestión de archivos .p12 (certificado + clave privada)
- Validación de expiración y contraseña
- Listado con metadata (subject, issuer, fechas)
- Los certificados se almacenan cifrados (AES-256-CBC)

### 3.6 Webhooks (`/webhooks`)
- CRUD de configuraciones de webhook
- Eventos disponibles:
  - `comprobante.creado`
  - `comprobante.autorizado`
  - `comprobante.rechazado`
  - `comprobante.error`
  - `comprobante.devuelto`
- Firma HMAC-SHA256 en header `X-Signature-256`
- Cola BullMQ dedicada con reintentos exponenciales
- Log de entregas en tabla `webhook_logs`

### 3.7 Plantillas (`/templates`)
- Subida y gestión de plantillas para Carbone
- Formatos soportados: .docx, .odt, .html, .xlsx, .ods
- Máximo 10MB por archivo
- Almacenamiento en filesystem (`/data/templates`)

### 3.8 Generación PDF (`/generate-pdf`)
- Generación de PDFs desde plantillas Carbone
- Soporte para overlay de imágenes (PNG/JPG con posición, opacidad)
- Descarga directa o guardado en servidor

### 3.9 Documentos multi-formato (`/documents`)
- Generación de documentos en 16 formatos:
  `pdf, docx, doc, odt, rtf, txt, xlsx, xls, ods, csv, pptx, ppt, odp, html, xml, json`
- Selección de formato por header `X-Output-Format`

### 3.10 Firma Digital PDF (`/signature`)
- Firma digital de PDFs con certificado P12
- Doble capa: visual (QR + texto) + digital (CMS/PKCS#7)
- Fallback a solo visual si falla criptografía

### 3.11 Imágenes (`/images`)
- Subida y gestión de imágenes (para sellos, logos en PDFs)
- Formatos: PNG, JPEG, GIF, WEBP
- Máximo 10MB

### 3.12 Tenants (`/tenants`)
- CRUD de tenants (acceso solo SUPERADMIN)
- Aislamiento lógico de datos por tenant_id

### 3.13 Status (`/status`)
- Health check: estado de BD, memoria heap, memoria RSS
- Redirección de `/` a `/status`

---

## 4. Base de Datos

### 4.1 Estrategia

SQL directo mediante `pg` Pool (NO TypeORM). Razones:
- Schema complejo con triggers, enums, JSONB
- Control total sobre consultas (especialmente inserts bulk)
- Rendimiento: sin overhead de ORM

### 4.2 Tablas

| Tabla | Propósito |
|-------|-----------|
| `tenants` | Organizaciones/clientes multi-tenant |
| `usuarios` | Usuarios del sistema |
| `emisores` | Empresas que emiten comprobantes |
| `establecimientos` | Sucursales por emisor |
| `puntos_emision` | Puntos de emisión (código 3 dígitos) |
| `secuenciales` | Contadores por punto_emision + tipo_comprobante |
| `comprobantes` | Registro principal de cada comprobante |
| `comprobante_detalles` | Líneas/detalles del comprobante |
| `comprobante_impuestos` | Impuestos por detalle |
| `comprobante_totales` | Totales por tipo de impuesto |
| `comprobante_pagos` | Formas de pago |
| `comprobante_retenciones` | Retenciones (solo retención) |
| `impuestos_doc_sustento` | Impuestos documento sustento (retención) |
| `comprobante_xmls` | Rutas de XML firmado y autorizado |
| `info_adicional` | Campos adicionales del comprobante |
| `detalles_adicionales` | Campos adicionales por detalle |
| `destinatarios_guia` | Destinatarios (guía remisión) |
| `detalles_guia` | Detalles por destinatario |
| `motivos_nota_debito` | Motivos (nota débito) |
| `webhook_configs` | Configuraciones de webhook |
| `webhook_logs` | Historial de entregas |
| `auditoria` | Log de acciones (JSONB) |
| `tarifas_impuestos` | Catálogo SRI de impuestos |
| `refresh_tokens` | Tokens refresh rotativos |

### 4.3 Índices principales

- `comprobantes`: UNIQUE por clave_acceso, índice por emisor, estado, fecha_emision, receptor_identificacion
- `webhook_logs`: por config_id, created_at
- `auditoria`: por usuario, entidad, created_at
- `refresh_tokens`: UNIQUE por token_hash, índice por usuario

### 4.4 Triggers

- `update_updated_at_column()` — actualiza `updated_at` automáticamente en usuarios, emisores, establecimientos, puntos_emision, comprobantes
- `trg_comprobante_estado_insert` — setea estado='PENDIENTE' al insertar comprobante

---

## 5. Seguridad

### 5.1 Autenticación

- **JWT** (JSON Web Tokens) con Bearer scheme
- **Access token**: 8h de expiración
- **Refresh token**: 7d, almacenado con hash en BD, rotativo (se invalida al usar)
- **bcrypt** con 12 rounds para password hashing
- Guardia global: `JwtAuthGuard` protege TODOS los endpoints por defecto
- Decorador `@Public()` para excepciones (login, refresh, status)

### 5.2 Autorización

- **Roles**: SUPERADMIN, ADMIN, USER
- `RolesGuard` global: verifica `@Roles()` metadata contra `user.rol`
- SUPERADMIN tiene todos los permisos automáticamente
- Aislamiento multi-tenant: usuarios solo ven datos de su tenant

### 5.3 Protección de rutas

- **Rate Limiting**: 5 peticiones/minuto en `/auth/login` (ThrottlerModule)
- **Helmet**: headers de seguridad HTTP
- **CORS**: configurable via `ALLOWED_ORIGINS`
- **Throttle global**: configurable via `THROTTLE_TTL` y `THROTTLE_LIMIT`

### 5.4 Encriptación de datos sensibles

- **AES-256-CBC** para cifrar passwords de certificados P12
- **scrypt** (N=16384, r=8, p=1) para derivación de clave desde ENCRYPTION_KEY
- Formato: `iv_hex:encrypted_hex`

### 5.5 Webhooks

- **HMAC-SHA256** firmando el body de la petición
- Header: `X-Signature-256`
- El webhook receptor debe verificar la firma con el secret compartido

### 5.6 Auditoría

- Interceptor global captura **TODAS** las mutaciones (POST/PUT/PATCH/DELETE)
- Almacena: userId, método, URL, body, IP, userAgent
- Excluye: `/auth/login`, `/auth/refresh`, `/status`, `/health`
- Fire-and-forget (no bloquea la respuesta)

### 5.7 Manejo de errores

- Filtro global `AllExceptionsFilter`
- Formato uniforme: `{ success: false, statusCode, error }`
- Stack trace solo en desarrollo

---

## 6. API — Endpoints

### Auth

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/auth/login` | Public | Login (rate-limited 5/min) |
| POST | `/auth/register` | Public | Registro |
| POST | `/auth/refresh` | Public | Refresh token |
| PATCH | `/auth/change-password` | JWT | Cambiar contraseña |
| GET | `/auth/me` | JWT | Perfil actual |
| GET | `/auth/me/permisos` | JWT | Permisos del usuario |

### SRI

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/v1/facturas` | Emitir factura |
| POST | `/api/v1/notas-credito` | Emitir nota de crédito |
| POST | `/api/v1/notas-debito` | Emitir nota de débito |
| POST | `/api/v1/retenciones` | Emitir retención |
| POST | `/api/v1/guias-remision` | Emitir guía remisión |
| GET | `/api/v1/:tipo/:claveAcceso` | Consultar comprobante |
| PATCH | `/api/v1/:tipo/:claveAcceso/estado` | Actualizar estado |
| GET | `/api/v1/:tipo/:claveAcceso/xml` | Descargar XML |
| GET | `/api/v1/:tipo/:claveAcceso/pdf` | Descargar PDF |
| GET | `/api/v1/comprobantes` | Listar (paginado + filtros) |
| GET | `/api/v1/catalogos/:tipo` | Catálogos SRI |

### Emisores

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/emisores` | Listar |
| POST | `/emisores` | Crear |
| GET | `/emisores/:id` | Obtener |
| PUT | `/emisores/:id` | Actualizar |
| DELETE | `/emisores/:id` | Eliminar |

### Puntos de Emisión

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/establecimientos/:estId/puntos-emision` | Listar |
| POST | `/establecimientos/:estId/puntos-emision` | Crear |
| GET | `/puntos-emision/:id` | Obtener |
| PUT | `/puntos-emision/:id` | Actualizar |
| DELETE | `/puntos-emision/:id` | Eliminar |
| GET | `/puntos-emision/:id/secuenciales` | Listar secuenciales |
| POST | `/puntos-emision/:id/secuenciales` | Crear/actualizar secuencial |

### Certificados

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/certificates` | Listar .p12 |
| POST | `/certificates/upload` | Subir .p12 |
| POST | `/certificates/validate` | Validar |

### Webhooks

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/webhooks` | Listar configs |
| POST | `/webhooks` | Crear |
| PUT | `/webhooks/:id` | Actualizar |
| DELETE | `/webhooks/:id` | Eliminar |
| GET | `/webhooks/eventos` | Eventos disponibles |

### Plantillas / PDFs / Documentos

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/templates` | Listar plantillas |
| POST | `/templates/upload` | Subir plantilla |
| DELETE | `/templates/:id` | Eliminar |
| POST | `/generate-pdf/download/:templateId` | Generar PDF |
| POST | `/generate-pdf/save/:templateId` | Generar y guardar |
| POST | `/documents/download/:templateId` | Generar documento multi-formato |
| POST | `/documents/save/:templateId` | Generar y guardar |
| POST | `/signature/sign-pdf/:fileName` | Firmar PDF existente |
| POST | `/signature/generate-sign-pdf/:templateId` | Generar + firmar |
| POST | `/images/upload` | Subir imagen |
| GET | `/images/list` | Listar imágenes |

### Tenant (SUPERADMIN)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET/POST | `/tenants` | CRUD |
| GET/PUT/DELETE | `/tenants/:id` | CRUD |

### Status

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/status` | Health check |
| GET | `/` | Redirect a /status |
| GET | `/api` | Swagger UI |

### Formato de respuesta

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

Respuesta paginada:
```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "total": 150,
    "pagination": {
      "page": 1,
      "limit": 10,
      "totalPages": 15,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

---

## 7. Flujo de Emisión SRI

### 7.1 Ciclo de vida de un comprobante

```
[PENDIENTE] → [FIRMANDO_XML] → [ENVIANDO_SRI] → [RECIBIDO] → [CONSULTANDO_AUTORIZACION] → [AUTORIZADO]
                                                      ↓
                                                [RECHAZADO] ← SRI devuelve errores

Posibles estados de error:
  [ERROR_FIRMA] - Falló firma XAdES
  [ERROR_ENVIO] - Falló conexión SOAP con SRI
  [EN_PROCESO]  - Timeout consultando autorización
```

### 7.2 Fases de emisión (sync)

**Fase 1 — Validación y construcción**
1. Validar datos del comprobante (identificación, catálogos SRI)
2. Validar configuración del emisor (ambiente, certificado)
3. Generar clave de acceso (49 dígitos con módulo 11)
4. Construir XML con xml2js

**Fase 2 — Firma XAdES-BES**
1. Cargar certificado P12 del emisor (caché por RUC con TTL)
2. Extraer clave privada via node-forge
3. Firmar XML con xadesjs + @peculiar/webcrypto
4. Guardar XML firmado en disco

**Fase 3 — Envío SRI + Autorización**
1. Enviar XML firmado a Recepción SOAP (`validarComprobante`)
2. Si respuesta = RECIBIDA → pollear Autorización cada 2s (máx 30s)
3. Si AUTORIZADO: persistir comprobante completo en DB (transacción SQL con 12 tablas)
4. Guardar XML autorizado en disco
5. Emitir evento de webhook correspondiente
6. Retornar resultado completo

### 7.3 Modo asíncrono (BullMQ)

1. Encola trabajo en cola `sri-emision` (3 intentos, backoff 2s)
2. Responde inmediatamente: `{ jobId, tipo, estado: "ENCOLADO" }`
3. Worker procesa en background (mismas 3 fases)
4. Al completar: emite webhook con resultado

### 7.4 Clave de Acceso (49 dígitos)

```
ddmmaaaa + tt + rrrrrrrrrrrrr + a + eee + ppp + sssssssss + nnnnnnnn + e

  ddmmaaaa  = Fecha emisión (ddmmYYYY)
  tt        = Tipo comprobante (01=factura, 04=nota crédito, etc.)
  rrrr...   = RUC (13 dígitos)
  a         = Ambiente (1=pruebas, 2=producción)
  eee       = Código establecimiento (3)
  ppp       = Código punto emisión (3)
  sssssssss = Secuencial (9 dígitos)
  nnnnnnnn  = Código numérico (8 dígitos aleatorios)
  e         = Dígito verificador (módulo 11)
```

### 7.5 WebServices SRI

| Ambiente | Recepción | Autorización |
|----------|-----------|-------------|
| Pruebas | `celcer.sri.gob.ec` WSDL | `celcer.sri.gob.ec` WSDL |
| Producción | `cel.sri.gob.ec` WSDL | `cel.sri.gob.ec` WSDL |

---

## 8. Modelo Multi-Tenant

### 8.1 Jerarquía

```
Tenant
  └── Usuarios (roles: SUPERADMIN, ADMIN, USER)
  └── Emisores (RUC real de la empresa)
        └── Establecimientos (sucursales)
              └── Puntos de Emisión
                    └── Secuenciales (contador por tipo comprobante)
```

### 8.2 Aislamiento

- Aislamiento **lógico** por `tenant_id` en todas las tablas
- SUPERADMIN: puede ver y gestionar todos los tenants
- ADMIN/USER: limitados a su tenant
- RolesGuard verifica permisos a nivel de controlador

### 8.3 Seed data por defecto

- Tenant: "Default Tenant"
- Emisor: RUC 1234567890001, "Empresa Default S.A."
- Establecimiento: "001"
- Punto emisión: "001"
- Admin: admin@example.com / admin123 (rol: SUPERADMIN)

---

## 9. Almacenamiento de Archivos

### 9.1 Estructura en disco

```
/data/
├── templates/          ← Plantillas Carbone (.docx, .odt, .html, .xlsx, .ods)
├── pdfs/
│   ├── con_firma/      ← PDFs firmados digitalmente
│   ├── others/         ← PDFs sin firma
│   ├── documents/      ← Documentos multi-formato
│   └── images/         ← Imágenes subidas (sellos, logos)
├── certs/              ← Certificados P12 de emisores
│   └── 0999999999001.p12
└── xmls/               ← XMLs de comprobantes
    └── {ruc_emisor}/
        └── {yyyy}/
            └── {mm}/
                ├── {clave_acceso}_firmado.xml
                └── {clave_acceso}_autorizado.xml
```

### 9.2 Volúmenes Docker

| Volumen | Ruta contenedor | Persistencia |
|---------|----------------|-------------|
| `templates_data` | `/data/templates` | Permanente |
| `pdfs_data` | `/data/pdfs` | Permanente |
| `certs_data` | `/data/certs` | Permanente |
| `xmls_data` | `/data/xmls` | Permanente |
| `postgres_data` | `/var/lib/postgresql/data` | Permanente |
| `redis_data` | `/data` | Permanente |

---

## 10. Webhooks

### 10.1 Configuración

- Por tenant: múltiples URLs destino
- Cada webhook se suscribe a eventos específicos (array)
- Secret compartido para firma HMAC

### 10.2 Entrega

- Cola BullMQ dedicada: `webhook-dispatch`
- 5 intentos máximos, backoff exponencial desde 3s
- Firma HMAC-SHA256 en header `X-Signature-256`
- Log de cada intento en `webhook_logs` (status code, response, error)

### 10.3 Formato de payload

```json
{
  "event": "comprobante.autorizado",
  "timestamp": "2026-07-04T03:00:00.000Z",
  "data": {
    "claveAcceso": "040720260112345678900112345678901234567890123456789",
    "tipo": "factura",
    "estado": "AUTORIZADO",
    "numeroAutorizacion": "040720260112345678900112345678901234567890123456789",
    "fechaAutorizacion": "2026-07-04T03:00:15.000Z"
  }
}
```

---

## 11. Auditoría

### 11.1 Cobertura

Toda mutación vía API queda registrada automáticamente:

| Campo | Descripción |
|-------|-------------|
| `usuario_id` | Quién hizo la acción |
| `tenant_id` | A qué tenant pertenece |
| `accion` | Método HTTP (POST/PUT/PATCH/DELETE) |
| `entidad_tipo` | Ruta del endpoint |
| `entidad_id` | ID del recurso afectado |
| `valor_nuevo` | Body completo en JSONB |
| `ip_address` | IP de origen |
| `user_agent` | User-Agent del cliente |
| `created_at` | Timestamp |

### 11.2 Excepciones

No se auditan:
- `/auth/login`
- `/auth/refresh`
- `/status`
- `/health`

---

## 12. Despliegue

### 12.1 Docker Compose (producción)

4 servicios orquestados:

```yaml
postgres:16-alpine    → Base de datos (init.sql automático)
redis:7-alpine        → Colas BullMQ + caché
carbone/carbone-ee    → Generación documentos (Community Edition)
api (build local)     → API NestJS (multi-stage Dockerfile)
```

### 12.2 Dokploy

- Plataforma: Dokploy con reverse proxy Nginx + SSL Let's Encrypt
- Las variables de entorno se inyectan desde la UI de Dokploy (no archivo .env)
- Redeploy automático desde GitHub

### 12.3 URLs activas

- API: `https://api.techost.cloud`
- Swagger: `https://api.techost.cloud/api`
- Health: `https://api.techost.cloud/status`

---

## 13. Variables de Entorno

### 13.1 Servidor

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PORT` | `3001` | Puerto interno API |
| `NODE_ENV` | `development` | Entorno |
| `PUBLIC_URL` | `http://localhost:3001` | URL pública |

### 13.2 Base de Datos

| Variable | Default | Descripción |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | Host PostgreSQL |
| `DB_PORT` | `5432` | Puerto |
| `DB_USER` | `postgres` | Usuario |
| `DB_PASSWORD` | — | Password |
| `DB_NAME` | `db_sri` | Base de datos |
| `DB_SSL` | `false` | SSL |
| `DB_POOL_MAX` | `20` | Pool máximo |

### 13.3 Redis

| Variable | Default | Descripción |
|----------|---------|-------------|
| `REDIS_HOST` | `localhost` | Host |
| `REDIS_PORT` | `6379` | Puerto |
| `REDIS_PASSWORD` | — | Password |
| `REDIS_DB` | `0` | DB index |
| `CACHE_TTL_SECONDS` | `300` | TTL caché (Redis DB 1) |

### 13.4 JWT

| Variable | Default | Descripción |
|----------|---------|-------------|
| `JWT_SECRET` | — | Secreto (32+ chars base64) |
| `JWT_EXPIRATION` | `8h` | Expiración access token |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Expiración refresh token |

### 13.5 Encriptación

| Variable | Default | Descripción |
|----------|---------|-------------|
| `ENCRYPTION_KEY` | — | Clave AES-256 (64 hex) |
| `ENCRYPTION_SALT` | — | Salt (32 hex) |

### 13.6 SRI

| Variable | Default | Descripción |
|----------|---------|-------------|
| `SRI_ENVIRONMENT` | `development` | Ambiente (development/production) |
| `SRI_RECEPTION_WSDL` | — | URL WSDL recepción |
| `SRI_AUTHORIZATION_WSDL` | — | URL WSDL autorización |
| `SRI_EMISION_ASYNC` | `true` | Modo asíncrono (BullMQ) |
| `SRI_REQUEST_DELAY_MS` | `150` | Delay entre peticiones |
| `SRI_MAX_RETRIES` | `3` | Reintentos máximos |
| `SRI_RETRY_DELAY_MS` | `2000` | Delay entre reintentos |

### 13.7 Carbone / PDF

| Variable | Default | Descripción |
|----------|---------|-------------|
| `CARBONE_API` | `http://carbone:4000` | URL Carbone |
| `CARBONE_DEBUG` | `false` | Debug |
| `CARBONE_CONVERT_TO` | `pdf` | Formato default |
| `PDF_MAX_ATTEMPTS` | `2` | Intentos render PDF |
| `PDF_RETRY_DELAY` | `10` | Delay segundos |

### 13.8 Firma digital

| Variable | Default | Descripción |
|----------|---------|-------------|
| `SIGNATURE_QR_SIZE` | `50` | Tamaño QR en PDF |
| `SIGNATURE_TOTAL_WIDTH` | `200` | Ancho sello |
| `SIGNATURE_DEFAULT_X` | `0` | Posición X |
| `SIGNATURE_DEFAULT_Y` | `0` | Posición Y |
| `SIGNATURE_DEFAULT_PAGE` | `-1` | Página (-1=última) |

### 13.9 Directorios

| Variable | Default | Descripción |
|----------|---------|-------------|
| `TEMPLATES_DIR` | `/data/templates` | Plantillas |
| `PDFS_DIR` | `/data/pdfs` | PDFs |
| `CERTS_DIR` | `/data/certs` | Certificados |
| `XMLS_DIR` | `/data/xmls` | XMLs |

### 13.10 CORS / Rate Limiting

| Variable | Default | Descripción |
|----------|---------|-------------|
| `ALLOWED_ORIGINS` | `*` | Orígenes CORS |
| `THROTTLE_TTL` | `60000` | Ventana rate limit |
| `THROTTLE_LIMIT` | `100` | Máx peticiones/ventana |

---

## Resumen de capacidades actuales

### ✅ Lo que el sistema YA hace

- **5 tipos de comprobantes electrónicos ecuatorianos**: factura, nota de crédito, nota de débito, retención, guía de remisión
- **Firma digital XAdES-BES** con certificados P12 por emisor
- **Comunicación SOAP** con SRI (recepción + autorización)
- **Generación de PDF** vía Carbone.io con plantillas personalizables
- **Firma digital PDF** (visual + digital CMS/PKCS#7)
- **Documentos multi-formato** (16 formatos de salida)
- **Webhooks** con HMAC-SHA256 para integración externa
- **Auditoría completa** de todas las operaciones
- **Multi-tenant** con roles SUPERADMIN, ADMIN, USER
- **Modo asíncrono** con BullMQ + Redis
- **API REST** documentada con Swagger
- **Almacenamiento organizado** de XMLs, PDFs, certificados y plantillas

### ❌ Lo que NO tiene (para negocio SaaS)

| Carencia | Impacto |
|----------|---------|
| Dashboard web | Clientes no pueden ver reportes, estadísticas, ni gestionar su cuenta |
| Portal de clientes (autoservicio) | Cada cliente requiere intervención del admin para cambios |
| Onboarding automatizado | Registro, planes, pago, activación son manuales |
| Facturación y cobros | No hay suscripciones, planes, ni facturación recurrente |
| Módulo de contabilidad | No hay integración con sistemas contables |
| Notificaciones email | No hay servicio de correo (bienvenida, alertas, facturas) |
| Reportes y analytics | No hay dashboards de emisión, errores, volumen |
| API Keys (developer portal) | No hay autoservicio para desarrolladores externos |
| Rate limiting por API Key | El rate limit es global, no por cliente |
| White-label | No se puede personalizar marca por tenant |
| Monitoreo avanzado | No hay alertas de errores, umbrales, uptime |
| Backup automático | No hay schedule de backups de BD + archivos |
| Logs centralizados | No hay agregación de logs (depende de Docker) |
| Migrations | Schema se maneja con init.sql manual |
| Tests automatizados | No hay suite de tests |

---
