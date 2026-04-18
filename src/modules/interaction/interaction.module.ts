import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Interaction } from './interaction.entity';
import { InteractionController } from './interaction.controller';
import { InteractionService } from './interaction.service';

@Module({
  imports: [TypeOrmModule.forFeature([Interaction])],
  controllers: [InteractionController],
  providers: [InteractionService],
  exports: [InteractionService],
})
export class InteractionModule {}
