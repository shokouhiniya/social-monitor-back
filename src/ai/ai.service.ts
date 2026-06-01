import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import axios, { AxiosError } from 'axios';
import { Repository } from 'typeorm';
import { SettingsService } from '../modules/settings/settings.service';
import { AiExecutionLog } from './ai-execution-log.entity';
import {
  AiExecutionRequest,
  AiExecutionResult,
  AiUsage,
  backoffDelayMs,
  classifyStatus,
  renderTemplate,
  repairAndParseJson,
  validateAgainstSchema,
} from './ai.types';

/** endpoint رسمی OpenRouter (mirror مسیر legacy `PageService`/`PostService`). */
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/** پیکربندی اجرای پیش‌فرض AiService (قابل override در سازنده برای تست). */
export interface AiServiceConfig {
  /** مهلت هر فراخوانی منفرد provider (ms). */
  requestTimeoutMs: number;
  /** بیشینهٔ تعداد تلاش (شامل تلاش اول). */
  maxAttempts: number;
  /** پایهٔ تأخیر backoff (ms). */
  backoffBaseMs: number;
  /** سقف تأخیر backoff (ms). */
  backoffMaxMs: number;
  /** دمای پیش‌فرض در نبود مقدار در snapshot. */
  defaultTemperature: number;
  /** مدل پیش‌فرض در نبود مقدار در snapshot. */
  fallbackModel: string;
}

const DEFAULT_CONFIG: AiServiceConfig = {
  requestTimeoutMs: 120000, // ۲ دقیقه — مدل‌های reasoning زمان بیشتری نیاز دارند
  maxAttempts: 3,
  backoffBaseMs: 500,
  backoffMaxMs: 8000,
  defaultTemperature: 0.3,
  fallbackModel: 'google/gemini-2.5-pro',
};

/** نتیجهٔ داخلی یک تلاش provider. */
interface ProviderAttempt {
  raw: string;
  usage?: AiUsage;
}

