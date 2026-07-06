import { Controller, Post, Get, Body, Param, Query, Res, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { PayphoneService } from './payphone.service';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/dto/auth.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';

@ApiTags('Payphone - Pagos')
@Controller()
export class PayphoneController {
  private readonly logger = new Logger(PayphoneController.name);

  constructor(private readonly payphoneService: PayphoneService) {}

  @Get('pay/confirm')
  @Public()
  @ApiExcludeEndpoint()
  async payConfirm(
    @Query('id') id: string,
    @Query('clientTransactionId') clientTransactionId: string,
    @Res() res: Response,
  ) {
    if (!id || !clientTransactionId) {
      return res.redirect('/payment/failed.html');
    }
    const result = await this.payphoneService.confirmPayment(Number(id), clientTransactionId);
    if (result.approved) {
      return res.redirect('/payment/success.html');
    }
    return res.redirect('/payment/failed.html');
  }

  @Get('payphone/bundles')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Listar bundles de recarga disponibles' })
  async bundles() {
    return this.payphoneService.listBundles();
  }

  @Post('payphone/buy-bundle')
  @ApiBearerAuth('JWT')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Comprar bundle de saldo' })
  async buyBundle(
    @Body() dto: { tenantId: string; bundleCents: number },
  ) {
    return this.payphoneService.buyBundle(dto.tenantId, dto.bundleCents);
  }

  @Get('payphone/balance/:tenantId')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Consultar saldo del tenant' })
  async balance(@Param('tenantId') tenantId: string) {
    return this.payphoneService.getBalance(tenantId);
  }
}
