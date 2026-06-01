import { Injectable } from '@nestjs/common';
import axios from 'axios';
import {
  getEnabledProviders,
  TwitterProvider as TwitterApiProvider,
} from '../../modules/twitter/twitter-providers.config';
import {
  classifyProviderError,
  CollectionProvider,
  FetchOptions,
  Platform,
  RawContent,
  RawProfile,
} from '../collection.types';

const REQUEST_TIMEOUT_MS = 30000;

/**
 * Provider توییتر/X (design §5.5 — `CollectionProvider`).
 *
 * منطق fetch توییتر را — که در مسیر legacy داخل `TwitterService` بود — به‌صورت
 * تمیز و fetch-only کپسوله می‌کند (بدون ذخیره در DB؛ ذخیره وظیفهٔ
 * `ContentService.upsertMany` است). از همان پیکربندی چندprovider ای موجود
 * (`twitter-providers.config`) با fallback بین provider ها استفاده می‌کند.
 *
 * **قرارداد خطا (Requirement 4.6):** پس از اتمام provider ها (یا خطای قطعی)،
 * خطا از طریق `classifyProviderError` به `CollectionProviderError` طبقه‌بندی‌شده
 * تبدیل و پرتاب می‌شود تا `CollectionService` آن را در summary بازتاب دهد.
 *
 * خروجی `fetchPosts` آرایه‌ای از entries در شکل
 * `timeline.instructions[].entries` است که `TwitterNormalizer` انتظار دارد.
 */
@Injectable()
export class TwitterProvider implements CollectionProvider {
  readonly platform: Platform = 'twitter';

  /** provider های فعال (مرتب بر اساس اولویت). */
  private get providers(): TwitterApiProvider[] {
    return getEnabledProviders();
  }

  /** واکشی پروفایل خام؛ خروجی شکل `{ result: { legacy: {...} } }`. */
  async fetchProfile(username: string): Promise<RawProfile> {
    const providers = this.providers;
    if (providers.length === 0) {
      throw classifyProviderError(
        new Error('No Twitter API providers configured'),
        this.platform,
      );
    }

    let lastError: unknown;
    for (const provider of providers) {
      try {
        const params = this.userParams(provider, username);
        const res = await axios.get(
          `https://${provider.apiHost}${provider.endpoints.user}`,
          {
            params,
            headers: this.headers(provider),
            timeout: REQUEST_TIMEOUT_MS,
          },
        );
        return (res.data ?? {}) as RawProfile;
      } catch (error) {
        lastError = error;
        if (!this.shouldFallback(error)) break;
      }
    }
    throw classifyProviderError(lastError, this.platform);
  }

  /** واکشی توییت‌های خام؛ خروجی آرایهٔ entries تخت‌شده. */
  async fetchPosts(
    username: string,
    opts?: FetchOptions,
  ): Promise<RawContent[]> {
    const providers = this.providers;
    if (providers.length === 0) {
      throw classifyProviderError(
        new Error('No Twitter API providers configured'),
        this.platform,
      );
    }

    const count = opts?.limit ?? 20;
    let lastError: unknown;
    for (const provider of providers) {
      try {
        const params = await this.tweetsParams(provider, username, count);
        const res = await axios.get(
          `https://${provider.apiHost}${provider.endpoints.userTweets}`,
          {
            params,
            headers: this.headers(provider),
            timeout: REQUEST_TIMEOUT_MS,
          },
        );
        return this.extractEntries(res.data);
      } catch (error) {
        lastError = error;
        if (!this.shouldFallback(error)) break;
      }
    }
    throw classifyProviderError(lastError, this.platform);
  }

  /* ---------------------------------------------------------------- */
  /* کمکی‌ها                                                          */
  /* ---------------------------------------------------------------- */

  private headers(provider: TwitterApiProvider): Record<string, string> {
    return {
      'x-rapidapi-key': provider.apiKey,
      'x-rapidapi-host': provider.apiHost,
    };
  }