/**
 * AiService — لایهٔ low-level ارتباط با OpenRouter (design §5.6، Requirement 5).
 *
 * **استقلال کامل از دامنه (Requirement 1.4 / design §3.2):** این سرویس هیچ
 * وابستگی به Source/Content/Prompt ندارد. تنها به `SettingsModule` برای resolve
 * کلید/مدل وابسته است. نسخهٔ prompt به‌صورت snapshot از بیرون تزریق می‌شود.
 *
 * **قرارداد خروجی:** `execute` هرگز throw نمی‌کند؛ همیشه یک `AiExecutionResult`
 * با `status` نرمال‌شده و `raw` به‌صورت string برمی‌گرداند (Requirement 5.2/5.5/
 * 5.7). خطای خام axios/provider هرگز به فراخواننده نشت نمی‌کند.
 *
 * **ثبت لاگ (Requirement 5.6):** در پایان هر اجرا (موفق یا ناموفق) یک رکورد در
 * `ai_execution_logs` ثبت می‌شود. این ثبت **best-effort** است: هرگز نتیجهٔ
 * بازگشتی را تغییر نمی‌دهد و در صورت خطای پایگاه‌داده throw نمی‌کند (تنها warning
 * لاگ می‌شود). repository به‌صورت `@Optional()` تزریق می‌شود تا تست‌های واحدی که
 * سرویس را بدون repository می‌سازند هم‌چنان کار کنند (در نبود repository، ثبت لاگ
 * صرفاً نادیده گرفته می‌شود).
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly config: AiServiceConfig;

  constructor(
    private readonly settingsService: SettingsService,
    @Optional()
    config?: Partial<AiServiceConfig>,
    @Optional()
    @InjectRepository(AiExecutionLog)
    private readonly executionLogRepository?: Repository<AiExecutionLog>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...(config ?? {}) };
  }

  /**
   * اجرای یک prompt با snapshot نسخهٔ آن (Requirement 5.1).
   *
   * جریان: render تمپلیت → فراخوانی OpenRouter با retry/backoff/timeout →
   * JSON repair → schema validation → نرمال‌سازی به `AiExecutionResult` → ثبت
   * best-effort لاگ در `ai_execution_logs` (Requirement 5.6).
   *
   * قرارداد: این متد هرگز throw نمی‌کند و نتیجهٔ بازگشتی مستقل از موفقیت/شکست
   * ثبت لاگ است.
   */
  async execute(request: AiExecutionRequest): Promise<AiExecutionResult> {
    const prompt = renderTemplate(
      request.version.template ?? '',
      request.input ?? {},
      request.version.extra_instructions,
    );

    const result = await this.computeResult(request, prompt);

    // ثبت لاگ در پایان هر اجرا — موفق یا ناموفق (Requirement 5.6). best-effort:
    // نتیجهٔ بازگشتی را تغییر نمی‌دهد و در صورت خطا throw نمی‌کند.
    await this.logExecution(request, prompt, result);

    return result;
  }

  /**
   * هستهٔ منطق اجرا: render شده به prompt تزریق می‌شود و نتیجهٔ نرمال‌شده
   * برمی‌گردد. این متد هرگز throw نمی‌کند (Requirement 5.7).
   */
  private async computeResult(
    request: AiExecutionRequest,
    prompt: string,
  ): Promise<AiExecutionResult> {
    const startedAt = Date.now();
    const { version } = request;
    const expectsJson = version.response_format !== 'text';

    let attempt: ProviderAttempt | null = null;
    let providerErrored = false;
    let isTimeout = false;
    let errorMessage: string | undefined;

    try {
      attempt = await this.callWithRetry(prompt, version.model);
    } catch (error) {
      // هیچ استثنای خامی نشت نمی‌کند (Requirement 5.7).
      providerErrored = true;
      isTimeout = this.isTimeoutError(error);
      errorMessage = this.describeError(error);
      this.logger.warn(
        `AiService.execute provider error for promptKey="${request.promptKey}": ${errorMessage}`,
      );
    }

    // raw همیشه string است (Requirement 5.5).
    const raw = attempt?.raw ?? '';

    // در صورت خطای provider، مسیر parse/validate طی نمی‌شود.
    if (providerErrored) {
      const status = classifyStatus({
        providerErrored: true,
        isTimeout,
        parsedOk: false,
        validationErrors: [],
        expectsJson,
      });
      return this.finalize({
        status,
        raw,
        parsed: null,
        usage: undefined,
        startedAt,
        errorMessage:
          errorMessage ??
          (isTimeout ? 'اجرای مدل به مهلت تعیین‌شده نرسید' : 'خطای provider'),
      });
    }

    // قالب متنی: بدون parse JSON، خروجی خام موفق است (مگر schema تعریف شده باشد).
    if (!expectsJson && !version.output_schema) {
      return this.finalize({
        status: 'success',
        raw,
        parsed: raw,
        usage: attempt?.usage,
        startedAt,
      });
    }

    // JSON repair + parse (Requirement 5.4).
    const repaired = repairAndParseJson(raw);
    const validationErrors = repaired.ok
      ? validateAgainstSchema(repaired.value, version.output_schema)
      : [];

    const status = classifyStatus({
      providerErrored: false,
      isTimeout: false,
      parsedOk: repaired.ok,
      validationErrors,
      expectsJson,
    });

    if (status === 'validation_error') {
      // فهرست غیرتهی validationErrors تضمین می‌شود (Requirement 5.4).
      const errors = repaired.ok
        ? validationErrors
        : ['خروجی مدل به JSON معتبر تبدیل نشد (پس از تلاش JSON repair)'];
      return this.finalize({
        status,
        raw,
        parsed: repaired.ok ? repaired.value : null,
        usage: attempt?.usage,
        startedAt,
        validationErrors:
          errors.length > 0 ? errors : ['خروجی مدل با schema هم‌خوان نیست'],
        errorMessage: 'خروجی مدل با schema خروجی هم‌خوان نبود',
      });
    }

    return this.finalize({
      status: 'success',
      raw,
      parsed: repaired.ok ? repaired.value : raw,
      usage: attempt?.usage,
      startedAt,
    });
  }

  /* ---------------------------------------------------------------- */
  /* ثبت لاگ اجرا (Requirement 5.6)                                     */
  /* ---------------------------------------------------------------- */

  /**
   * ثبت best-effort یک رکورد در `ai_execution_logs` در پایان هر اجرا
   * (Requirement 5.6).
   *
   * ناوردا‌ها:
   *  - هرگز throw نمی‌کند و نتیجهٔ بازگشتی `execute` را تغییر نمی‌دهد.
   *  - اگر repository تزریق نشده باشد (مثلاً در تست‌های واحد که سرویس را بدون
   *    repository می‌سازند)، صرفاً نادیده گرفته می‌شود.
   *  - خطای پایگاه‌داده تنها به‌صورت warning لاگ می‌شود.
   */
  private async logExecution(
    request: AiExecutionRequest,
    prompt: string,
    result: AiExecutionResult,
  ): Promise<void> {
    const repo = this.executionLogRepository;
    if (!repo) return; // بدون repository، ثبت لاگ نادیده گرفته می‌شود.

    try {
      const usage = result.usage;
      const entity = repo.create({
        prompt_key: request.promptKey,
        prompt_version_id: request.version.versionId ?? null,
        model: request.version.model || null,
        input_summary: this.summarizeInput(prompt, request.input),
        input_hash: this.hashInput(prompt),
        raw_input: prompt,
        raw_output: result.raw,
        parsed_output: result.parsed ?? null,
        status: result.status,
        error_message: result.errorMessage ?? null,
        duration_ms: result.durationMs,
        token_usage: usage ?? null,
        cost_estimate: usage?.costEstimate ?? null,
        entity_type: request.entityRef?.type ?? null,
        entity_id:
          request.entityRef?.id !== undefined &&
          request.entityRef?.id !== null
            ? String(request.entityRef.id)
            : null,
      });
      await repo.save(entity);
    } catch (error) {
      // ثبت لاگ نباید جریان اصلی را بشکند (Requirement 5.6 — best-effort).
      this.logger.warn(
        `ثبت لاگ اجرای AI برای promptKey="${request.promptKey}" ناموفق بود: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /** بیشینهٔ طول `input_summary` ذخیره‌شده (برش برای جلوگیری از حجم زیاد). */
  private static readonly INPUT_SUMMARY_MAX = 500;

  /**
   * ساخت خلاصهٔ کوتاه از ورودی برای ستون `input_summary`. ترجیحاً از prompt
   * رندرشده استفاده می‌شود؛ در نبود آن از serialize ورودی خام. خروجی به
   * `INPUT_SUMMARY_MAX` کاراکتر برش می‌خورد.
   */
  private summarizeInput(
    prompt: string,
    input: Record<string, unknown> | undefined,
  ): string | null {
    let text = (prompt ?? '').trim();
    if (!text) {
      try {
        text = JSON.stringify(input ?? {});
      } catch {
        text = String(input ?? '');
      }
    }
    if (!text) return null;
    return text.length > AiService.INPUT_SUMMARY_MAX
      ? `${text.slice(0, AiService.INPUT_SUMMARY_MAX)}…`
      : text;
  }

  /** هش پایدار (sha256) از prompt رندرشده برای ردیابی/دِدوپ ورودی‌ها. */
  private hashInput(prompt: string): string {
    return createHash('sha256')
      .update(prompt ?? '', 'utf8')
      .digest('hex');
  }

  /* ---------------------------------------------------------------- */
  /* فراخوانی provider با retry/backoff/timeout                         */
  /* ---------------------------------------------------------------- */

  /**
   * فراخوانی OpenRouter با retry محدود همراه با backoff (Requirement 5.3).
   * تنها خطاهای گذرا (timeout / 429 / 5xx / شبکه) retry می‌شوند؛ خطاهای دائمی
   * (4xx غیر از 429) بلافاصله پرتاب می‌شوند. آخرین خطا در صورت اتمام تلاش‌ها
   * پرتاب می‌شود تا توسط `execute` گرفته و نرمال شود.
   */
  private async callWithRetry(
    prompt: string,
    model: string,
  ): Promise<ProviderAttempt> {
    const { apiKey, resolvedModel } = await this.resolveCredentials(model);
    let lastError: unknown;

    for (let attempt = 0; attempt < this.config.maxAttempts; attempt++) {
      try {
        return await this.callOpenRouter(prompt, resolvedModel, apiKey);
      } catch (error) {
        lastError = error;
        const transient = this.isRetryableError(error);
        const hasMoreAttempts = attempt < this.config.maxAttempts - 1;
        if (!transient || !hasMoreAttempts) {
          throw error;
        }
        await this.sleep(
          backoffDelayMs(
            attempt,
            this.config.backoffBaseMs,
            this.config.backoffMaxMs,
          ),
        );
      }
    }
    // غیرقابل‌دسترس منطقی؛ برای رضایت type.
    throw lastError ?? new Error('AiService: exhausted retries');
  }

  /** یک فراخوانی منفرد OpenRouter و استخراج محتوای پاسخ. */
  private async callOpenRouter(
    prompt: string,
    model: string,
    apiKey: string,
  ): Promise<ProviderAttempt> {
    const response = await axios.post(
      OPENROUTER_URL,
      {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: this.config.defaultTemperature,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: this.config.requestTimeoutMs,
      },
    );

    const choice = response.data?.choices?.[0];
    // برخی مدل‌ها (Gemini 2.5 Pro) محتوا را در `content` یا فقط `reasoning` می‌گذارند.
    const content: string =
      choice?.message?.content || choice?.message?.reasoning || '';

    if (!content) {
      // پاسخ تهی = خطای provider (نه validation)؛ به‌صورت گذرا تلقی می‌شود.
      throw new Error(
        'OpenRouter returned empty response (no content/reasoning)',
      );
    }

    return {
      raw: content,
      usage: this.extractUsage(response.data?.usage),
    };
  }

  /** resolve کلید و مدل از SettingsService با fallback به env و پیش‌فرض. */
  private async resolveCredentials(
    model: string,
  ): Promise<{ apiKey: string; resolvedModel: string }> {
    const apiKey =
      (await this.settingsService.get('openrouter_key')) ||
      process.env.OPENROUTER_API_KEY ||
      '';
    const resolvedModel = model || this.config.fallbackModel;
    return { apiKey, resolvedModel };
  }

  /** نگاشت بخش usage پاسخ OpenRouter به `AiUsage`. */
  private extractUsage(usage: unknown): AiUsage | undefined {
    if (!usage || typeof usage !== 'object') return undefined;
    const u = usage as Record<string, unknown>;
    const promptTokens = Number(u.prompt_tokens ?? u.promptTokens ?? 0);
    const completionTokens = Number(
      u.completion_tokens ?? u.completionTokens ?? 0,
    );
    const cost = u.cost ?? u.total_cost ?? u.costEstimate;
    const result: AiUsage = {
      promptTokens: Number.isFinite(promptTokens) ? promptTokens : 0,
      completionTokens: Number.isFinite(completionTokens)
        ? completionTokens
        : 0,
    };
    if (cost !== undefined && Number.isFinite(Number(cost))) {
      result.costEstimate = Number(cost);
    }
    return result;
  }

  /* ---------------------------------------------------------------- */
  /* طبقه‌بندی خطا                                                      */
  /* ---------------------------------------------------------------- */

  /** آیا خطا گذرا (قابل retry) است: timeout / 429 / 5xx / خطای شبکه. */
  private isRetryableError(error: unknown): boolean {
    if (this.isTimeoutError(error)) return true;
    const status = this.statusOf(error);
    if (status === undefined) {
      // خطای شبکه بدون status (ECONNRESET و …) گذرا تلقی می‌شود.
      return this.isNetworkError(error);
    }
    return status === 429 || status >= 500;
  }

  /** تشخیص خطای timeout (axios `ECONNABORTED`/`ETIMEDOUT` یا پیام timeout). */
  private isTimeoutError(error: unknown): boolean {
    const err = error as Partial<AxiosError> & {
      code?: string;
      message?: string;
    };
    const code = String(err?.code ?? '').toUpperCase();
    if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') return true;
    const message = String(err?.message ?? '').toLowerCase();
    return message.includes('timeout') || message.includes('timed out');
  }

  /** آیا خطا یک خطای شبکهٔ بدون پاسخ HTTP است. */
  private isNetworkError(error: unknown): boolean {
    const err = error as Partial<AxiosError> & { code?: string };
    if (this.statusOf(error) !== undefined) return false;
    const code = String(err?.code ?? '').toUpperCase();
    return (
      code === 'ECONNRESET' ||
      code === 'ENOTFOUND' ||
      code === 'ECONNREFUSED' ||
      code === 'EAI_AGAIN' ||
      // خطای axios بدون response معمولاً شبکه‌ای است.
      Boolean((err as AxiosError)?.isAxiosError && !(err as AxiosError).response)
    );
  }

  /** استخراج status code از خطای axios در صورت وجود. */
  private statusOf(error: unknown): number | undefined {
    const err = error as Partial<AxiosError>;
    const status = err?.response?.status;
    return typeof status === 'number' ? status : undefined;
  }

  /** ساخت پیام خطای انسانی‌خوان بدون نشت آبجکت خام provider. */
  private describeError(error: unknown): string {
    if (this.isTimeoutError(error)) {
      return 'اجرای مدل به مهلت تعیین‌شده نرسید (timeout)';
    }
    const status = this.statusOf(error);
    const err = error as Partial<AxiosError> & { message?: string };
    const base =
      typeof err?.message === 'string' && err.message
        ? err.message
        : 'خطای ناشناختهٔ provider';
    return status !== undefined ? `provider HTTP ${status}: ${base}` : base;
  }

  /* ---------------------------------------------------------------- */
  /* کمک‌کننده‌ها                                                       */
  /* ---------------------------------------------------------------- */

  /**
   * ساخت نتیجهٔ نهایی با تضمین ناوردا‌ها: `raw` رشته، `durationMs ≥ 0` و حذف
   * فیلدهای undefined.
   */
  private finalize(params: {
    status: AiExecutionResult['status'];
    raw: string;
    parsed: unknown | null;
    usage?: AiUsage;
    startedAt: number;
    validationErrors?: string[];
    errorMessage?: string;
  }): AiExecutionResult {
    const durationMs = Math.max(0, Date.now() - params.startedAt);
    const result: AiExecutionResult = {
      status: params.status,
      raw: typeof params.raw === 'string' ? params.raw : '',
      parsed: params.parsed ?? null,
      durationMs,
    };
    if (params.validationErrors && params.validationErrors.length > 0) {
      result.validationErrors = params.validationErrors;
    }
    if (params.usage) result.usage = params.usage;
    if (params.errorMessage) result.errorMessage = params.errorMessage;
    return result;
  }

  /** sleep قابل override در تست برای جلوگیری از تأخیر واقعی. */
  protected sleep(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
