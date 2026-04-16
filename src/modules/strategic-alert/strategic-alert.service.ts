import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { StrategicAlert } from './strategic-alert.entity';
import { CreateStrategicAlertDto, UpdateAlertStatusDto } from './strategic-alert.dto';

@Injectable()
export class StrategicAlertService {
  constructor(
    @InjectRepository(StrategicAlert)
    private alertRepository: Repository<StrategicAlert>,
  ) {}

  async findAll(status?: string) {
    const where: any = {};
    if (status) {
      where.status = status;
    } else {
      where.status = In(['active', 'investigating', 'needs_response']);
    }
    return await this.alertRepository.find({
      where,
      order: { created_at: 'DESC' },
    });
  }

  async findById(id: number) {
    const alert = await this.alertRepository.findOne({ where: { id } });
    if (!alert) throw new HttpException('Alert not found', 404);
    return alert;
  }

  async create(dto: CreateStrategicAlertDto) {
    // Auto-calculate impact radius and generate playbook
    const targetCount = dto.target_pages?.length || 0;
    const impactRadius = Math.min(targetCount * 3.5, 100);

    const playbook = this.generatePlaybook(dto.category, dto.priority);

    const alert = this.alertRepository.create({
      ...dto,
      impact_radius: impactRadius,
      involved_pages_count: targetCount,
      playbook,
    });
    return await this.alertRepository.save(alert);
  }

  async updateStatus(id: number, dto: UpdateAlertStatusDto) {
    const alert = await this.findById(id);
    alert.status = dto.status;
    if (dto.assigned_to) alert.assigned_to = dto.assigned_to;
    return await this.alertRepository.save(alert);
  }

  async remove(id: number) {
    const alert = await this.findById(id);
    return await this.alertRepository.remove(alert);
  }

  async getStats() {
    const all = await this.alertRepository.find({
      where: { status: In(['active', 'investigating', 'needs_response']) },
    });

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recentCount = all.filter((a) => new Date(a.created_at) >= oneHourAgo).length;

    return {
      total: all.length,
      critical: all.filter((a) => a.priority === 'critical').length,
      high: all.filter((a) => a.priority === 'high').length,
      crisis: all.filter((a) => a.category === 'crisis').length,
      opportunity: all.filter((a) => a.category === 'opportunity').length,
      investigating: all.filter((a) => a.status === 'investigating').length,
      velocity: recentCount, // alerts per hour
      avg_impact: all.length > 0 ? Math.round(all.reduce((s, a) => s + (a.impact_radius || 0), 0) / all.length) : 0,
    };
  }

  async getGrouped() {
    const alerts = await this.findAll();

    // Group by category
    const groups: Record<string, StrategicAlert[]> = {};
    for (const alert of alerts) {
      const key = alert.group_key || alert.category || 'other';
      if (!groups[key]) groups[key] = [];
      groups[key].push(alert);
    }

    return Object.entries(groups).map(([key, items]) => ({
      group_key: key,
      count: items.length,
      max_priority: this.getMaxPriority(items),
      total_impact: Math.round(items.reduce((s, a) => s + (a.impact_radius || 0), 0)),
      alerts: items,
    }));
  }

  private getMaxPriority(alerts: StrategicAlert[]): string {
    const order = ['critical', 'high', 'medium', 'low'];
    for (const p of order) {
      if (alerts.some((a) => a.priority === p)) return p;
    }
    return 'low';
  }

  private generatePlaybook(category?: string, priority?: string): string[] {
    const playbooks: Record<string, string[]> = {
      crisis: [
        'توقف فوری انتشار محتوای مرتبط',
        'تماس با ادمین‌های پیج‌های درگیر',
        'انتشار بیانیه رسمی یا محتوای اصلاحی',
      ],
      silence_gap: [
        'تولید فوری محتوا درباره موضوع شناسایی‌شده',
        'بازنشر محتوای مرتبط از منابع معتبر',
        'هماهنگی با تیم محتوا برای پوشش ۲۴ ساعته',
      ],
      trend_shift: [
        'تحلیل عمیق دلایل تغییر ترند',
        'شناسایی لیدرهای فکری پشت تغییر',
        'تنظیم استراتژی محتوا بر اساس ترند جدید',
      ],
      opportunity: [
        'بهره‌برداری فوری از فرصت شناسایی‌شده',
        'هماهنگی با پیج‌های کلیدی برای بازنشر',
        'تولید محتوای ویژه متناسب با فرصت',
      ],
    };

    return playbooks[category || ''] || [
      'بررسی و تحلیل وضعیت',
      'هماهنگی با تیم مربوطه',
      'پیگیری و گزارش‌دهی',
    ];
  }
}
