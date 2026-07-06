import { Controller, Get, Query, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/decorators/public.decorator';

@Controller('pay')
export class PayController {
  private readonly logger = new Logger(PayController.name);

  constructor(private readonly configService: ConfigService) {}

  @Get()
  @Public()
  async paymentPage(
    @Query('clientTxId') clientTxId: string,
    @Query('amount') amount: string,
    @Query('tenantId') tenantId: string,
    @Query('label') label: string,
  ) {
    const token = this.configService.get<string>('payphone.token', '');
    const storeId = this.configService.get<string>('payphone.storeId', '');

    if (!clientTxId || !amount) {
      return this.htmlError('Enlace inválido. Parámetros de pago faltantes.');
    }

    return this.htmlPage({
      token,
      storeId,
      clientTxId,
      amount: Number(amount),
      label: label || 'Bundle',
    });
  }

  private htmlPage(data: { token: string; storeId: string; clientTxId: string; amount: number; label: string }): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Recarga de saldo — Techost SRI</title>
<link rel="stylesheet" href="https://cdn.payphonetodoesposible.com/box/v2.0/payphone-payment-box.css">
<script type="module" src="https://cdn.payphonetodoesposible.com/box/v2.0/payphone-payment-box.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8f9fa;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{background:#fff;border-radius:12px;padding:2.5rem;box-shadow:0 2px 12px rgba(0,0,0,.08);max-width:460px;width:100%;text-align:center}
.logo{font-size:1.4rem;font-weight:700;color:#0f1b33;margin-bottom:.3rem}
.sub{color:#888;font-size:.85rem;margin-bottom:1.5rem}
h2{font-size:1.1rem;color:#1a1a2e;margin-bottom:.5rem}
.price{font-size:2rem;font-weight:700;color:#0f1b33;margin-bottom:1.5rem}
.error-box{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;padding:1rem;border-radius:8px;margin-bottom:1rem;font-size:.9rem}
</style>
</head>
<body>
<div class="card">
  <div class="logo">Techost SRI</div>
  <div class="sub">API de facturación electrónica</div>
  <h2>Recarga de saldo</h2>
  <div class="price">$${(data.amount / 100).toFixed(2)}</div>
  <div id="pp-button"></div>
</div>
<script>
  window.addEventListener('DOMContentLoaded',()=>{
    new PPaymentButtonBox({
      token:'${data.token}',
      clientTransactionId:'${data.clientTxId}',
      amount:${data.amount},
      amountWithoutTax:${data.amount},
      currency:'USD',
      storeId:'${data.storeId}',
      reference:'${data.label}',
      lang:'es',
      defaultMethod:'card',
      timeZone:-5,
    }).render('pp-button');
  });
</script>
</body>
</html>`;
  }

  private htmlError(msg: string): string {
    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Error — Techost SRI</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8f9fa;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{background:#fff;border-radius:12px;padding:2.5rem;box-shadow:0 2px 12px rgba(0,0,0,.08);max-width:460px;width:100%;text-align:center}
.error{color:#b91c1c;font-size:1rem;margin-bottom:1rem}
</style>
</head>
<body><div class="card"><div class="error">${msg}</div></div></body>
</html>`;
  }
}
