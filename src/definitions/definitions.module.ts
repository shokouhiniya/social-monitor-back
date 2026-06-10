import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DefinitionEntity } from './definition.entity';
import { DefinitionsController } from './definitions.controller';
import { DefinitionsService } from './definitions.service';
import { AccessModule } from '../access/access.module';

/**
 * DefinitionsModule — تعاریف مرجع هویت/سکو (پنل super_admin بخش «تعاریف»).
 */
@Module({
  imports: [TypeOrmModule.forFeature([DefinitionEntity]), AccessModule],
  controllers: [DefinitionsController],
  providers: [DefinitionsService],
  exports: [DefinitionsService],
})
export class DefinitionsModule {}
