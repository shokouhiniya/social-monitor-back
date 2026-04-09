import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StrategicAlert } from './strategic-alert.entity';
import { CreateStrategicAlertDto } from './strategic-alert.dto';

@Injectable()
export class StrategicAlertService {
  constructor(
    @InjectRepository(StrategicAlert)
    private alertRepository: Repository<StrategicAlert>,
  ) {}

  async findAll() {
    return await this.alertRepository.find({
      where: { status: 'active' },
      order: { created_at: 'DESC' },
    });
  }

  async findById(id: number) {
    const alert = await this.alertRepository.findOne({ where: { id } });
    if (!alert) throw new HttpException('Alert not found', 404);
    return alert;
  }

  async create(dto: CreateStrategicAlertDto) {
    const alert = this.alertRepository.create(dto);
    return await this.alertRepository.save(alert);
  }

  async acknowledge(id: number) {
    const alert = await this.findById(id);
    alert.status = 'acknowledged';
    return await this.alertRepository.save(alert);
  }

  async remove(id: number) {
    const alert = await this.findById(id);
    return await this.alertRepository.remove(alert);
  }
}
