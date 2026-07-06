import { Module } from '@nestjs/common';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { RateLimitService } from './services/rate-limit.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { DatabaseModule } from '../../database';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [DatabaseModule, ConfigModule],
  controllers: [ApiKeysController],
  providers: [ApiKeysService, RateLimitService, ApiKeyGuard],
  exports: [ApiKeysService, RateLimitService, ApiKeyGuard],
})
export class ApiKeysModule {}
