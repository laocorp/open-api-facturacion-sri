# Guía de Despliegue — Open API Facturación SRI

## Stack completo (todo-en-uno en tu VPS)

```
┌─────────────────────────────────────────────────────┐
│                   VPS (Dokploy)                       │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │PostgreSQL│  │  Redis   │  │ Carbone  │            │
│  │  :5449   │  │  :6379   │  │  :3006   │            │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘            │
│       │              │              │                  │
│       └──────┬───────┴──────┬──────┘                  │
│              │              │                          │
│        ┌─────▼──────────────▼──────┐                   │
│        │     API NestJS :3005      │                   │
│        │  (JWT + BullMQ + XAdES)   │                   │
│        └────────────┬──────────────┘                   │
│                     │                                  │
│              ┌──────▼───────┐                          │
│              │  Nginx/Dokploy │ ← HTTPS :443            │
│              │   (SSL/TLS)   │                          │
│              └──────┬───────┘                          │
│                     │                                  │
│              sri.tudominio.com                          │
└─────────────────────────────────────────────────────┘
```

---

## 1. Requisitos

| Recurso | Tuyo |
|---|---|
| VPS | 20GB RAM, 12 vCores, 200GB+ SSD ✅ |
| Docker Engine | 24+ ✅ (Dokploy lo incluye) |
| Docker Compose | v2+ ✅ |
| Dokploy | Ya instalado ✅ |
| Dominio | Ej: `sri.tudominio.com` |
| Certificado P12 | Firma electrónica (Security Data / Bco. Central) |

---

## 2. Preparar el proyecto

```bash
# En tu máquina local o directo en el VPS via git
git clone https://github.com/laocorp/open-api-facturacion-sri.git
cd techost-api

# Instalar dependencias (solo si quieres probar local)
npm install
```

### 2.1 Parche de seguridad (xmldom)

Ya está corregido en el código fuente:
- `package.json`: `xmldom` → `@xmldom/xmldom`
- `xml-signer.service.ts`: import actualizado
- Esto elimina **5 vulnerabilidades HIGH** de XXE, DoS e injection XML.

---

## 3. Configurar variables de entorno

Edita `.env.production` y **REEMPLAZA TODOS LOS VALORES MARCADOS**:

```bash
# 1. Generar ENCRYPTION_KEY (32 bytes → 64 caracteres hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. Generar ENCRYPTION_SALT (16 bytes → 32 caracteres hex)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"

# 3. Generar JWT_SECRET (32+ bytes base64)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 4. Generar DB_PASSWORD y REDIS_PASSWORD seguras
node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"
```

Pega esos valores en `.env.production`:
- `ENCRYPTION_KEY=`
- `ENCRYPTION_SALT=`
- `JWT_SECRET=`
- `DB_PASSWORD=`
- `REDIS_PASSWORD=`

---

## 4. Desplegar con Dokploy

### Opción A: Dokploy (recomendado)

1. **Nuevo proyecto** → "facturacion-sri"
2. **Nuevo servicio** → Tipo: **Docker Compose**
3. **Source**: GitHub (tu fork) o sube los archivos manualmente
4. **Archivos necesarios**:
   - `docker-compose.prod.yml`
   - `Dockerfile`
   - `.env.production`
   - `database/init.sql`
   - `src/` (todo el código fuente)
   - `package.json`
   - `tsconfig.json`
   - `nest-cli.json`
   - `tsconfig.build.json`
5. **Variables de entorno**: Dokploy puede leer `.env.production` o puedes configurarlas en el panel
6. **Puertos**: El compose expone `3005:3001` (API), `5449:5432` (PostgreSQL), `3006:3000` (Carbone)
7. **Dominio**: Configura `sri.tudominio.com` → puerto `3001`
8. **SSL**: Dokploy genera Let's Encrypt automático
9. **Deploy**: Click en "Deploy"

### Opción B: Docker Compose manual en el VPS

```bash
# En tu VPS:
mkdir -p /opt/facturacion-sri
cd /opt/facturacion-sri

# Copia todos los archivos del proyecto aquí
# Asegúrate de tener:
#   - docker-compose.prod.yml
#   - Dockerfile
#   - .env.production
#   - database/init.sql
#   - src/, package.json, tsconfig.json, nest-cli.json, tsconfig.build.json

# Construir y levantar
docker compose -f docker-compose.prod.yml up -d --build

# Ver logs
docker compose -f docker-compose.prod.yml logs -f

# Ver estado
docker compose -f docker-compose.prod.yml ps
```

---

## 5. Verificar que todo funciona

