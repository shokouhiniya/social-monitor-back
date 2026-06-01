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
 * Normalizer اینستاگرام (design §5.5 — `CollectionNormalizer`).
 *
 * خروجی خام provider اینستاگرام (instagram120) را به ساختار `NormalizedContent`
 * نگاشت می‌کند (Requirement 4.2). منطق نگاشت دقیقاً از مسیر legacy
 * `PageService.fetchPageData` استخراج شده (node.pk/code/caption/like_count/...)
 * اما به‌صورت تابع خالص و مقاوم در برابر دادهٔ ناقص بازنویسی شده است
 * (Requirement 4.7): آیتم فاقد `external_id` معتبر کنار گذاشته می‌شود (نه crash).
 */
@Injectable()
export class InstagramNormalizer implements CollectionNormalizer {
  readonly platform: Platform = 'instagram';

  /** نگاشت پروفایل خام instagram120 به `NormalizedProfile`. */
  normalizeProfile(raw: RawProfile): NormalizedProfile {
    const p = (raw ?? {}) as Record<string, any>;
    const edgeFollowedBy = p.edge_followed_by as { count?: number } | undefined;
    const edgeFollow = p.edge_follow as { count?: number } | undefined;

    return {
      displayName: asString(p.full_name),
      bio: asString(p.biography),
      followersCount: asNumber(edgeFollowedBy?.count ?? p.follower_count),
      followingCount: asNumber(edgeFollow?.count ?? p.following_count),
      profileImageUrl: asString(p.profile_pic_url_hd ?? p.profile_pic_url),
    };
  }

  /**
   * نگاشت آرایهٔ پست/ریل/استوری خام به `NormalizedContent`. آیتم‌های فاقد
   * `external_id` (مشتق از `pk`/`id`/`code`) کنار گذاشته می‌شوند.
   */
  normalizeContent(raw: RawContent[], sourceId: number): NormalizedContent[] {
    if (!Array.isArray(raw)) return [];

    const out: NormalizedContent[] = [];
    for (const entry of raw) {
      const normalized = this.normalizeOne(entry, sourceId);
      if (normalized) out.push(normalized);
    }
    return out;
  }

  /** نگاشت یک node خام؛ در صورت نبود external_id معتبر `null` برمی‌گرداند. */
  private normalizeOne(
    entry: RawContent,
    sourceId: number,
  ): NormalizedContent | null {
    // provider ممکن است node را در `node` بپیچد (الگوی edges[].node) یا مستقیم بدهد.
    const node = (
      entry && typeof entry === 'object' && 'node' in entry
        ? (entry as Record<string, any>).node
        : entry
    ) as Record<string, any> | null;

    if (!node || typeof node !== 'object') return null;

    const externalId = String(node.pk ?? node.id ?? '').split('_')[0];
    if (!externalId) return null;

    const caption = asString(node.caption?.text ?? node.caption) ?? '';
    const likes = asNumber(node.like_count);
    const comments = asNumber(node.comment_count);
    const views = asNumber(node.view_count ?? node.play_count);
    const publishedAt =
      typeof node.taken_at === 'number'
        ? new Date(node.taken_at * 1000)
        : undefined;

    return {
      source_id: sourceId,
      external_id: externalId,
      shortcode: asString(node.code) ?? externalId,
      content_type: derivePostType(node),
      caption,
      media_url: deriveMediaUrl(node),
      metrics: {
        likes: likes ?? 0,
        comments: comments ?? 0,
        views: views ?? 0,
      },
      published_at: publishedAt,
    };
  }
}

/* ------------------------------------------------------------------ */
/* کمکی‌های نگاشت (خالص)                                                */
/* ------------------------------------------------------------------ */

/** نگاشت media_type/product_type اینستاگرام به نوع محتوای استاندارد. */
function derivePostType(node: Record<string, any>): string {
  const mediaType = node.media_type; // 1=image, 2=video, 8=carousel
  const isClips = node.product_type === 'clips';
  if (mediaType === 2 || isClips) return isClips ? 'reel' : 'video';
  if (mediaType === 8) return 'carousel';
  return 'image';
}

/** استخراج بهترین URL رسانه از node (video → image → carousel). */
function deriveMediaUrl(node: Record<string, any>): string | undefined {
  if (Array.isArray(node.video_versions) && node.video_versions.length > 0) {
    return asString(node.video_versions[0]?.url);
  }
  const candidates = node.image_versions2?.candidates;
  if (Array.isArray(candidates) && candidates.length > 0) {
    return asString(candidates[0]?.url);
  }
  if (Array.isArray(node.carousel_media) && node.carousel_media.length > 0) {
    const first = node.carousel_media[0];
    if (Array.isArray(first?.video_versions) && first.video_versions.length > 0) {
      return asString(first.video_versions[0]?.url);
    }
    const firstCandidates = first?.image_versions2?.candidates;
    if (Array.isArray(firstCandidates) && firstCandidates.length > 0) {
      return asString(firstCandidates[0]?.url);
    }
  }
  return undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}
