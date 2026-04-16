import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FieldReport } from './field-report.entity';
import { CreateFieldReportDto, FieldReportQueryDto } from './field-report.dto';

@Injectable()
export class FieldReportService {
  constructor(
    @InjectRepository(FieldReport)
    private reportRepository: Repository<FieldReport>,
  ) {}

  async findAll(query: FieldReportQueryDto) {
    const { page_id, status, page = 1, limit = 20 } = query;
    const where: any = {};

    if (page_id) where.page_id = page_id;
    if (status) where.status = status;

    const [data, total] = await this.reportRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
      relations: ['page'],
    });

    return { data, total, page, limit };
  }

  async findById(id: number) {
    const report = await this.reportRepository.findOne({
      where: { id },
      relations: ['page'],
    });
    if (!report) throw new HttpException('Field report not found', 404);
    return report;
  }

  async create(dto: CreateFieldReportDto) {
    const report = this.reportRepository.create(dto);
    return await this.reportRepository.save(report);
  }

  async updateStatus(id: number, status: string) {
    const report = await this.findById(id);
    report.status = status;
    return await this.reportRepository.save(report);
  }

  async remove(id: number) {
    const report = await this.findById(id);
    return await this.reportRepository.remove(report);
  }

  async getByPage(pageId: number) {
    return await this.reportRepository.find({
      where: { page_id: pageId },
      order: { created_at: 'DESC' },
    });
  }

  async getStats() {
    const all = await this.reportRepository.find();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayReports = all.filter((r) => new Date(r.created_at) >= today);

    const bySource: Record<string, number> = {};
    for (const r of all) {
      const src = r.source_type || 'manual';
      bySource[src] = (bySource[src] || 0) + 1;
    }

    // Top reported pages
    const pageCount: Record<number, number> = {};
    for (const r of all) {
      if (r.page_id) pageCount[r.page_id] = (pageCount[r.page_id] || 0) + 1;
    }
    const topPages = Object.entries(pageCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ page_id: Number(id), count }));

    // Top reporters
    const reporterCount: Record<number, number> = {};
    for (const r of all) {
      reporterCount[r.reporter_id] = (reporterCount[r.reporter_id] || 0) + 1;
    }
    const topReporters = Object.entries(reporterCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ reporter_id: Number(id), count }));

    return {
      total: all.length,
      today: todayReports.length,
      pending: all.filter((r) => r.status === 'pending').length,
      processed: all.filter((r) => r.status === 'processed').length,
      by_source: bySource,
      top_pages: topPages,
      top_reporters: topReporters,
    };
  }
}
