import { Controller, Post, Get, Body, Logger, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiExcludeEndpoint } from '@nestjs/swagger';
import { PayphoneService } from './payphone.service';
import { InitChargeDto, PayphoneWebhookDto, PayphoneWebhookResponseDto } from './dto/payphone.dto';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/dto/auth.dto';
import { ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Payphone - Pagos')
@Controller('payphone')
export class PayphoneController {
  private readonly logger = new Logger(PayphoneController.name);

  constructor(private readonly payphoneService: PayphoneService) {}

  @Post('charge')
  @ApiBearerAuth('JWT')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Iniciar pago para upgrade de tier' })
  async initCharge(@Body() dto: InitChargeDto) {
    return this.payphoneService.initCharge(dto.tier, dto.tenantId, dto.successUrl);
  }

  @Post('webhook')
  @Public()
  @ApiExcludeEndpoint()
  async webhook(@Body() body: PayphoneWebhookDto): Promise<PayphoneWebhookResponseDto> {
    return this.payphoneService.handleWebhook(body as unknown as Record<string, unknown>);
  }

  @Get('prices')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Listar precios de todos los tiers' })
  async prices() {
    return this.payphoneService.listPrices();
  }
}
