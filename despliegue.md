# Guía de Despliegue — Open API Facturación SRI en Dokploy

> Documento paso a paso para desplegar la API de facturación electrónica SRI Ecuador en Dokploy.

---

## Índice

1. [Arquitectura del despliegue](#1-arquitectura-del-despliegue)
2. [Requisitos previos](#2-requisitos-previos)
3. [Estructura del proyecto](#3-estructura-del-proyecto)
4. [Paso a paso en Dokploy](#4-paso-a-paso-en-dokploy)
5. [Variables de entorno](#5-variables-de-entorno)
6. [Dominios y servicios](#6-dominios-y-servicios)
7. [Volúmenes y datos persistentes](#7-volúmenes-y-datos-persistentes)
8. [Post-despliegue](#8-post-despliegue)
9. [Mantenimiento](#9-mantenimiento)
10. [Solución de problemas](#10-solución-de-problemas)

---

## 1. Arquitectura del despliegue

Dokploy orquesta 4 contenedores en una sola VPS:

```
                    ┌──────────────────────────────────────┐
                    │           VPS (Dokploy)               │
                    │                                      │
                    │  ┌──────────┐  ┌──────────┐         │
                    │  │ Postgres │  │  Redis   │         │
                    │  │  :5432   │  │  :6379   │         │
                    │  └────┬─────┘  └────┬─────┘         │
                    │       │              │               │
                    │  ┌────▼──────────────▼──────┐        │
                    │  │    API NestJS :3001       │        │
                    │  │  (JWT + BullMQ + XAdES)   │        │
                    │  └────────────┬──────────────┘        │
                    │               │                        │
                    │  ┌────────────▼──────────┐             │
                    │  │   Carbone.io :3002    │             │
                    │  │   (Generación PDFs)   │             │
                    │  └───────────────────────┘             │
                    │                                      │
                    │  Dokploy (Nginx reverse proxy)        │
                    │  ┌────────────────────────────────┐   │
                    │  │  api.tudominio.com → :3001     │   │
                    │  │  carbone.tudominio.com → :3002 │   │
                    │  └────────────────────────────────┘   │
                    └──────────────────────────────────────┘
```

### Puerto de la API

La API corre internamente en el puerto `3001`. Dokploy expone este puerto hacia internet a través de su proxy reverso interno con SSL automático (Let's Encrypt). Los contenedores de PostgreSQL, Redis y Carbone NO se exponen al exterior — solo se comunican por la red interna de Dokploy.

| Contenedor  | Puerto host | Puerto interno | Expuesto al exterior | ¿Por qué?                          |
|-------------|-------------|---------------|---------------------|------------------------------------|
| API NestJS  | 3005        | 3001          | Sí (por Dokploy)   | Los clientes consumen la API       |
| Carbone.io  | 3006        | 3000          | No                 | Solo la API lo necesita            |
| PostgreSQL  | 5449        | 5432          | No                 | Solo la API se conecta             |
| Redis       | —           | 6379          | No                 | Solo la API lo usa (colas + cache) |

---

## 2. Requisitos previos

### 2.1 En tu VPS

| Recurso            | Mínimo recomendado          |
|--------------------|-----------------------------|
| VPS                | 4 GB RAM, 2 vCores, 50 GB SSD |
| Docker Engine      | 24+ (Dokploy lo incluye)    |
| Dokploy            | Ya instalado                |
| Dominios           | 1 o 2 dominios apuntando al VPS |

### 2.2 En tu máquina local

```bash
# Node.js 22+ (para generar secrets)
node --version

# Git
git --version
```

### 2.3 Archivos necesarios para Dokploy

Dokploy necesita acceso al repositorio Git. Asegúrate de tener:

- Repositorio en GitHub/GitLab con el código
- El archivo `docker-compose.prod.yml` en la raíz
- El archivo `database/init.sql` (inicializa la BD automáticamente)
- El archivo `Dockerfile` (multi-stage build)

---

## 3. Estructura del proyecto

```
open-api-facturacion-sri/
├── docker-compose.prod.yml      ← Dokploy usa este archivo
├── Dockerfile                   ← Build multi-stage
├── package.json                 ← Dependencias
├── tsconfig.json                ← Config TypeScript
├── nest-cli.json                ← Config NestJS
├── database/
│   └── init.sql                 ← Schema + catálogos + seed data
├── scripts/
│   └── generate-secrets.sh      ← Genera claves seguras
└── src/                         ← Código fuente (se compila en el build)
```

---

## 4. Paso a paso en Dokploy

### Paso 1: Generar secrets

En tu máquina local, dentro del proyecto:

```bash
# Asegúrate de tener Node.js instalado
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('ENCRYPTION_SALT=' + require('crypto').randomBytes(16).toString('hex'))"
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log('DB_PASSWORD=' + require('crypto').randomBytes(16).toString('base64'))"
node -e "console.log('REDIS_PASSWORD=' + require('crypto').randomBytes(16).toString('base64'))"
```

O usa el script incluido:

```bash
node scripts/generate-secrets.sh
# O si estás en Linux/Mac:
bash scripts/generate-secrets.sh
```

Guarda los valores que se generen. Los necesitarás en Dokploy.

### Paso 2: Subir el código a GitHub

```bash
git push origin main
```

### Paso 3: Crear proyecto en Dokploy

1. Accede a tu panel de Dokploy (`https://dokploy.tudominio.com` o `http://TU_VPS_IP:3000`)
2. Haz clic en **"Nuevo proyecto"**
3. Nombre del proyecto: `facturacion-sri`
4. Haz clic en **"Crear"**

### Paso 4: Crear servicio Docker Compose

Dentro del proyecto:

1. Haz clic en **"Nuevo servicio"**
2. Tipo: **"Docker Compose"**
3. **Source**: Conéctalo a tu repositorio de GitHub
   - Selecciona el repositorio `laocorp/open-api-facturacion-sri`
   - Rama: `main`
   - Ruta del archivo compose: `docker-compose.prod.yml`
4. **Nombre del servicio**: `sri-api` (o el que prefieras)

### Paso 5: Configurar variables de entorno

En la sección **"Environment"** de Dokploy, agrega todas las variables de la [sección 5](#5-variables-de-entorno). Usa los secrets que generaste en el Paso 1.

> ⚠️ **IMPORTANTE**: Reemplaza `sri.tudominio.com` con tu dominio real. No uses valores genéricos.

### Paso 6: Configurar dominios

En la sección **"Domains"** del servicio `sri-api`:

| Dominio                 | Puerto | SSL     |
|-------------------------|--------|---------|
| `api.tudominio.com`     | 3005   | ✅ Auto |

(No necesitas crear servicios separados para PostgreSQL, Redis o Carbone — el Docker Compose los maneja internamente. Solo se expone el puerto de la API a través del dominio.)

### Paso 7: Configurar volúmenes (volumes)

Dokploy usará los volúmenes definidos en `docker-compose.prod.yml`. Debes crear los directorios para almacenamiento persistente:

1. Ve a la sección **Volumes** del proyecto
2. Asegúrate de que Docker Compose cree automáticamente estos volúmenes:
   - `postgres_data` — datos de PostgreSQL
   - `redis_data` — datos de Redis
   - `templates_data` — plantillas de documentos
   - `pdfs_data` — PDFs generados
   - `certs_data` — certificados digitales P12
   - `xmls_data` — XMLs de comprobantes

> ✅ Dokploy maneja los volúmenes automáticamente. No necesitas crear nada manualmente.

### Paso 8: Desplegar

1. Haz clic en **"Deploy"**
2. Espera a que Dokploy:
   - Clone el repositorio
   - Construya la imagen Docker (multi-stage)
   - Inicie PostgreSQL y configure la BD con `init.sql`
   - Inicie Redis
   - Inicie Carbone
   - Inicie la API NestJS
3. Verás los logs en tiempo real. Busca "Server running" al final.

### Paso 9: Verificar

```bash
# Health check
curl https://api.tudominio.com/status

# Swagger UI (abre en navegador)
https://api.tudominio.com/api

# Login de prueba
curl -X POST https://api.tudominio.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "superadmin@openapi-sri.com", "password": "Admin123!"}'
```

> ⚠️ **CAMBIA LA CONTRASEÑA DEL SUPERADMIN INMEDIATAMENTE después del login**.

---

## 5. Variables de entorno

Copia y pega TODAS estas variables en la sección **Environment** de Dokploy. Reemplaza los valores marcados con `<<...>>`.

### Secrets (generar con node -e "crypto.randomBytes...")

| Variable | Requerido | Descripción | Cómo generarlo |
|----------|-----------|-------------|----------------|
| `ENCRYPTION_KEY` | ✅ Sí | Clave de cifrado (64 caracteres hex) | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ENCRYPTION_SALT` | ✅ Sí | Salt de cifrado (32 caracteres hex) | `node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"` |
| `JWT_SECRET` | ✅ Sí | Secreto para tokens JWT (44+ chars base64) | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `DB_PASSWORD` | ✅ Sí | Password de PostgreSQL | `node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"` |
| `REDIS_PASSWORD` | ✅ Sí | Password de Redis | `node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"` |

### Configuración del servidor

| Variable | Requerido | Valor |
|----------|-----------|-------|
| `PORT` | ✅ Sí | `3005` |
| `PUBLIC_URL` | ✅ Sí | `https://api.tudominio.com` |
| `NODE_ENV` | ✅ Sí | `production` |

### Carbone (generación de PDFs)

| Variable | Requerido | Valor |
|----------|-----------|-------|
| `CARBONE_API` | ✅ Sí | `http://carbone:3000` |
| `CARBONE_DEBUG` | ❌ No | `false` |
| `CARBONE_CONVERT_TO` | ❌ No | `pdf` |

### Directorios (rutas DENTRO del contenedor — NO CAMBIAR)

| Variable | Requerido | Valor |
|----------|-----------|-------|
| `TEMPLATES_DIR` | ✅ Sí | `/data/templates` |
| `PDFS_DIR` | ✅ Sí | `/data/pdfs` |
| `CERTS_DIR` | ✅ Sí | `/data/certs` |
| `XMLS_DIR` | ✅ Sí | `/data/xmls` |

### PDF / Firma

| Variable | Requerido | Valor |
|----------|-----------|-------|
| `PDF_MAX_ATTEMPTS` | ❌ No | `2` |
| `PDF_RETRY_DELAY` | ❌ No | `10` |
| `SIGNATURE_QR_SIZE` | ❌ No | `50` |
| `SIGNATURE_TOTAL_WIDTH` | ❌ No | `200` |
| `SIGNATURE_DEFAULT_X` | ❌ No | `0` |
| `SIGNATURE_DEFAULT_Y` | ❌ No | `0` |
| `SIGNATURE_DEFAULT_PAGE` | ❌ No | `-1` |

### SRI Ecuador

| Variable | Requerido | Valor |
|----------|-----------|-------|
| `SRI_ENVIRONMENT` | ✅ Sí | `development` (para pruebas) → `production` (cuando el SRI apruebe) |
| `SRI_RECEPTION_WSDL` | ✅ Sí | `https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl` |
| `SRI_AUTHORIZATION_WSDL` | ✅ Sí | `https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl` |

### Base de Datos (PostgreSQL — corre dentro del compose)

| Variable | Requerido | Valor |
|----------|-----------|-------|
| `DB_HOST` | ✅ Sí | `postgres` |
| `DB_PORT` | ✅ Sí | `5432` |
| `DB_NAME` | ✅ Sí | `db_sri` |
| `DB_USER` | ✅ Sí | `postgres` |
| `DB_PASSWORD` | ✅ Sí | `<<el que generaste>>` |
| `DB_SSL` | ❌ No | `false` |
| `DB_POOL_MAX` | ❌ No | `20` |

### Redis (colas + caché — corre dentro del compose)

| Variable | Requerido | Valor |
|----------|-----------|-------|
| `REDIS_HOST` | ✅ Sí | `redis` |
| `REDIS_PORT` | ✅ Sí | `6379` |
| `REDIS_PASSWORD` | ✅ Sí | `<<el que generaste>>` |
| `REDIS_DB` | ❌ No | `0` |

### SRI Emisión (asincrónica)

| Variable | Requerido | Valor |
|----------|-----------|-------|
| `SRI_EMISION_ASYNC` | ❌ No | `true` |
| `SRI_REQUEST_DELAY_MS` | ❌ No | `150` |
| `SRI_MAX_RETRIES` | ❌ No | `3` |
| `SRI_RETRY_DELAY_MS` | ❌ No | `2000` |

### JWT

| Variable | Requerido | Valor |
|----------|-----------|-------|
| `JWT_SECRET` | ✅ Sí | `<<el que generaste>>` |
| `JWT_EXPIRATION` | ❌ No | `8h` |

### CORS y Rate Limiting

| Variable | Requerido | Valor |
|----------|-----------|-------|
| `ALLOWED_ORIGINS` | ✅ Sí | `https://api.tudominio.com,https://admin.tudominio.com` |
| `THROTTLE_TTL` | ❌ No | `60000` |
| `THROTTLE_LIMIT` | ❌ No | `100` |

---

## 6. Dominios y servicios

### Opción A: Un solo dominio (recomendado para empezar)

Usa un solo dominio para la API. Carbone, PostgreSQL y Redis quedan internos.

```
api.tudominio.com → Puerto 3005 → API NestJS
```

Configuración en Dokploy:
- **Dominio**: `api.tudominio.com`
- **Puerto**: `3005`
- **SSL**: Let's Encrypt automático
- **Caminos**: `/` → API + Swagger
- **Public URL**: https://api.tudominio.com

### Opción B: Múltiples dominios (para producción avanzada)

```
api.tudominio.com       → Puerto 3005 → API NestJS (endpoints SRI + auth)
carbone.tudominio.com   → No expuesto → Carbone solo interno, no se expone
admin.tudominio.com     → Puerto 3005 → Misma API (CORS configurado)
```

En Dokploy solo creas UN servicio Docker Compose (el compose incluye todos los contenedores). Luego agregas MÚLTIPLES dominios apuntando al mismo servicio:

| Dominio | Puerto | ¿Para qué? |
|---------|--------|------------|
| `api.tudominio.com` | 3005 | Endpoints de facturación, Swagger, health checks |
| `admin.tudominio.com` | 3005 | (Opcional) Panel administrativo si lo desarrollas después |

No expongas Carbone, PostgreSQL ni Redis al exterior. No hay ninguna razón para que estén accesibles desde internet.

---

## 7. Volúmenes y datos persistentes

El `docker-compose.prod.yml` define 6 volúmenes. Dokploy los maneja automáticamente:

| Volumen | Contenido | ¿Se borra al redeploy? |
|---------|-----------|------------------------|
| `postgres_data` | Base de datos completa | ❌ No — Persiste |
| `redis_data` | Colas y caché | ❌ No — Persiste |
| `templates_data` | Plantillas .docx/.xlsx | ❌ No — Persiste |
| `pdfs_data` | PDFs generados + RIDEs | ❌ No — Persiste |
| `certs_data` | Certificados digitales P12 | ❌ No — Persiste |
| `xmls_data` | XMLs firmados y autorizados | ❌ No — Persiste |

### Estructura de archivos dentro de los volúmenes

```
/data/
├── templates/          ← Plantillas Carbone (subir vía API)
│   ├── factura.docx
│   ├── nota-credito.docx
│   └── guia-remision.docx
├── pdfs/
│   ├── con_firma/      ← PDFs firmados digitalmente
│   ├── others/         ← PDFs sin firma
│   ├── documents/      ← Otros documentos generados
│   └── images/         ← Imágenes subidas
├── certs/              ← Certificados P12 de emisores
│   └── 0999999999001.p12
└── xmls/               ← XMLs de comprobantes
    └── 0999999999001/  ← Por RUC del emisor
        └── 2026/
            └── 01/
                ├── 0999999999001123456789001234567890012345678901_firmado.xml
                └── 0999999999001123456789001234567890012345678901_autorizado.xml
```

---

## 8. Post-despliegue

### 8.1 Verificar servicios

```bash
# Todos los contenedores deben estar "running"
docker ps

# Logs de la API
docker compose -f docker-compose.prod.yml logs api

# Health check
curl https://api.tudominio.com/status
# Respuesta esperada: {"status":"ok","timestamp":"..."}
```

### 8.2 Seed de base de datos

El archivo `database/init.sql` se ejecuta automáticamente LA PRIMERA VEZ que se inicia PostgreSQL. Contiene:

- 18 tablas (comprobantes, emisores, usuarios, etc.)
- Catálogos del SRI pre-cargados (impuestos, formas de pago, retenciones, etc.)
- Usuario superadmin por defecto:
  - Email: `superadmin@openapi-sri.com`
  - Password: `Admin123!`

### 8.3 Cambiar contraseña del superadmin

```bash
# 1. Login
curl -X POST https://api.tudominio.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "superadmin@openapi-sri.com", "password": "Admin123!"}'

# 2. Copiar el accessToken del response

# 3. Cambiar contraseña
curl -X PATCH https://api.tudominio.com/auth/change-password \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword": "Admin123!", "newPassword": "TuPasswordSegura2026!"}'
```

### 8.4 Subir certificado P12

Ya con el token JWT:

```bash
curl -X POST https://api.tudominio.com/certificates/upload-cert \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -F "file=@/ruta/a/tu/certificado.p12" \
  -F "password=tu_password_p12" \
  -F "ruc=0999999999001"
```

### 8.5 Probar emisión en ambiente de pruebas

```bash
curl -X POST https://api.tudominio.com/sri/factura/emitir \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "ambiente": "1",
    "tipoEmision": "1",
    "fechaEmision": "01/01/2026",
    "emisor": {
      "ruc": "0999999999001",
      "razonSocial": "EMPRESA DE PRUEBA S.A.",
      "nombreComercial": "EMPRESA DE PRUEBA",
      "establecimiento": "001",
      "puntoEmision": "001",
      "dirMatriz": "Av. Principal 123",
      "dirEstablecimiento": "Av. Principal 123"
    },
    "comprador": {
      "tipoIdentificacion": "05",
      "identificacion": "0999999999",
      "razonSocial": "CLIENTE DE PRUEBA",
      "email": "cliente@test.com"
    },
    "detalles": [
      {
        "codigoPrincipal": "001",
        "descripcion": "Producto de prueba",
        "cantidad": 1,
        "precioUnitario": 100.00,
        "descuento": 0,
        "impuestos": [
          {
            "codigo": "2",
            "codigoPorcentaje": "2",
            "tarifa": 12.00,
            "baseImponible": 100.00,
            "valor": 12.00
          }
        ]
      }
    ],
    "pagos": [
      {
        "formaPago": "01",
        "total": 112.00
      }
    ]
  }'
```

---

## 9. Mantenimiento

### 9.1 Redeploy (actualizar código)

```bash
# En Dokploy: botón "Redeploy"
# O automático si configuras webhook de GitHub
```

Dokploy reconstruye la imagen y reinicia solo los contenedores que cambiaron. Los volúmenes con datos persistentes NO se pierden.

### 9.2 Backup de base de datos

```bash
# Backup manual
docker exec sri-postgres pg_dump -U postgres db_sri > backup_$(date +%Y%m%d).sql

# Restore
cat backup.sql | docker exec -i sri-postgres psql -U postgres -d db_sri
```

### 9.3 Ver logs

```bash
# En Dokploy: pestaña "Logs" del servicio
# O desde terminal:
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f postgres
docker compose -f docker-compose.prod.yml logs -f redis
docker compose -f docker-compose.prod.yml logs -f carbone
```

### 9.4 Monitorear certificados P12

```bash
curl -X POST https://api.tudominio.com/certificates/validate/0999999999001.p12 \
  -H "Authorization: Bearer <TOKEN>"
```

---

## 10. Solución de problemas

| Problema | Causa probable | Solución |
|----------|---------------|----------|
| `ECONNREFUSED` al conectar a BD | PostgreSQL no ha terminado de iniciar | Esperar, el compose espera 30s de `start_period` |
| Error `uuid_generate_v4()` no existe | Falta extensión uuid-ossp | Ya corregido en `database/init.sql` v2 |
| `No se encontró clave privada` | Certificado P12 inválido o password incorrecto | Verificar archivo P12 y password |
| `CORS: Origen no permitido` | `ALLOWED_ORIGINS` no incluye el dominio usado | Agregar el origen en variables de entorno |
| `401 Unauthorized` en Swagger | Token JWT expiró | Hacer login de nuevo |
| Carbone no genera PDF | Carbone server no responde | Verificar `docker compose logs carbone` |
| `JWT_SECRET must be 32+ chars` | JWT_SECRET muy corto | Generar uno nuevo con crypto.randomBytes |
| `SRI_TIMEOUT` en comprobantes | El SRI no respondió | El sistema lo marca como PENDIENTE y lo reintenta automáticamente con la sincronización |
| Error al hacer build en Dokploy | Falta memoria RAM en la VPS | Asignar al menos 2 GB de RAM para el build |
| Contenedor se reinicia en bucle | Error en variables de entorno | Revisar logs: `docker compose logs api` |

---

## Checklist de pre-producción

Antes de pasar a producción con el SRI real:

- [ ] Generar secrets nuevos (ENCRYPTION_KEY, JWT_SECRET, etc.)
- [ ] Cambiar contraseña del superadmin
- [ ] Configurar `SRI_ENVIRONMENT=production`
- [ ] Actualizar WSDLs a producción (cel.sri.gob.ec)
- [ ] Subir certificado P12 de producción
- [ ] Configurar firewalls (solo puerto 443 abierto)
- [ ] Hacer backup inicial de BD
- [ ] Probar emisión en ambiente de pruebas primero
- [ ] Configurar monitoreo de expiración de certificados P12
