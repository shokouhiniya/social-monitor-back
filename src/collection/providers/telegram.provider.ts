import { Injectable } from '@nestjs/common';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import {
  classifyProviderError,
  CollectionProvider,
  FetchOptions,
  Platform,
  RawContent,
  RawProfile,
} from '../collection.types';

const CONNECT_TIMEOUT_MS = 10000;
const DEFAULT_MESSAGE_LIMIT = 50;
const BATCH_SIZE = 100;

/**
 * Provider تلگرام (design §5.5 — `CollectionProvider`).
 *
 * منطق واکشی تلگرام را — که در مسیر legacy داخل `TelegramService` بود — به‌صورت
 * تمیز و fetch-only کپسوله می‌کند (بدون ذخیره در DB). از همان رویکرد اتصال
 * lazy و StringSession مسیر legacy استفاده می‌کند تا قابلیت از دست نرود.
 *
 * **قرارداد خطا (Requirement 4.6):** خطای اتصال/واکشی از طریق
 * `classifyProviderError` به `CollectionProviderError` طبقه‌بندی‌شده تبدیل و
 * پرتاب می‌شود؛ `CollectionService` آن را در summary بازتاب می‌دهد.
 *
 * خروجی `fetchPosts` آرایهٔ پیام خام (شیء message کلاینت) است که
 * `TelegramNormalizer` انتظار دارد.
 */
@Injectable()
export class TelegramProvider implements CollectionProvider {
  readonly platform: Platform = 'telegram';

  private client: TelegramClient | null = null;
  private connecting: Promise<void> | null = null;

  /** اتصال lazy؛ تنها هنگام نیاز و یک‌بار (mirror مسیر legacy). */
  private async ensureConnected(): Promise<TelegramClient> {
    if (this.client && this.client.connected) return this.client;
    if (this.connecting) {
      await this.connecting;
      if (this.client) return this.client;
    }

    this.connecting = this.connect();
    try {
      await this.connecting;
    } finally {
      this.connecting = null;
    }
    if (!this.client) {
      throw new Error('Telegram client failed to connect');
    }
    return this.client;
  }

  private async connect(): Promise<void> {
    const apiId = parseInt(process.env.TELEGRAM_API_ID || '0', 10);
    const apiHash = process.env.TELEGRAM_API_HASH || '';
    const sessionString = process.env.TELEGRAM_SESSION || '';

    if (!sessionString) {
      throw new Error('Telegram session not configured');
    }

    const session = new StringSession(sessionString);
    const client = new TelegramClient(session, apiId, apiHash, {
      connectionRetries: 3,
      timeout: CONNECT_TIMEOUT_MS / 1000,
    });
    await client.connect();
    this.client = client;
  }

  /** واکشی اطلاعات خام کانال (title/about/participantsCount). */
  async fetchProfile(username: string): Promise<RawProfile> {
    try {
      const client = await this.ensureConnected();
      const entity: any = await client.getEntity(username);

      let participantsCount = 0;
      let about = '';
      try {
        // درون‌خوانی dynamic مطابق مسیر legacy (telegram/tl).
        const { Api } = await import('telegram');
        const full: any = await client.invoke(
          new Api.channels.GetFullChannel({ channel: entity }),
        );
        participantsCount = full?.fullChat?.participantsCount ?? 0;
        about = full?.fullChat?.about ?? '';
      } catch {
        // اطلاعات کامل اختیاری است؛ نبود آن خطای قطعی نیست.
      }

      return {
        title: entity?.title ?? username,
        about,
        participantsCount,
      } as RawProfile;
    } catch (error) {
      throw classifyProviderError(error, this.platform);
    }
  }

  /** واکشی پیام‌های خام کانال تا سقف `opts.limit` (یا پیش‌فرض). */
  async fetchPosts(
    username: string,
    opts?: FetchOptions,
  ): Promise<RawContent[]> {
    try {
      const client = await this.ensureConnected();
      const entity: any = await client.getEntity(username);
      const target = opts?.limit ?? DEFAULT_MESSAGE_LIMIT;

      const messages: RawContent[] = [];
      let offsetId = 0;

      while (messages.length < target) {
        const batch: any[] = await client.getMessages(entity, {
          limit: BATCH_SIZE,
          offsetId: offsetId > 0 ? offsetId : undefined,
        });
        if (!batch || batch.length === 0) break;

        messages.push(...(batch as RawContent[]));
        offsetId = batch[batch.length - 1].id;

        // توقف هنگام پوشش since (در صورت تعیین).
        if (opts?.since) {
          const oldest = batch[batch.length - 1];
          const oldestDate =
            typeof oldest?.date === 'number'
              ? new Date(oldest.date * 1000)
              : null;
          if (oldestDate && oldestDate < opts.since) break;
        }

        await delay(100); // فاصلهٔ کوچک برای پرهیز از rate-limit.
      }

      return messages.slice(0, target);
    } catch (error) {
      throw classifyProviderError(error, this.platform);
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
