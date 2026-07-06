import { Controller, Get, Post, Put, Delete, Body, Param, Logger, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto, UpdateApiKeyDto, ApiKeyResponseDto } from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/dto/auth.dto';

@ApiTags('API Keys')
@ApiBearerAuth('JWT')
@Controller('api-keys')
export class ApiKeysController {
  private readonly logger = new Logger(ApiKeysController.name);

  constructor(private readonly apiKeysService: ApiKeysService) {}

  private getTenant(user: JwtPayload): string {
    if (!user.tenantId) throw new BadRequestException('Usuario sin tenant asignado');
    return user.tenantId;
  }

  @Get()
  @ApiOperation({ summary: 'Listar API Keys del tenant' })
  @ApiResponse({ status: 200, type: [ApiKeyResponseDto] })
  async findAll(@CurrentUser() user: JwtPayload): Promise<ApiKeyResponseDto[]> {
    return this.apiKeysService.findAll(this.getTenant(user));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener API Key por ID' })
  @ApiResponse({ status: 200, type: ApiKeyResponseDto })
  async findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<ApiKeyResponseDto> {
    return this.apiKeysService.findOne(id, this.getTenant(user));
  }

  @Post()
  @ApiOperation({ summary: 'Crear API Key (secret mostrado UNA vez)' })
  @ApiResponse({ status: 201, type: ApiKeyResponseDto })
  async create(@Body() dto: CreateApiKeyDto, @CurrentUser() user: JwtPayload): Promise<ApiKeyResponseDto> {
    return this.apiKeysService.create(this.getTenant(user), dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar API Key (nombre, tier)' })
  @ApiResponse({ status: 200, type: ApiKeyResponseDto })
  async update(@Param('id') id: string, @Body() dto: UpdateApiKeyDto, @CurrentUser() user: JwtPayload): Promise<ApiKeyResponseDto> {
    return this.apiKeysService.update(id, this.getTenant(user), dto);
  }

  @Delete(':id/deactivate')
  @ApiOperation({ summary: 'Desactivar API Key (soft delete)' })
  @ApiResponse({ status: 200, type: ApiKeyResponseDto })
  async deactivate(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<ApiKeyResponseDto> {
    return this.apiKeysService.deactivate(id, this.getTenant(user));
  }

  @Post(':id/rotate')
  @ApiOperation({ summary: 'Rotar API Key (nuevo secret, invalida anterior)' })
  @ApiResponse({ status: 200, type: ApiKeyResponseDto })
  async rotate(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<ApiKeyResponseDto> {
    return this.apiKeysService.rotate(id, this.getTenant(user));
  }
}