  /** پارامتر username بر اساس قرارداد provider خاص. */
  private userParams(
    provider: TwitterApiProvider,
    username: string,
  ): Record<string, unknown> {
    if (provider.name === 'TwitterAPI45') return { screenname: username };
    return { username };
  }

  /** پارامترهای واکشی توییت بر اساس provider (برخی به user id نیاز دارند). */
  private async tweetsParams(
    provider: TwitterApiProvider,
    username: string,
    count: number,
  ): Promise<Record<string, unknown>> {
    if (provider.name === 'TwitterAPI45') {
      return { screenname: username };
    }
    if (provider.name === 'TheOldBird') {
      return {
        username,
        limit: count,
        include_replies: false,
        include_pinned: false,
      };
    }
    // Twitter241 و سایر provider ها به user id نیاز دارند.
    const profile = (await this.fetchProfile(username)) as Record<string, any>;
    const userId =
      profile?.result?.rest_id ??
      profile?.user?.rest_id ??
      profile?.user?.id ??
      profile?.result?.data?.user?.result?.rest_id;
    if (!userId) {
      throw new Error('Could not resolve Twitter user id from profile');
    }
    return { user: userId, count };
  }

  /**
   * تخت‌کردن پاسخ provider به آرایهٔ entries. شکل‌های مختلف provider پشتیبانی
   * می‌شوند؛ نگاشت نهایی فیلدها در `TwitterNormalizer` انجام می‌شود.
   */
  private extractEntries(data: unknown): RawContent[] {
    const d = (data ?? {}) as Record<string, any>;

    // شکل استاندارد تودرتو: result.timeline.instructions[].entries
    const instructions = d.result?.timeline?.instructions;
    if (Array.isArray(instructions)) {
      const entries: RawContent[] = [];
      for (const ins of instructions) {
        if (Array.isArray(ins?.entries)) entries.push(...ins.entries);
      }
      if (entries.length > 0) return entries;
    }

    // شکل تخت برخی provider ها: timeline یا tweets به‌صورت آرایهٔ توییت خام.
    const flat = d.timeline ?? d.tweets ?? d.results ?? d.data;
    if (Array.isArray(flat)) {
      return flat.map((tweet: Record<string, any>) => ({
        tweet_results: {
          result: {
            rest_id: tweet.tweet_id ?? tweet.id_str ?? tweet.rest_id,
            legacy: {
              full_text: tweet.text ?? tweet.full_text,
              favorite_count: tweet.likes ?? tweet.favorite_count ?? 0,
              retweet_count: tweet.retweets ?? tweet.retweet_count ?? 0,
              reply_count: tweet.replies ?? tweet.reply_count ?? 0,
              created_at: tweet.created_at ?? tweet.timestamp,
              entities: { media: normalizeFlatMedia(tweet) },
            },
          },
        },
      }));
    }

    return [];
  }

  /** آیا در صورت این خطا باید provider بعدی را امتحان کرد (rate-limit/5xx). */
  private shouldFallback(error: unknown): boolean {
    const status = (error as { response?: { status?: number } })?.response
      ?.status;
    return status === 429 || (typeof status === 'number' && status >= 500);
  }
}

/** نگاشت media تخت برخی provider ها به شکل استاندارد entities.media. */
function normalizeFlatMedia(tweet: Record<string, any>): Array<{
  media_url_https?: string;
  type?: string;
}> {
  const media = tweet.media;
  if (!media) return [];
  if (Array.isArray(media) && media.length > 0) {
    return [
      {
        media_url_https: media[0]?.url ?? media[0]?.media_url_https,
        type: media[0]?.type ?? 'photo',
      },
    ];
  }
  if (Array.isArray(media.photo) && media.photo.length > 0) {
    return [{ media_url_https: media.photo[0]?.media_url_https, type: 'photo' }];
  }
  if (Array.isArray(media.video) && media.video.length > 0) {
    return [{ media_url_https: media.video[0]?.media_url_https, type: 'video' }];
  }
  return [];
}
