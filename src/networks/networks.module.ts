import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Network } from './network.entity';
import { NetworksController } from './networks.controller';
import { NetworksService } from './networks.service';

/**
 * NetworksModule — مدیریت network های عملیاتی (design §5.1).
 * در `app.module.ts` به‌صورت dual-import در کنار ماژول‌های legacy ثبت می‌شود
 * (Requirement 1.6).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Network])],
  controllers: [NetworksController],
  providers: [NetworksService],
  exports: [NetworksService],
})
export class NetworksModule {}
