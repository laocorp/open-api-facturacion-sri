import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';

const COMPROBANTE_PRICE_CENTS = 5;

const BUNDLES = [
  { label: 'Básico $10', cents: 1000, bonus: 0 },
  { label: 'Popular $25', cents: 2500, bonus: 250 },
  { label: 'Pro $50', cents: 5000, bonus: 750 },
  { label: 'Business $100', cents: 10000, bonus: 2000 },
];

interface PayphoneSaleResponse {
  id: number;
  url: string;
  clientTransactionId?: string;
}

@Injectable()
export class PayphoneService {
  private readonly logger = new Logger(PayphoneService.name);
  private readonly apiUrl: string;
  private readonly token: string;
  private readonly storeId: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly db: DatabaseService,
  ) {
    this.apiUrl = this.configService.get<string>('payphone.apiUrl', 'https://api.payphone.app');
    this.token = this.configService.get<string>('payphone.token', '');
    this.storeId = this.configService.get<number>('payphone.storeId', 0);
  }

  async getBalance(tenantId: string): Promise<{ balanceCents: number; comprobantesDisponibles: number }> {
    const { rows } = await this.db.query(
      `SELECT balance_cents FROM tenant_balances WHERE tenant_id = $1`,
      [tenantId],
    );
    const balanceCents = rows.length > 0 ? rows[0].balance_cents : 0;
    return {
      balanceCents,
      comprobantesDisponibles: Math.floor(balanceCents / COMPROBANTE_PRICE_CENTS),
    };
  }

  async listBundles() {
    return BUNDLES.map((b) => ({
      ...b,
      comprobantes: Math.floor((b.cents + b.bonus) / COMPROBANTE_PRICE_CENTS),
    }));
  }

  async buyBundle(tenantId: string, bundleCents: number, successUrl?: string) {
    const bundle = BUNDLES.find((b) => b.cents === bundleCents);
    if (!bundle) throw new HttpException('Bundle no válido', HttpStatus.BAD_REQUEST);

    const clientTransactionId = this.generateClientTxId();
    const totalCents = bundle.cents + bundle.bonus;
    const tax = Math.round(bundle.cents * 0.15 / 1.15);
    const amountWithTax = bundle.cents - tax;

    const body = {
      amount: bundle.cents,
      amountWithTax,
      tax,
      currency: 'USD',
      clientTransactionId,
      storeId: this.storeId,
      reference: `bundle:${bundle.cents}|tenant:${tenantId}`,
    };

    const res = await this.callPayphone<PayphoneSaleResponse>('/api/v2/sale', body);

    await this.db.query(
      `INSERT INTO pending_payments (client_tx_id, tenant_id, amount, payphone_sale_id, tier)
       VALUES ($1, $2, $3, $4, 'bundle')`,
      [clientTransactionId, tenantId, totalCents, res.id],
    );

    return { payphoneId: res.id, url: res.url, clientTransactionId };
  }

  async handleWebhook(payload: Record<string, unknown>) {
    const saleId = payload.id_sale ?? payload.id_venta;
    const clientTxId = (payload.clientTransactionId || payload.client_transaction_id) as string | undefined;

    if (!clientTxId) return { Response: false, ErrorCode: '001' };

    const { rows } = await this.db.query(
      `SELECT id, tenant_id, amount, status FROM pending_payments WHERE client_tx_id = $1`,
      [clientTxId],
    );
    if (rows.length === 0) return { Response: false, ErrorCode: '002' };

    const payment = rows[0];
    if (payment.status === 'completed') return { Response: true, ErrorCode: '' };

    try {
      const confirm = await this.callPayphone<{ status: string }>(`/api/v2/sale/${saleId}/confirm`, {});
      const approved = confirm.status === 'approved' || payload.estado === 'approved';

      await this.db.query(
        `UPDATE pending_payments SET status = $1, confirmed_at = NOW() WHERE id = $2`,
        [approved ? 'completed' : 'failed', payment.id],
      );

      if (approved) {
        await this.db.query(
          `INSERT INTO tenant_balances (tenant_id, balance_cents)
           VALUES ($1, $2)
           ON CONFLICT (tenant_id) DO UPDATE SET balance_cents = tenant_balances.balance_cents + $2, updated_at = NOW()`,
          [payment.tenant_id, payment.amount],
        );
        await this.db.query(
          `INSERT INTO credit_transactions (tenant_id, amount_cents, type, reference)
           VALUES ($1, $2, 'topup', $3)`,
          [payment.tenant_id, payment.amount, `payphone:${saleId}`],
        );
        this.logger.log(`Balance +${payment.amount}¢ for tenant ${payment.tenant_id}`);
      }
      return { Response: true, ErrorCode: '' };
    } catch (err) {
      this.logger.error(`Webhook error: ${(err as Error).message}`);
      return { Response: false, ErrorCode: '003' };
    }
  }

  async deductBalance(tenantId: string, comprobanteId: string, reason?: string) {
    const { rows } = await this.db.query(
      `UPDATE tenant_balances
       SET balance_cents = balance_cents - $1, updated_at = NOW()
       WHERE tenant_id = $2 AND balance_cents >= $1
       RETURNING balance_cents`,
      [COMPROBANTE_PRICE_CENTS, tenantId],
    );
    if (rows.length === 0) {
      throw new HttpException('Saldo insuficiente. Recarga en /payphone/bundles', HttpStatus.PAYMENT_REQUIRED);
    }
    await this.db.query(
      `INSERT INTO credit_transactions (tenant_id, amount_cents, type, reference, comprobante_id)
       VALUES ($1, $2, 'deduction', $3, $4)`,
      [tenantId, -COMPROBANTE_PRICE_CENTS, reason || 'emision', comprobanteId],
    );
  }

  private async callPayphone<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${this.apiUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new HttpException(`Payphone error: ${res.status} ${text}`, HttpStatus.BAD_GATEWAY);
    }
    return res.json() as Promise<T>;
  }

  private generateClientTxId(): string {
    return `${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`.substring(0, 12);
  }
}
