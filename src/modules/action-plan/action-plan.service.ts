import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActionPlan } from './action-plan.entity';
import { CreateActionPlanDto, CreateActionPlanFromAlertDto, UpdateActionPlanDto } from './action-plan.dto';

@Injectable()
export class ActionPlanService {
  constructor(
    @InjectRepository(ActionPlan)
    private actionPlanRepository: Repository<ActionPlan>,
  ) {}

  async findAll(filters?: { status?: string; assigned_to?: string }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.assigned_to) where.assigned_to = filters.assigned_to;
    return await this.actionPlanRepository.find({
      where,
      relations: ['page', 'interactions', 'alert'],
      order: { priority: 'DESC', created_at: 'DESC' },
    });
  }

  async findByPage(pageId: number) {
    return await this.actionPlanRepository.find({
      where: { page_id: pageId },
      relations: ['interactions', 'alert'],
      order: { priority: 'DESC', created_at: 'DESC' },
    });
  }

  async findByCluster(clusterId: number) {
    return await this.actionPlanRepository.find({
      where: { cluster_id: clusterId },
      relations: ['interactions', 'alert', 'page'],
      order: { priority: 'DESC', created_at: 'DESC' },
    });
  }

  async findByAlert(alertId: number) {
    return await this.actionPlanRepository.find({
      where: { alert_id: alertId },
      relations: ['interactions', 'page'],
      order: { created_at: 'DESC' },
    });
  }

  async findById(id: number) {
    const plan = await this.actionPlanRepository.findOne({
      where: { id },
      relations: ['page', 'interactions', 'alert'],
    });
    if (!plan) throw new HttpException('Action plan not found', 404);
    return plan;
  }

  async create(dto: CreateActionPlanDto) {
    if (!dto.page_id && !dto.cluster_id) {
      throw new HttpException('یکی از page_id یا cluster_id باید مشخص شود', 400);
    }
    const plan = this.actionPlanRepository.create(dto);
    return await this.actionPlanRepository.save(plan);
  }

  async createFromAlert(dto: CreateActionPlanFromAlertDto) {
    const plans: ActionPlan[] = [];

    // Cluster-level operation
    if (dto.cluster_id) {
      const plan = this.actionPlanRepository.create({
        cluster_id: dto.cluster_id,
        alert_id: dto.alert_id,
        title: dto.title,
        description: dto.description,
        priority: dto.priority ?? 2,
        category: dto.category,
        due_date: dto.due_date,
        assigned_to: dto.assigned_to,
      });
      plans.push(await this.actionPlanRepository.save(plan));
    }

    // Page-level operations
    if (dto.page_ids && dto.page_ids.length > 0) {
      for (const pageId of dto.page_ids) {
        const plan = this.actionPlanRepository.create({
          page_id: pageId,
          alert_id: dto.alert_id,
          title: dto.title,
          description: dto.description,
          priority: dto.priority ?? 2,
          category: dto.category,
          due_date: dto.due_date,
          assigned_to: dto.assigned_to,
        });
        plans.push(await this.actionPlanRepository.save(plan));
      }
    }

    return plans;
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

  async getStats() {
    const all = await this.actionPlanRepository.find();
    return {
      total: all.length,
      todo: all.filter((p) => p.status === 'todo').length,
      in_progress: all.filter((p) => p.status === 'in_progress').length,
      done: all.filter((p) => p.status === 'done').length,
      cancelled: all.filter((p) => p.status === 'cancelled').length,
      high_priority: all.filter((p) => (p.priority || 0) >= 2).length,
    };
  }
}
