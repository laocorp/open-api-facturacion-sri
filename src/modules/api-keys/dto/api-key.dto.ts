import { IsString, IsOptional, IsEnum, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ApiKeyTier {
  BASIC = 'basic',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
  UNLIMITED = 'unlimited',
}

export class CreateApiKeyDto {
  @ApiProperty({ description: 'Nombre descriptivo de la API Key' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Tier de rate limiting', enum: ApiKeyTier, default: ApiKeyTier.BASIC })
  @IsOptional()
  @IsEnum(ApiKeyTier)
  tier?: ApiKeyTier;
}

export class UpdateApiKeyDto {
  @ApiPropertyOptional({ description: 'Nombre descriptivo' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Tier de rate limiting', enum: ApiKeyTier })
  @IsOptional()
  @IsEnum(ApiKeyTier)
  tier?: ApiKeyTier;

  @ApiPropertyOptional({ description: 'Activar/Desactivar' })
  @IsOptional()
  @IsString()
  isActive?: string;
}

export class ApiKeyResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  keyPrefix: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: ApiKeyTier })
  tier: string;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional({ description: 'Solo se muestra UNA vez al crear' })
  apiSecret?: string;

  @ApiPropertyOptional()
  lastUsedAt?: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}