```bash
# 1. Health check de la API
curl http://localhost:3001/status

# 2. Swagger UI
# Abre en navegador: https://sri.tudominio.com/api

# 3. Login como superadmin
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "superadmin@openapi-sri.com", "password": "Admin123!"}'

# 4. ⚠️ CAMBIAR CONTRASEÑA DEL SUPERADMIN INMEDIATAMENTE
curl -X PATCH http://localhost:3001/auth/change-password \
  -H "Authorization: Bearer <TOKEN_DEL_LOGIN>" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword": "Admin123!", "newPassword": "TuPassSegura2026!"}'
```

---

## 6. Post-Deploy: Hardening

### 6.1 Firewall (solo exponer lo necesario)

```bash
# En tu VPS:
# Solo necesitas puerto 443 (HTTPS) abierto al mundo
# PostgreSQL :5449 solo debe ser accesible internamente
# Carbone :3006 solo interno
# Redis :6379 solo interno
```

Dokploy + Docker already handles this — los servicios se comunican por la red interna de Docker.

### 6.2 Backups automáticos

Agrega un cron job en tu VPS:

```bash
# Backup diario de PostgreSQL a las 3 AM
crontab -e

0 3 * * * docker exec sri-postgres pg_dump -U postgres db_sri | gzip > /backups/sri/db_$(date +\%Y\%m\%d).sql.gz
0 4 * * * find /backups/sri -name "*.sql.gz" -mtime +30 -delete

# Backup semanal de archivos
0 5 * * 0 tar -czf /backups/sri/files_$(date +\%Y\%m\%d).tar.gz \
  -C /var/lib/docker/volumes $(docker volume ls --format '{{.Name}}' | grep sri | tr '\n' ' ')
```

### 6.3 Monitorear expiración de certificados P12

La API expone certificados con fecha de expiración. Monitorea vía:
```bash
curl -X POST http://localhost:3001/certificates/validate/mi-certificado.p12 \
  -H "Authorization: Bearer <TOKEN>"
```

### 6.4 Logs

```bash
# Ver logs en tiempo real
docker compose -f docker-compose.prod.yml logs -f api

# Logs de los últimos 30 minutos
docker compose -f docker-compose.prod.yml logs --since=30m api
```

---

## 7. Certificación SRI

```
Fase 1 — PRUEBAS (SRI_ENVIRONMENT=development)
  [ ] 1. Crear un tenant (empresa cliente)
  [ ] 2. Crear usuario ADMIN para ese tenant
  [ ] 3. Registrar emisor con RUC de pruebas
  [ ] 4. Subir certificado P12 de pruebas
  [ ] 5. Configurar establecimiento (001) y punto de emisión (001)
  [ ] 6. Emitir factura de prueba → POST /sri/factura/emitir
  [ ] 7. Verificar que el SRI autorice (estado = AUTORIZADO)
  [ ] 8. Verificar que se genere el RIDE (PDF)
  [ ] 9. Verificar webhook (si configurado)

Fase 2 — PRODUCCIÓN
  [ ] 1. Solicitar ambiente de producción al SRI
  [ ] 2. Obtener certificado P12 de producción
  [ ] 3. Cambiar SRI_ENVIRONMENT=production
  [ ] 4. Actualizar WSDLs a producción (cel.sri.gob.ec)
  [ ] 5. Emitir comprobante real de producción
```

---

## 8. Resolución de problemas

| Problema | Causa probable | Solución |
|---|---|---|
| `ECONNREFUSED` al conectar a BD | PostgreSQL no ha terminado de iniciar | Esperar, tiene `start_period: 30s` |
| `No se encontró clave privada` | Certificado P12 inválido o password incorrecto | Verificar el archivo P12 y password |
| `CORS: Origen no permitido` | ALLOWED_ORIGINS no incluye el dominio | Agregar el origen en `.env.production` |
| `401 Unauthorized` en Swagger | Token JWT expiró | Hacer login de nuevo |
| Carbone no genera PDF | Carbone server no responde | Verificar `docker compose logs carbone` |
| `JWT_SECRET must be 32+ chars` | JWT_SECRET muy corto | Generar uno nuevo con crypto.randomBytes |

---

## 9. Comandos útiles

```bash
# Ver estado de todos los servicios
docker compose -f docker-compose.prod.yml ps

# Ver logs de un servicio específico
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f postgres
docker compose -f docker-compose.prod.yml logs -f redis
docker compose -f docker-compose.prod.yml logs -f carbone

# Detener servicios
docker compose -f docker-compose.prod.yml down

# Detener y limpiar volúmenes (BORRA DATOS)
docker compose -f docker-compose.prod.yml down -v

# Reconstruir y reiniciar
docker compose -f docker-compose.prod.yml up -d --build

# Entrar al contenedor de PostgreSQL
docker exec -it sri-postgres psql -U postgres -d db_sri

# Backup manual de BD
docker exec sri-postgres pg_dump -U postgres db_sri > backup_$(date +%Y%m%d).sql

# Restore BD
cat backup.sql | docker exec -i sri-postgres psql -U postgres -d db_sri
```
