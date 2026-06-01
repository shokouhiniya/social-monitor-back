import { Injectable } from '@nestjs/common';
import { NormalizedContent } from '../../content/content.types';
import {
  CollectionNormalizer,
  NormalizedProfile,
  Platform,
  RawContent,
  RawProfile,
} from '../collection.types';

/**
 * Normalizer تلگرام (design §5.5 — `CollectionNormalizer`).
 *
 * خروجی خام MTProto/کلاینت تلگرام (پیام‌های کانال) را به `NormalizedContent`
 * نگاشت می‌کند (Requirement 4.2). منطق نگاشت از مسیر legacy
 * `TelegramService.syncTelegramChannel` استخراج شده (message.id/message/views/
 * forwards/media.className) و به‌صورت تابع خالص و مقاوم بازنویسی شده است.
 * پیام‌های فاقد متن و رسانه (`external_id` نامعتبر یا محتوای تهی) کنار گذاشته
 * می‌شوند (Requirement 4.7).
 */
@Injectable()
export class TelegramNormalizer implements CollectionNormalizer {
  readonly platform: Platform = 'telegram';

  /** نگاشت اطلاعات کانال خام به `NormalizedProfile`. */
  normalizeProfile(raw: RawProfile): NormalizedProfile {
    const p = (raw ?? {}) as Record<string, any>;
    return {
      displayName: asString(p.title ?? p.name),
      bio: asString(p.about ?? p.bio),
      followersCount: asNumber(p.participantsCount ?? p.participants_count),
      profileImageUrl: asString(p.profileImageUrl ?? p.profile_image_url),
    };
  }

  /** نگاشت آرایهٔ پیام خام تلگرام به `NormalizedContent`. */
  normalizeContent(raw: RawContent[], sourceId: number): NormalizedContent[] {
    if (!Array.isArray(raw)) return [];

    const out: NormalizedContent[] = [];
    for (const message of raw) {
      const normalized = this.normalizeOne(message, sourceId);
      if (normalized) out.push(normalized);
    }
    return out;
  }

  /** نگاشت یک پیام خام؛ پیام بدون id یا بدون محتوا (متن/رسانه) کنار گذاشته می‌شود. */
  private normalizeOne(
    message: RawContent,
    sourceId: number,
  ): NormalizedContent | null {
    const m = (message ?? {}) as Record<string, any>;
    const id = m.id;
    if (id === undefined || id === null) return null;

    const caption = asString(m.message) ?? '';
    const hasMedia = !!m.media;
    // پیام تهی (نه متن و نه رسانه) محتوای معناداری ندارد → skip (Req 4.7).
    if (caption === '' && !hasMedia) return null;

    const externalId = String(id);
    const publishedAt =
      typeof m.date === 'number' ? new Date(m.date * 1000) : undefined;

    return {
      source_id: sourceId,
      external_id: externalId,
      content_type: deriveTelegramType(m),
      caption,
      metrics: {
        likes: 0, // تلگرام لایک ندارد.
        comments: 0,
        shares: asNumber(m.forwards) ?? 0,
        views: asNumber(m.views) ?? 0,
      },
      published_at: publishedAt,
    };
  }
}

/* ------------------------------------------------------------------ */
/* کمکی‌های نگاشت (خالص)                                                */
/* ------------------------------------------------------------------ */

/** نگاشت نوع رسانهٔ تلگرام به نوع محتوای استاندارد. */
function deriveTelegramType(message: Record<string, any>): string {
  const media = message.media as Record<string, any> | undefined;
  if (!media) return 'text';
  if (media.className === 'MessageMediaPhoto') return 'photo';
  if (media.className === 'MessageMediaDocument') {
    const mime = media.document?.mimeType;
    if (typeof mime === 'string' && mime.startsWith('video/')) return 'video';
  }
  return 'text';
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}
