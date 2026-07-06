import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { existsSync } from 'fs';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { STORAGE_PATHS } from './common/utils/storage-paths';

/**
 * Detect which environment file is being used
 */
function detectEnvFile(): string {
  if (existsSync('.env.development')) return '.env.development';
  if (existsSync('.env.dev')) return '.env.dev';
  if (existsSync('.env')) return '.env';
  return 'variables de sistema';
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // ===== SEGURIDAD: HTTP Headers (Helmet) =====
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false, // Necesario para Swagger UI
      contentSecurityPolicy: false, // Configurar por entorno si se requiere
    }),
  );

  // ===== SEGURIDAD: CORS restringido =====
  const allowedOriginsStr = configService.get<string>(
    'cors.allowedOrigins',
    'http://localhost:3000,http://localhost:3001',
  );
  const allowedOrigins = allowedOriginsStr.split(',').map((o) => o.trim());

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (Postman, curl, apps móviles nativas)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: Origen no permitido: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
    credentials: true,
  });

  // ===== VALIDACIÓN GLOBAL =====
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // ===== FILTRO DE EXCEPCIONES GLOBAL =====
  app.useGlobalFilters(new AllExceptionsFilter());

  // ===== SWAGGER — Open API Facturación SRI =====
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Open API Facturación SRI')
    .setDescription(
      `## API Enterprise de Facturación Electrónica para el SRI Ecuador

**Multi-tenant** | **XAdES-BES** | **SOAP SRI** | **Webhooks** | **JWT + API Key Auth**

📚 [Documentación completa →](/docs)

### 🔐 Autenticación
Dos formas de autenticación:
- **API Key** (emisión SRI): Header \`X-Api-Key: sk_live_...\`
- **JWT** (administración): \`POST /auth/login\` → \`Authorization: Bearer <token>\`

### 🌐 Ambientes SRI
- **Pruebas:** \`"ambiente": "1"\`
- **Producción:** \`"ambiente": "2"\`

### 🚀 Inicio rápido
\`\`\`bash
# 1. Regístrate
curl -X POST https://api.techost.cloud/onboarding \\
  -H "Content-Type: application/json" \\
  -d '{"email":"user@ejemplo.com","password":"pass1234","ruc":"1950370393001","razonSocial":"Mi Empresa S.A.","direccionMatriz":"Av. Principal 123","tenantName":"mi-empresa"}'

# 2. Emite tu primera factura
curl -X POST https://api.techost.cloud/sri/emitir/factura \\
  -H "X-Api-Key: sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{...}'
\`\`\``,
    )
    .setVersion('2.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token JWT obtenido en POST /auth/login',
      },
      'JWT',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-Api-Key',
        description: 'API Key para endpoints de emisión. Ej: sk_live_...',
      },
      'X-Api-Key',
    )
    .addTag('Auth - Autenticación', 'Login, registro y gestión de usuarios')
    .addTag('Status', 'Estado del servidor y health checks')
    .addTag(
      'SRI - Facturación Electrónica',
      'Emisión y gestión de comprobantes electrónicos (Facturas, NC, ND, Retenciones, Guías)',
    )
    .addTag('Emisores', 'Gestión de empresas emisoras de documentos')
    .addTag(
      'Emisores - Puntos de Emisión',
      'Gestión de puntos de emisión (cajas/sucursales)',
    )
    .addTag(
      'Emisores - Secuenciales',
      'Gestión de secuenciales de comprobantes',
    )
    .addTag(
      'Tenants',
      'Gestión de inquilinos/clientes del sistema multi-tenant',
    )
    .addTag('Certificates', 'Gestión de certificados digitales P12')
    .addTag('Webhooks', 'Configuración de notificaciones por eventos')
    .addTag('Generate PDF', 'Generación de PDFs con Carbone.io')
    .addTag('Documents', 'Generación de documentos multi-formato')
    .addTag('Templates', 'Gestión de plantillas de documentos')
    .addTag('Signature', 'Firma digital de PDFs')
    .addTag('Images', 'Gestión de imágenes')
    .addTag('Onboarding', 'Registro completo: tenant + usuario + emisor + API Key')
    .addTag('Admin', 'Tareas administrativas (solo SUPERADMIN)')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // Mantiene el token JWT entre recargas del Swagger UI
    },
  });

  // ===== INICIALIZAR DIRECTORIOS =====
  const templatesDir = STORAGE_PATHS.templates;
  const pdfDir = STORAGE_PATHS.pdfs;
  const certsDir = STORAGE_PATHS.certs;
  void STORAGE_PATHS.pdfsConFirma;
  void STORAGE_PATHS.pdfsOthers;
  void STORAGE_PATHS.pdfsDocuments;
  void STORAGE_PATHS.pdfsImages;

  // ===== ARRANQUE =====
  const nodeEnv = configService.get<string>('nodeEnv') || 'development';
  const envFile = detectEnvFile();
  const port = configService.get<number>('port')!;
  const publicUrl = configService.get<string>('publicUrl')!;
  const dbHost = configService.get<string>('database.host') || 'No configurado';
  const dbName = configService.get<string>('database.name') || 'No configurado';

  // ===== GRACEFUL SHUTDOWN =====
  // Permite que NestJS ejecute los hooks OnModuleDestroy (cierra pool DB, etc.)
  // al recibir SIGTERM/SIGINT (Docker stop, Kubernetes pod termination)
  app.enableShutdownHooks();

  await app.listen(port);

  logger.log(`
=======================================================
  Open API Facturación SRI — Facturación Electrónica Ecuador
=======================================================
  Entorno:    ${nodeEnv.toUpperCase()}
  Env File:   ${envFile}
-------------------------------------------------------
  Servidor:   http://localhost:${port}
  URL Pública:${publicUrl}
  Swagger:    http://localhost:${port}/api
-------------------------------------------------------
  Base de Datos: ${dbHost} / ${dbName}
  Certificados:  ${certsDir}
  Templates:     ${templatesDir}
  PDFs:          ${pdfDir}
=======================================================
`);
}
void bootstrap();
