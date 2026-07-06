import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database';

export interface UsageEntry {
  tenantId: string;
  apiKeyId?: string;
  endpoint: string;
  method: string;
  comprobanteType?: string;
  claveAcceso?: string;
  statusCode: number;
  estado?: string;
  responseTimeMs?: number;
  ipAddress?: string;
  userAgent?: string;
}

export interface UsageQuery {
  tenantId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(private readonly db: DatabaseService) {}

  async log(entry: UsageEntry): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO usage_logs
         (tenant_id, api_key_id, endpoint, method, comprobante_type,
          clave_acceso, status_code, estado, response_time_ms,
          ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          entry.tenantId,
          entry.apiKeyId || null,
          entry.endpoint,
          entry.method,
          entry.comprobanteType || null,
          entry.claveAcceso || null,
          entry.statusCode,
          entry.estado || null,
          entry.responseTimeMs || null,
          entry.ipAddress || null,
          entry.userAgent || null,
        ],
      );
    } catch (error) {
      this.logger.error(`Error al registrar usage: ${(error as Error).message}`);
    }
  }

  async search(query: UsageQuery) {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (query.tenantId) {
      conditions.push(`tenant_id = $${idx++}`);
      params.push(query.tenantId);
    }
    if (query.from) {
      conditions.push(`created_at >= $${idx++}`);
      params.push(query.from);
    }
    if (query.to) {
      conditions.push(`created_at <= $${idx++}`);
      params.push(query.to);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const page = query.page || 1;
    const limit = Math.min(query.limit || 50, 100);
    const offset = (page - 1) * limit;

    const [countResult, dataResult] = await Promise.all([
      this.db.query(`SELECT COUNT(*) FROM usage_logs ${where}`, params),
      this.db.query(
        `SELECT * FROM usage_logs ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, limit, offset],
      ),
    ]);

    return {
      data: dataResult.rows,
      total: parseInt(countResult.rows[0].count, 10),
      page,
      totalPages: Math.ceil(parseInt(countResult.rows[0].count, 10) / limit),
    };
  }

  async summary(query: { tenantId?: string; from?: string; to?: string }) {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (query.tenantId) {
      conditions.push(`tenant_id = $${idx++}`);
      params.push(query.tenantId);
    }
    if (query.from) {
      conditions.push(`created_at >= $${idx++}`);
      params.push(query.from);
    }
    if (query.to) {
      conditions.push(`created_at <= $${idx++}`);
      params.push(query.to);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [totalResult, byEndpoint, byDay] = await Promise.all([
      this.db.query(
        `SELECT COUNT(*) as total, SUM(response_time_ms) as total_ms, AVG(response_time_ms) as avg_ms
         FROM usage_logs ${where}`,
        params,
      ),
      this.db.query(
        `SELECT endpoint, method, COUNT(*) as count, AVG(response_time_ms) as avg_ms
         FROM usage_logs ${where}
         GROUP BY endpoint, method ORDER BY count DESC`,
        params,
      ),
      this.db.query(
        `SELECT DATE(created_at) as day, COUNT(*) as count
         FROM usage_logs ${where}
         GROUP BY DATE(created_at) ORDER BY day DESC LIMIT 30`,
        params,
      ),
    ]);

    return {
      total: parseInt(totalResult.rows[0]?.total || '0', 10),
      totalMs: parseInt(totalResult.rows[0]?.total_ms || '0', 10),
      avgMs: Math.round(parseFloat(totalResult.rows[0]?.avg_ms || '0')),
      byEndpoint: byEndpoint.rows,
      byDay: byDay.rows,
    };
  }
}
