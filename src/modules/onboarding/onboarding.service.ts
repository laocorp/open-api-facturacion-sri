import { Injectable, Logger, ConflictException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { DatabaseService } from '../../database';
import type { PoolClient } from 'pg';

const SALT_ROUNDS = 10;
const KEY_PREFIX = 'sk_live';
const TIPOS_COMPROBANTE = ['01', '04', '05', '06', '07'];

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(private readonly db: DatabaseService) {}

  async onboard(dto: {
    email: string;
    password: string;
    ruc: string;
    razonSocial: string;
    direccionMatriz: string;
    tenantName: string;
    nombreComercial?: string;
  }) {
    if (!/^\d{13}$/.test(dto.ruc)) {
      throw new BadRequestException('RUC debe tener 13 dígitos');
    }

    return this.db.transaction(async (client) => {
      const tenant = await this.createTenant(client, dto.tenantName);
      const user = await this.createUser(client, tenant.id, dto.email, dto.password);
      const emisor = await this.createEmisor(client, tenant.id, dto.ruc, dto.razonSocial, dto.direccionMatriz, dto.nombreComercial);
      const establecimiento = await this.createEstablecimiento(client, emisor.id, dto.direccionMatriz);
      const puntoEmision = await this.createPuntoEmision(client, establecimiento.id);
      await this.createSecuenciales(client, puntoEmision.id);
      const { key, keyPrefix } = await this.createApiKey(client, tenant.id, dto.razonSocial);

      this.logger.log(`Onboarding: ${dto.email} / RUC ${dto.ruc}`);
      return { tenant, user, emisor, apiKey: keyPrefix, apiSecret: key };
    });
  }

  private async createTenant(client: PoolClient, nombre: string) {
    const r = await client.query(
      `INSERT INTO tenants (nombre) VALUES ($1) RETURNING id, nombre`,
      [nombre],
    );
    return r.rows[0];
  }

  private async createUser(client: PoolClient, tenantId: string, email: string, password: string) {
    const exist = await client.query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (exist.rows.length > 0) throw new ConflictException('Email ya registrado');

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const r = await client.query(
      `INSERT INTO usuarios (email, password_hash, rol, tenant_id, activo)
       VALUES ($1, $2, 'ADMIN', $3, true) RETURNING id, email`,
      [email, hash, tenantId],
    );
    return r.rows[0];
  }

  private async createEmisor(client: PoolClient, tenantId: string, ruc: string, razonSocial: string, direccion: string, nombreComercial?: string) {
    const exist = await client.query('SELECT id FROM emisores WHERE ruc = $1', [ruc]);
    if (exist.rows.length > 0) throw new ConflictException('RUC ya registrado');

    const r = await client.query(
      `INSERT INTO emisores (tenant_id, ruc, razon_social, nombre_comercial, direccion_matriz, ambiente, estado)
       VALUES ($1, $2, $3, $4, $5, '2', 'ACTIVO') RETURNING id, ruc, razon_social`,
      [tenantId, ruc, razonSocial, nombreComercial || null, direccion],
    );
    return r.rows[0];
  }

  private async createEstablecimiento(client: PoolClient, emisorId: string, direccion: string) {
    const r = await client.query(
      `INSERT INTO establecimientos (emisor_id, codigo, direccion) VALUES ($1, '001', $2) RETURNING id`,
      [emisorId, direccion],
    );
    return r.rows[0];
  }

  private async createPuntoEmision(client: PoolClient, establecimientoId: string) {
    const r = await client.query(
      `INSERT INTO puntos_emision (establecimiento_id, codigo, descripcion) VALUES ($1, '001', 'Principal') RETURNING id`,
      [establecimientoId],
    );
    return r.rows[0];
  }

  private async createSecuenciales(client: PoolClient, puntoEmisionId: string) {
    for (const tipo of TIPOS_COMPROBANTE) {
      await client.query(
        `INSERT INTO secuenciales (punto_emision_id, tipo_comprobante, ultimo_secuencial) VALUES ($1, $2, 0)`,
        [puntoEmisionId, tipo],
      );
    }
  }

  private async createApiKey(client: PoolClient, tenantId: string, name: string) {
    const rawKey = crypto.randomBytes(24).toString('hex');
    const key = `${KEY_PREFIX}_${rawKey}`;
    const keyHash = await bcrypt.hash(key, SALT_ROUNDS);

    await client.query(
      `INSERT INTO api_keys (tenant_id, key_hash, key_prefix, name, tier) VALUES ($1, $2, $3, $4, 'basic')`,
      [tenantId, keyHash, key.substring(0, 16), name],
    );
    return { key, keyPrefix: key.substring(0, 16) };
  }
}
