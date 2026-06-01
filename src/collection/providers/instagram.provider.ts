import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { SettingsService } from '../../modules/settings/settings.service';
import {
  classifyProviderError,
  CollectionProvider,
  FetchOptions,
  Platform,
  RawContent,
  RawProfile,
} from '../collection.types';

/** میزبان و endpoint های instagram120 (مطابق مسیر legacy `PageService`). */
const IG_HOST = 'instagram120.p.rapidapi.com';
const IG_BASE = `https://${IG_HOST}`;
const PROFILE_TIMEOUT_MS = 20000;
const POSTS_TIMEOUT_MS = 30000;

/**
 * Provider اینستاگرام (design §5.5 — `CollectionProvider`).
 *
 * این provider منطق fetch اینستاگرام را — که در مسیر legacy داخل
 * `PageService.fetchPageData` قرار داشت — به‌صورت تمیز و جداشده کپسوله می‌کند
 * (design §1.1 — «استخراج منطق fetch از PageService»). کلید RapidAPI از
 * `SettingsService` (و در نبود آن از env) resolve می‌شود؛ دقیقاً مانند legacy.
 *
 * **قرارداد خطا (Requirement 4.6):** هر خطای پلتفرم (rate-limit/خصوصی/timeout)
 * از طریق `classifyProviderError` به یک `CollectionProviderError` طبقه‌بندی‌شده
 * تبدیل و پرتاب می‌شود؛ `CollectionService` آن را گرفته و در summary بازتاب
 * می‌دهد (نه نشت استثنای خام). مسیر legacy `PageService` دست‌نخورده می‌ماند.
 *
 * نکته: این provider داده را واکشی می‌کند ولی **مدیا را دانلود نمی‌کند**؛ دانلود
 * مدیا یک نگرانی جداگانه است و در مسیر legacy باقی می‌ماند تا این لایه سبک و
 * تست‌پذیر بماند.
 */
@Injectable()
export class InstagramProvider implements CollectionProvider {
  readonly platform: Platform = 'instagram';

  constructor(private readonly settingsService: SettingsService) {}

  /** هدرهای instagram120 با کلید resolve‌شده. */
  private async headers(): Promise<Record<string, string>> {
    const key =
      (await this.settingsService.get('rapidapi_key')) ||
      process.env.RAPIDAPI_KEY ||
      '';
    return {
      'Content-Type': 'application/json',
      'x-rapidapi-key': key,
      'x-rapidapi-host': IG_HOST,
    };
  }

  /** واکشی پروفایل خام؛ خروجی `response.data.result`. */
  async fetchProfile(username: string): Promise<RawProfile> {
    try {
      const headers = await this.headers();
      const res = await axios.post(
        `${IG_BASE}/api/instagram/profile`,
        { username },
        { headers, timeout: PROFILE_TIMEOUT_MS },
      );
      const profile = res.data?.result;
      if (!profile) {
        // پاسخ بدون پروفایل معتبر = پروفایل نامعتبر/خصوصی.
        throw new Error('Invalid profile response from API');
      }
      return profile as RawProfile;
    } catch (error) {
      throw classifyProviderError(error, this.platform);
    }
  }

  /** واکشی پست‌های خام؛ خروجی آرایهٔ `edges` (هر کدام شامل `node`). */
  async fetchPosts(
    username: string,
    _opts?: FetchOptions,
  ): Promise<RawContent[]> {
    try {
      const headers = await this.headers();
      const res = await axios.post(
        `${IG_BASE}/api/instagram/posts`,
        { username, maxId: '' },
        { headers, timeout: POSTS_TIMEOUT_MS },
      );
      const edges = res.data?.result?.edges;
      return Array.isArray(edges) ? (edges as RawContent[]) : [];
    } catch (error) {
      throw classifyProviderError(error, this.platform);
    }
  }
}
