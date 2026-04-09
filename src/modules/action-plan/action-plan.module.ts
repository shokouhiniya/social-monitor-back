import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActionPlan } from './action-plan.entity';
import { ActionPlanController } from './action-plan.controller';
import { ActionPlanService } from './action-plan.service';

@Module({
  imports: [TypeOrmModule.forFeature([ActionPlan])],
  controllers: [ActionPlanController],
  providers: [ActionPlanService],
  exports: [ActionPlanService],
})
export class ActionPlanModule {}
