import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Interaction } from './interaction.entity';

@Injectable()
export class InteractionService {
  constructor(
    @InjectRepository(Interaction)
    private repo: Repository<Interaction>,
  ) {}

  async findByPage(pageId: number) {
    return await this.repo.find({
      where: { page_id: pageId },
      order: { created_at: 'DESC' },
    });
  }

  async create(dto: any) {
    const interaction = this.repo.create(dto);
    return await this.repo.save(interaction);
  }
}
