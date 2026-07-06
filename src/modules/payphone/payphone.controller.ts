import { Controller, Post, Get, Body, Param, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { PayphoneService } from './payphone.service';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/dto/auth.dto';
import { ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Payphone - Pagos')
@Controller('payphone')
export class PayphoneController {
  private readonly logger = new Logger(PayphoneController.name);

  constructor(private readonly payphoneService: PayphoneService) {}

  @Get('bundles')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Listar bundles de recarga disponibles' })
  async bundles() {
    return this.payphoneService.listBundles();
  }

  @Post('buy-bundle')
  @ApiBearerAuth('JWT')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Comprar bundle de saldo vía Payphone' })
  async buyBundle(
    @Body() dto: { tenantId: string; bundleCents: number; successUrl?: string },
  ) {
    return this.payphoneService.buyBundle(dto.tenantId, dto.bundleCents, dto.successUrl);
  }

  @Get('balance/:tenantId')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Consultar saldo del tenant' })
  async balance(@Param('tenantId') tenantId: string) {
    return this.payphoneService.getBalance(tenantId);
  }

  @Post('webhook')
  @Public()
  @ApiExcludeEndpoint()
  async webhook(@Body() body: Record<string, unknown>) {
    return this.payphoneService.handleWebhook(body);
  }
}
