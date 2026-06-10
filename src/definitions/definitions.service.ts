import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DefinitionEntity } from './definition.entity';
import { CreateDefinitionDto, UpdateDefinitionDto } from './definitions.dto';
import { DomainException, ERROR_CODES } from '../common/exceptions';

/**
 * سرویس مدیریت تعاریف مرجع (هویت/سکو) — پنل super_admin بخش «تعاریف».
 * خوشه‌ها در ClusterService جداگانه مدیریت می‌شوند.
 */
@Injectable()
export class DefinitionsService {
  constructor(
    @InjectRepository(DefinitionEntity)
    private readonly repo: Repository<DefinitionEntity>,
  ) {}

  /** فهرست تعاریف یک نوع (مرتب بر sort_order سپس title). */
  async list(
    type?: string,
    includeInactive = false,
  ): Promise<DefinitionEntity[]> {
    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (!includeInactive) where.is_active = true;
    return this.repo.find({
      where,
      order: { sort_order: 'ASC', title: 'ASC' },
    });
  }

  async create(dto: CreateDefinitionDto): Promise<DefinitionEntity> {
    const def = this.repo.create({
      type: dto.type,
      title: dto.title,
      key: dto.key?.trim() || this.deriveKey(dto.type, dto.title),
      description: dto.description ?? null,
      icon: dto.icon ?? null,
      sort_order: dto.sort_order ?? 0,
      is_active: dto.is_active ?? true,
    });
    return this.repo.save(def);
  }

  /** برای سکوها در نبود key، یک slug از عنوان می‌سازد؛ هویت‌ها key ندارند. */
  private deriveKey(type: string, title: string): string | null {
    if (type !== 'platform') return null;
    return title.trim().toLowerCase().replace(/\s+/g, '-');
  }

  async update(
    id: number,
    dto: UpdateDefinitionDto,
  ): Promise<DefinitionEntity> {
    const def = await this.repo.findOne({ where: { id } });
    if (!def) {
      throw new DomainException(
        ERROR_CODES.NOT_FOUND,
        `تعریفی با شناسهٔ ${id} یافت نشد`,
      );
    }
    Object.assign(def, {
      title: dto.title ?? def.title,
      key: dto.key !== undefined ? dto.key : def.key,
      description: dto.description ?? def.description,
      icon: dto.icon ?? def.icon,
      sort_order: dto.sort_order ?? def.sort_order,
      is_active: dto.is_active ?? def.is_active,
    });
    return this.repo.save(def);
  }

  async remove(id: number): Promise<{ deleted: true }> {
    const def = await this.repo.findOne({ where: { id } });
    if (!def) {
      throw new DomainException(
        ERROR_CODES.NOT_FOUND,
        `تعریفی با شناسهٔ ${id} یافت نشد`,
      );
    }
    await this.repo.delete({ id });
    return { deleted: true };
  }
}
