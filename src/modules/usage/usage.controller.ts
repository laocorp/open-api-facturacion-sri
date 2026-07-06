import { Controller, Get, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsageService } from './usage.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/dto/auth.dto';

@ApiTags('Usage')
@ApiBearerAuth('JWT')
@Controller('usage')
export class UsageController {
  private readonly logger = new Logger(UsageController.name);

  constructor(private readonly usageService: UsageService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener registros de uso (paginado)' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'Lista de registros de uso' })
  async findAll(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.usageService.search({
      tenantId: user?.tenantId || undefined,
      from,
      to,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('summary')
  @ApiOperation({ summary: 'Obtener resumen de uso (agregaciones)' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiResponse({ status: 200, description: 'Resumen de uso' })
  async summary(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.usageService.summary({
      tenantId: user?.tenantId || undefined,
      from,
      to,
    });
  }
}
