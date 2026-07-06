import { Module } from '@nestjs/common';
import { UsageController } from './usage.controller';
import { UsageService } from './usage.service';
import { UsageInterceptor } from './usage.interceptor';
import { DatabaseModule } from '../../database';

@Module({
  imports: [DatabaseModule],
  controllers: [UsageController],
  providers: [UsageService, UsageInterceptor],
  exports: [UsageService, UsageInterceptor],
})
export class UsageModule {}
