import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Network } from './network.entity';
import { CreateNetworkDto, UpdateNetworkDto } from './networks.dto';
import { ConflictException, NotFoundException } from '../common/exceptions';

/**
 * سرویس مدیریت network ها (NetworksModule — design §5.1).
 *
 * مسئول CRUD ساده روی جدول `networks` و فراهم‌کردن network پیش‌فرض برای
 * deployment تک‌شبکه‌ای (Requirement 1.1). برای خطاهای not-found/conflict از
 * استثناهای دامنه (`DomainException`) استفاده می‌شود تا envelope خطای یکدست
 * تولید شود.
 */
@Injectable()
export class NetworksService {
  /** slug ثابت network پیش‌فرض — هماهنگ با مهاجرت فاز ۲. */
  private static readonly DEFAULT_NETWORK_SLUG = 'default';

  constructor(
    @InjectRepository(Network)
    private readonly networkRepository: Repository<Network>,
  ) {}

  /** فهرست همهٔ network ها به ترتیب ساخت. */
  async findAll(): Promise<Network[]> {
    return this.networkRepository.find({ order: { created_at: 'ASC' } });
  }

  /** یافتن یک network با id؛ در صورت نبود، NotFoundException. */
  async findById(id: number): Promise<Network> {
    const network = await this.networkRepository.findOne({ where: { id } });
    if (!network) {
      throw new NotFoundException(`شبکه‌ای با شناسهٔ ${id} یافت نشد`);
    }
    return network;
  }

  /**
   * network فعال پیش‌فرض برای deployment تک‌شبکه‌ای.
   * اول network با `slug = 'default'` را برمی‌گرداند؛ در صورت نبود، نخستین
   * network فعال؛ و اگر هیچ‌کدام نبود NotFoundException.
   */
  async getDefault(): Promise<Network> {
    const bySlug = await this.networkRepository.findOne({
      where: { slug: NetworksService.DEFAULT_NETWORK_SLUG },
    });
    if (bySlug) return bySlug;

    const activeDefault = await this.networkRepository.findOne({
      where: { is_active: true },
      order: { created_at: 'ASC' },
    });
    if (!activeDefault) {
      throw new NotFoundException('هیچ شبکهٔ پیش‌فرض فعالی یافت نشد');
    }
    return activeDefault;
  }

  /** ساخت network جدید؛ یکتایی slug بررسی می‌شود. */
  async create(dto: CreateNetworkDto): Promise<Network> {
    const existing = await this.networkRepository.findOne({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException(
        `شبکه‌ای با شناسهٔ یکتای «${dto.slug}» از قبل وجود دارد`,
      );
    }
    const network = this.networkRepository.create(dto);
    return this.networkRepository.save(network);
  }

  /** به‌روزرسانی network موجود؛ در صورت تغییر slug، یکتایی بررسی می‌شود. */
  async update(id: number, dto: UpdateNetworkDto): Promise<Network> {
    const network = await this.findById(id);

    if (dto.slug && dto.slug !== network.slug) {
      const conflict = await this.networkRepository.findOne({
        where: { slug: dto.slug },
      });
      if (conflict) {
        throw new ConflictException(
          `شبکه‌ای با شناسهٔ یکتای «${dto.slug}» از قبل وجود دارد`,
        );
      }
    }

    Object.assign(network, dto);
    return this.networkRepository.save(network);
  }
}
