import { Module } from '@nestjs/common';
import { PayphoneController } from './payphone.controller';
import { PayController } from './pay.controller';
import { PayphoneService } from './payphone.service';
import { DatabaseModule } from '../../database';

@Module({
  imports: [DatabaseModule],
  controllers: [PayphoneController, PayController],
  providers: [PayphoneService],
  exports: [PayphoneService],
})
export class PayphoneModule {}
