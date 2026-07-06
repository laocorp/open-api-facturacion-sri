import { Module } from '@nestjs/common';
import { PayphoneController } from './payphone.controller';
import { PayphoneService } from './payphone.service';
import { DatabaseModule } from '../../database';
import { ApiKeysModule } from '../api-keys/api-keys.module';

@Module({
  imports: [DatabaseModule, ApiKeysModule],
  controllers: [PayphoneController],
  providers: [PayphoneService],
  exports: [PayphoneService],
})
export class PayphoneModule {}
