import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StrategicAlert } from './strategic-alert.entity';
import { StrategicAlertController } from './strategic-alert.controller';
import { StrategicAlertService } from './strategic-alert.service';

@Module({
  imports: [TypeOrmModule.forFeature([StrategicAlert])],
  controllers: [StrategicAlertController],
  providers: [StrategicAlertService],
  exports: [StrategicAlertService],
})
export class StrategicAlertModule {}
