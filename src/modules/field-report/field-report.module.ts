import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FieldReport } from './field-report.entity';
import { FieldReportController } from './field-report.controller';
import { FieldReportService } from './field-report.service';

@Module({
  imports: [TypeOrmModule.forFeature([FieldReport])],
  controllers: [FieldReportController],
  providers: [FieldReportService],
  exports: [FieldReportService],
})
export class FieldReportModule {}
