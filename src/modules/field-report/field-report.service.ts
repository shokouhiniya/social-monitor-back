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
}
