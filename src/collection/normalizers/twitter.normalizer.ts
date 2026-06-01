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
 * Normalizer توییتر/X (design §5.5 — `CollectionNormalizer`).
 *
 * خروجی خام provider توییتر را — پس از نرمال‌سازی provider به شکل مشترک
 * `tweet_results.result` (الگوی legacy `TwitterService.normalizeTweetsResponse`)
 * — به `NormalizedContent` نگاشت می‌کند (Requirement 4.2). توییت فاقد `rest_id`
 * یا `legacy` معتبر کنار گذاشته می‌شود (Requirement 4.7).
 *
 * ورودی `normalizeContent` آرایه‌ای از `entries` (شکل
 * `timeline.instructions[].entries`) است؛ provider مسئول تخت‌کردن پاسخ به این
 * شکل است.
 */
@Injectable()
export class TwitterNormalizer implements CollectionNormalizer {
  readonly platform: Platform = 'twitter';

  /** نگاشت پروفایل خام (شکل `result.legacy`) به `NormalizedProfile`. */
  normalizeProfile(raw: RawProfile): NormalizedProfile {
    const r = (raw ?? {}) as Record<string, any>;
    const legacy = (r.result?.legacy ?? r.legacy ?? r) as Record<string, any>;

    const image = asString(legacy.profile_image_url_https);
    return {
      displayName: asString(legacy.name),
      bio: asString(legacy.description),
      followersCount: asNumber(legacy.followers_count),
      followingCount: asNumber(legacy.friends_count),
      profileImageUrl: image ? image.replace('_normal', '_400x400') : undefined,
    };
  }

  /** نگاشت آرایهٔ entries خام توییتر به `NormalizedContent`. */
  normalizeContent(raw: RawContent[], sourceId: number): NormalizedContent[] {
    if (!Array.isArray(raw)) return [];

    const out: NormalizedContent[] = [];
    for (const entry of raw) {
      const normalized = this.normalizeOne(entry, sourceId);
      if (normalized) out.push(normalized);
    }
    return out;
  }

  /** نگاشت یک entry/توییت خام؛ بدون rest_id یا legacy معتبر `null` برمی‌گرداند. */
  private normalizeOne(
    entry: RawContent,
    sourceId: number,
  ): NormalizedContent | null {
    const e = (entry ?? {}) as Record<string, any>;
    // entry ممکن است در شکل تودرتوی timeline باشد یا مستقیماً tweet result.
    const tweet =
      e.content?.itemContent?.tweet_results?.result ??
      e.tweet_results?.result ??
      e;

    if (!tweet || typeof tweet !== 'object') return null;
    const externalId = asString(tweet.rest_id);
    const legacy = tweet.legacy as Record<string, any> | undefined;
    if (!externalId || !legacy) return null;

    const caption = asString(legacy.full_text ?? legacy.text) ?? '';
    const publishedAt = legacy.created_at
      ? toDate(legacy.created_at)
      : undefined;

    const media = legacy.entities?.media;
    const firstMedia = Array.isArray(media) ? media[0] : undefined;
    const isVideo = firstMedia?.type === 'video';

    return {
      source_id: sourceId,
      external_id: externalId,
      content_type: isVideo ? 'video' : 'tweet',
      caption,
      media_url: asString(firstMedia?.media_url_https),
      metrics: {
        likes: asNumber(legacy.favorite_count) ?? 0,
        comments: asNumber(legacy.reply_count) ?? 0,
        shares: asNumber(legacy.retweet_count) ?? 0,
      },
      published_at: publishedAt,
    };
  }
}

/* ------------------------------------------------------------------ */
/* کمکی‌های نگاشت (خالص)                                                */
/* ------------------------------------------------------------------ */

/** تبدیل امن یک رشتهٔ تاریخ توییتر به Date (در صورت نامعتبر `undefined`). */
function toDate(value: unknown): Date | undefined {
  if (typeof value !== 'string') return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}
