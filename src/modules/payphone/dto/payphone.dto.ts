import { IsString, IsNotEmpty, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiKeyTier } from '../../api-keys/dto/api-key.dto';

export class InitChargeDto {
  @ApiProperty({ enum: ApiKeyTier, description: 'Tier a comprar' })
  @IsEnum(ApiKeyTier)
  tier: ApiKeyTier;

  @ApiProperty({ description: 'ID del tenant' })
  @IsString()
  @IsNotEmpty()
  tenantId: string;

  @ApiPropertyOptional({ description: 'URL de retorno tras pago exitoso' })
  @IsOptional()
  @IsString()
  successUrl?: string;
}

export class InitChargeResponseDto {
  @ApiProperty() payphoneId: number;
  @ApiProperty() url: string;
  @ApiProperty() clientTransactionId: string;
}

export class PayphoneWebhookDto {
  @ApiPropertyOptional() id_sale?: number;
  @ApiPropertyOptional() id_venta?: number;
  @ApiPropertyOptional() numero_comercio?: string;
  @ApiPropertyOptional() monto?: number;
  @ApiPropertyOptional() monto_iva?: number;
  @ApiPropertyOptional() monto_sin_impuesto?: number;
  @ApiPropertyOptional() moneda?: string;
  @ApiPropertyOptional() estado?: string;
  @ApiPropertyOptional() codigo_autorizacion?: string;
  @ApiPropertyOptional() clientTransactionId?: string;
  @ApiPropertyOptional() client_transaction_id?: string;
  @ApiPropertyOptional() referencia?: string;
  @ApiPropertyOptional() telefono?: string;
  @ApiPropertyOptional() email?: string;
  @ApiPropertyOptional() fecha?: string;
  @ApiPropertyOptional() id_transaction?: string;
}

export class PayphoneWebhookResponseDto {
  @ApiProperty() Response: boolean;
  @ApiProperty() ErrorCode: string;
}
