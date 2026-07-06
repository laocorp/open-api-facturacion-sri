import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../../database';
import { CreateApiKeyDto, UpdateApiKeyDto, ApiKeyResponseDto } from './dto';

const SALT_ROUNDS = 10;
const KEY_PREFIX = 'sk_live';

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);

  constructor(private readonly db: DatabaseService) {}

  async findAll(tenantId: string): Promise<ApiKeyResponseDto[]> {
    const result = await this.db.query(
      `SELECT id, key_prefix, name, tier, is_active, last_used_at, created_at, updated_at
       FROM api_keys WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows.map(r => this.mapToResponse(r));
  }

  async findOne(id: string, tenantId: string): Promise<ApiKeyResponseDto> {
    const result = await this.db.query(
      `SELECT id, key_prefix, name, tier, is_active, last_used_at, created_at, updated_at
       FROM api_keys WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException('API Key no encontrada');
    }
    return this.mapToResponse(result.rows[0]);
  }

  async create(tenantId: string, dto: CreateApiKeyDto): Promise<ApiKeyResponseDto> {
    const rawKey = crypto.randomBytes(24).toString('hex'); // 48 hex chars
    const rawSecret = crypto.randomBytes(48).toString('hex'); // 96 hex chars
    const key = `${KEY_PREFIX}_${rawKey}`; // sk_live_<48hex>
    const keyPrefix = key.substring(0, 16); // sk_live_xxxxxxxx
    const keyHash = await bcrypt.hash(key, SALT_ROUNDS);

    const result = await this.db.query(
      `INSERT INTO api_keys (tenant_id, key_hash, key_prefix, name, tier)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, key_prefix, name, tier, is_active, last_used_at, created_at, updated_at`,
      [tenantId, keyHash, keyPrefix, dto.name, dto.tier || 'basic'],
    );

    this.logger.log(`API Key creada: ${keyPrefix} para tenant ${tenantId}`);

    return {
      ...this.mapToResponse(result.rows[0]),
      apiSecret: key,
    };
  }

  async update(id: string, tenantId: string, dto: UpdateApiKeyDto): Promise<ApiKeyResponseDto> {
    await this.findOne(id, tenantId);

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (dto.name !== undefined) { updates.push(`name = $${idx++}`); values.push(dto.name); }
    if (dto.tier !== undefined) { updates.push(`tier = $${idx++}`); values.push(dto.tier); }
    if (dto.isActive !== undefined) { updates.push(`is_active = $${idx++}`); values.push(dto.isActive === 'true'); }

    if (updates.length === 0) return this.findOne(id, tenantId);

    updates.push('updated_at = NOW()');
    values.push(id);

    await this.db.query(
      `UPDATE api_keys SET ${updates.join(', ')} WHERE id = $${idx}`,
      values,
    );

    return this.findOne(id, tenantId);
  }

  async deactivate(id: string, tenantId: string): Promise<ApiKeyResponseDto> {
    const key = await this.findOne(id, tenantId);
    if (!key.isActive) throw new BadRequestException('API Key ya está inactiva');

    await this.db.query(
      `UPDATE api_keys SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [id],
    );
    return this.findOne(id, tenantId);
  }

  async setTierForTenant(tenantId: string, tier: string): Promise<void> {
    await this.db.query(
      `UPDATE api_keys SET tier = $1, updated_at = NOW() WHERE tenant_id = $2 AND activo = true`,
      [tier, tenantId],
    );
    this.logger.log(`Tier actualizado para tenant ${tenantId}: ${tier}`);
  }

  async rotate(id: string, tenantId: string): Promise<ApiKeyResponseDto> {
    await this.findOne(id, tenantId);
    const rawKey = crypto.randomBytes(24).toString('hex');
    const key = `${KEY_PREFIX}_${rawKey}`;
    const keyHash = await bcrypt.hash(key, SALT_ROUNDS);
    const keyPrefix = key.substring(0, 16);

    await this.db.query(
      `UPDATE api_keys SET key_hash = $1, key_prefix = $2, updated_at = NOW() WHERE id = $3`,
      [keyHash, keyPrefix, id],
    );

    this.logger.log(`API Key rotada: ${keyPrefix} para tenant ${tenantId}`);

    const updated = await this.findOne(id, tenantId);
    return { ...updated, apiSecret: key };
  }

  async validate(rawKey: string): Promise<{ tenantId: string; tier: string } | null> {
    const keys = await this.db.query(
      `SELECT id, key_hash, tenant_id, tier, is_active FROM api_keys WHERE is_active = true`,
    );

    for (const row of keys.rows) {
      const match = await bcrypt.compare(rawKey, row.key_hash);
      if (match) {
        await this.db.query(
          `UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`,
          [row.id],
        );
        return { tenantId: row.tenant_id, tier: row.tier };
      }
    }
    return null;
  }

  private mapToResponse(row: any): ApiKeyResponseDto {
    return {
      id: row.id,
      keyPrefix: row.key_prefix,
      name: row.name,
      tier: row.tier,
      isActive: row.is_active,
      lastUsedAt: row.last_used_at?.toISOString(),
      createdAt: row.created_at?.toISOString(),
      updatedAt: row.updated_at?.toISOString(),
    };
  }
}
