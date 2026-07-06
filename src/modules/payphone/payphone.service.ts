import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { ApiKeysService } from '../api-keys/api-keys.service';
import type { ApiKeyTier } from '../api-keys/dto/api-key.dto';

interface PayphoneSaleResponse {
  id: number;
  url: string;
  clientTransactionId?: string;
}

interface PayphoneConfirmResponse {
  status: string;
  [key: string]: unknown;
}

const TIER_PRICES: Record<string, number> = {
  basic: 0,
  professional: 2990,   // $29.90
  enterprise: 9990,     // $99.90
  unlimited: 0,         // cotizar
};

const TIER_NAMES: Record<string, string> = {
  basic: 'Plan Basic',
  professional: 'Plan Professional',
  enterprise: 'Plan Enterprise',
  unlimited: 'Plan Unlimited',
};

@Injectable()
export class PayphoneService {
  private readonly logger = new Logger(PayphoneService.name);
  private readonly apiUrl: string;
  private readonly token: string;
  private readonly storeId: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly db: DatabaseService,
    private readonly apiKeysService: ApiKeysService,
  ) {
    this.apiUrl = this.configService.get<string>('payphone.apiUrl', 'https://api.payphone.app');
    this.token = this.configService.get<string>('payphone.token', '');
    this.storeId = this.configService.get<number>('payphone.storeId', 0);
  }

  async initCharge(tier: ApiKeyTier, tenantId: string, successUrl?: string): Promise<{ payphoneId: number; url: string; clientTransactionId: string }> {
    const amount = TIER_PRICES[tier];
    if (amount <= 0) throw new HttpException('Este tier no requiere pago o debe solicitar cotización', HttpStatus.BAD_REQUEST);

    const clientTransactionId = this.generateClientTxId();
    const tax = Math.round(amount * 0.15 / 1.15);
    const amountWithTax = amount - tax;

    const body = {
      amount,
      amountWithTax,
      tax,
      currency: 'USD',
      clientTransactionId,
      storeId: this.storeId,
      reference: `tier:${tier}|tenant:${tenantId}`,
    };

    this.logger.log(`Payphone charge: ${JSON.stringify(body)}`);

    const res = await this.callPayphone<PayphoneSaleResponse>('/api/v2/sale', body);

    await this.db.query(
      `INSERT INTO pending_payments (client_tx_id, tenant_id, tier, amount, payphone_sale_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [clientTransactionId, tenantId, tier, amount, res.id],
    );

    return {
      payphoneId: res.id,
      url: res.url,
      clientTransactionId,
    };
  }

  async handleWebhook(payload: Record<string, unknown>): Promise<{ Response: boolean; ErrorCode: string }> {
    const saleId = payload.id_sale ?? payload.id_venta;
    const clientTxId = (payload.clientTransactionId || payload.client_transaction_id) as string | undefined;

    this.logger.log(`Payphone webhook: sale=${saleId}, clientTxId=${clientTxId}, estado=${payload.estado}`);

    if (!clientTxId) {
      this.logger.warn('Webhook sin clientTransactionId');
      return { Response: false, ErrorCode: '001' };
    }

    const { rows } = await this.db.query(
      `SELECT id, tenant_id, tier, status FROM pending_payments WHERE client_tx_id = $1`,
      [clientTxId],
    );

    if (rows.length === 0) {
      this.logger.warn(`Webhook: pending_payment not found for ${clientTxId}`);
      return { Response: false, ErrorCode: '002' };
    }

    const payment = rows[0];

    if (payment.status === 'completed') {
      return { Response: true, ErrorCode: '' };
    }

    try {
      const confirm = await this.callPayphone<PayphoneConfirmResponse>(`/api/v2/sale/${saleId}/confirm`, {});

      if (confirm.status === 'approved' || payload.estado === 'approved') {
        await this.db.query(
          `UPDATE pending_payments SET status = 'completed', confirmed_at = NOW() WHERE id = $1`,
          [payment.id],
        );

        await this.apiKeysService.setTierForTenant(payment.tenant_id, payment.tier);

        this.logger.log(`Tier upgraded: tenant=${payment.tenant_id}, tier=${payment.tier}`);
        return { Response: true, ErrorCode: '' };
      }

      await this.db.query(
        `UPDATE pending_payments SET status = 'failed' WHERE id = $1`,
        [payment.id],
      );

      return { Response: true, ErrorCode: '' };
    } catch (err) {
      this.logger.error(`Webhook processing error: ${(err as Error).message}`);
      return { Response: false, ErrorCode: '003' };
    }
  }

  async getTierPrice(tier: ApiKeyTier): Promise<{ tier: string; amount: number; amountFormatted: string }> {
    return {
      tier,
      amount: TIER_PRICES[tier] || 0,
      amountFormatted: `$${((TIER_PRICES[tier] || 0) / 100).toFixed(2)}`,
    };
  }

  async listPrices(): Promise<Array<{ tier: string; amount: number; amountFormatted: string; name: string }>> {
    return Object.entries(TIER_PRICES).map(([tier, amount]) => ({
      tier,
      amount,
      amountFormatted: amount > 0 ? `$${(amount / 100).toFixed(2)}` : (tier === 'unlimited' ? 'Cotizar' : 'Gratis'),
      name: TIER_NAMES[tier] || tier,
    }));
  }

  private async callPayphone<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const url = `${this.apiUrl}${path}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Payphone API error ${res.status}: ${text}`);
      throw new HttpException(`Payphone error: ${res.statusText}`, HttpStatus.BAD_GATEWAY);
    }

    return res.json() as Promise<T>;
  }

  private generateClientTxId(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${ts}${rand}`.substring(0, 12);
  }
}
