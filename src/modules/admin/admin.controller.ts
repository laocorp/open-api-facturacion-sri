import { Controller, Post, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DatabaseService } from '../../database/database.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/dto/auth.dto';

@ApiTags('Admin')
@ApiBearerAuth('JWT')
@Roles(UserRole.SUPERADMIN)
@Controller('admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(private readonly db: DatabaseService) {}

  @Post('cleanup-demo')
  @ApiOperation({ summary: 'Eliminar tenants, emisores y usuarios demo' })
  async cleanupDemo() {
    const { rows: tenants } = await this.db.query(
      `SELECT id, nombre FROM tenants WHERE nombre LIKE 'demo%'`,
    );

    for (const t of tenants) {
      await this.db.query(`DELETE FROM usage_logs WHERE tenant_id = $1`, [t.id]);
      await this.db.query(`DELETE FROM api_keys WHERE tenant_id = $1`, [t.id]);
      await this.db.query(`DELETE FROM usuarios WHERE tenant_id = $1`, [t.id]);
      await this.db.query(`DELETE FROM emisores WHERE tenant_id = $1`, [t.id]);
      await this.db.query(`DELETE FROM tenants WHERE id = $1`, [t.id]);
      this.logger.log(`Cleaned tenant: ${t.nombre}`);
    }

    return { deleted: tenants.length, tenants: tenants.map((t: any) => t.nombre) };
  }
}
