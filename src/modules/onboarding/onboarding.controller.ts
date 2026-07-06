import { Controller, Post, Body, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { IsString, IsEmail, IsNotEmpty, Length, Matches, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import { Public } from '../auth/decorators/public.decorator';

export class OnboardingDto {
  @ApiProperty({ description: 'Email del administrador' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Contraseña (min 8 caracteres)' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ description: 'RUC del emisor (13 dígitos)' })
  @IsString()
  @Length(13, 13)
  @Matches(/^\d{13}$/)
  ruc: string;

  @ApiProperty({ description: 'Razón social' })
  @IsString()
  @IsNotEmpty()
  razonSocial: string;

  @ApiProperty({ description: 'Dirección matriz' })
  @IsString()
  @IsNotEmpty()
  direccionMatriz: string;

  @ApiProperty({ description: 'Nombre del tenant/empresa' })
  @IsString()
  @IsNotEmpty()
  tenantName: string;

  @ApiPropertyOptional({ description: 'Nombre comercial' })
  @IsOptional()
  @IsString()
  nombreComercial?: string;
}

class IdNombre {
  @ApiProperty() id: string;
  @ApiProperty() nombre: string;
}
class IdEmail {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
}
class EmisorInfo {
  @ApiProperty() id: string;
  @ApiProperty() ruc: string;
  @ApiProperty() razon_social: string;
}

export class OnboardingResponseDto {
  @ApiProperty({ type: IdNombre }) tenant: IdNombre;
  @ApiProperty({ type: IdEmail }) user: IdEmail;
  @ApiProperty({ type: EmisorInfo }) emisor: EmisorInfo;
  @ApiProperty({ description: 'Prefijo de la API Key' }) apiKey: string;
  @ApiProperty({ description: 'API Secret (mostrado UNA vez)' }) apiSecret: string;
}

@ApiTags('Onboarding')
@Public()
@Controller('onboarding')
export class OnboardingController {
  private readonly logger = new Logger(OnboardingController.name);

  constructor(private readonly onboardingService: OnboardingService) {}

  @Post()
  @ApiOperation({ summary: 'Registro completo: tenant + usuario + emisor + API Key' })
  @ApiBody({ type: OnboardingDto })
  @ApiResponse({ status: 201, type: OnboardingResponseDto })
  @ApiResponse({ status: 409, description: 'Email o RUC ya registrados' })
  async onboard(@Body() dto: OnboardingDto): Promise<OnboardingResponseDto> {
    return this.onboardingService.onboard(dto);
  }
}
