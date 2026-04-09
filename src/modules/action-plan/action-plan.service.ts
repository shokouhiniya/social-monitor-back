import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActionPlan } from './action-plan.entity';
import { CreateActionPlanDto, UpdateActionPlanDto } from './action-plan.dto';

@Injectable()
export class ActionPlanService {
  constructor(
    @InjectRepository(ActionPlan)
    private actionPlanRepository: Repository<ActionPlan>,
  ) {}

  async findByPage(pageId: number) {
    return await this.actionPlanRepository.find({
      where: { page_id: pageId },
      order: { priority: 'ASC', created_at: 'DESC' },
    });
  }

  async findById(id: number) {
    const plan = await this.actionPlanRepository.findOne({
      where: { id },
      relations: ['page'],
    });
    if (!plan) throw new HttpException('Action plan not found', 404);
    return plan;
  }

  async create(dto: CreateActionPlanDto) {
    const plan = this.actionPlanRepository.create(dto);
    return await this.actionPlanRepository.save(plan);
  }

  async update(id: number, dto: UpdateActionPlanDto) {
    const plan = await this.findById(id);
    Object.assign(plan, dto);
    return await this.actionPlanRepository.save(plan);
  }

  async remove(id: number) {
    const plan = await this.findById(id);
    return await this.actionPlanRepository.remove(plan);
  }
}
