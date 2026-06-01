/**
 * انواع و توابع خالص مشترک AiModule (design §5.6 و Requirement 5).
 *
 * این ماژول لایهٔ low-level ارتباط با OpenRouter است و **هیچ وابستگی به دامنه**
 * ندارد (نه Source، نه Content، نه Prompt — design §3.2 و Requirement 1.4). تنها
 * ورودی/خروجی خام مدل را مدیریت می‌کند: render تمپلیت، فراخوانی provider، retry/
 * timeout، JSON repair و schema validation و در نهایت نرمال‌سازی نتیجه به یک
 * `AiExecutionResult`.
 *
 * توابع خالص (`renderTemplate`, `repairAndParseJson`, `validateAgainstSchema`,
 * `classifyStatus`) عمداً از سرویس جدا شده‌اند تا بدون mock شبکه مستقیماً
 * تست‌پذیر باشند.
 */

/* ------------------------------------------------------------------ */
/* نوع‌های واسط (design §5.6)                                            */
/* ------------------------------------------------------------------ */

/** قالب پاسخ مدل؛ `json` یعنی خروجی ساختاریافته انتظار می‌رود. */
export type PromptResponseFormat = 'json' | 'text';

/**
 * توصیف‌گر سادهٔ schema خروجی (design §6.4 — `output_schema (jsonb)`).
 *
 * این یک JSON-shape descriptor سبک است (نه JSON-Schema کامل) تا اعتبارسنجی
 * عمل‌گرایانه بماند (Requirement 5.4). در صورت ارائه نشدن، هر JSON معتبری پذیرفته
 * می‌شود.
 *
 * نمونه:
 * ```jsonc
 * {
 *   "type": "object",
 *   "required": ["sentiment", "keywords"],
 *   "properties": {
 *     "sentiment": { "type": "object" },
 *     "keywords":  { "type": "array" }
 *   }
 * }
 * ```
 */
export interface OutputSchemaDescriptor {
  type?: 'object' | 'array' | 'string' | 'number' | 'boolean';
  /** کلیدهای الزامی هنگام `type: 'object'`. */
  required?: string[];
  /** توصیف‌گر نوع هر property (تنها `type` آن بررسی می‌شود). */
  properties?: Record<string, OutputSchemaDescriptor>;
  /** توصیف‌گر نوع آیتم‌ها هنگام `type: 'array'`. */
  items?: OutputSchemaDescriptor;
}

/**
 * نسخهٔ منجمدشدهٔ یک prompt که برای اجرا به `AiService` تزریق می‌شود (design
 * §5.6/§5.7). `AiModule` خودش نسخهٔ فعال را resolve نمی‌کند؛ این کار بر عهدهٔ
 * `PromptsModule`/`AnalysisModule` است (Requirement 1.4 — استقلال لایهٔ AI).
 */
export interface PromptVersionSnapshot {
  /** متن تمپلیت با placeholder های `{{var}}` یا `{var}`. */
  template: string;
  /** شناسهٔ مدل OpenRouter (مثلاً `google/gemini-2.5-pro`). */
  model: string;
  /** دمای نمونه‌گیری مدل (پیش‌فرض منطقی در سرویس اعمال می‌شود). */
  temperature?: number;
  /** قالب پاسخ مورد انتظار. */
  response_format?: PromptResponseFormat;
  /** دستورات تکمیلی که به انتهای تمپلیت رندرشده افزوده می‌شود. */
  extra_instructions?: string;
  /** توصیف‌گر schema خروجی برای اعتبارسنجی (اختیاری). */
  output_schema?: OutputSchemaDescriptor | null;
  /** شناسهٔ نسخهٔ prompt (برای ردیابی/لاگ — در این لایه استفادهٔ منطقی ندارد). */
  versionId?: number;
}

/** ارجاع اختیاری به موجودیت دامنه برای ردیابی (بدون coupling منطقی). */
export interface AiEntityRef {
  type: string;
  id: number;
}

/** ورودی اجرای یک prompt (design §5.6 — `AiExecutionRequest`). */
export interface AiExecutionRequest {
  promptKey: string;
  version: PromptVersionSnapshot;
  input: Record<string, unknown>;
  entityRef?: AiEntityRef;
}

/** وضعیت نرمال‌شدهٔ نتیجهٔ اجرا (Requirement 5.2). */
export const AI_EXECUTION_STATUSES = [
  'success',
  'validation_error',
  'provider_error',
  'timeout',
] as const;
export type AiExecutionStatus = (typeof AI_EXECUTION_STATUSES)[number];

/** آمار مصرف توکن/هزینه (در صورت ارائه توسط provider). */
export interface AiUsage {
  promptTokens: number;
  completionTokens: number;
  costEstimate?: number;
}

/**
 * نتیجهٔ نرمال‌شدهٔ یک اجرا (design §5.6 — `AiExecutionResult`).
 *
 * ناوردا‌های کلیدی (Requirement 5.2/5.4/5.5):
 *  - `status` همیشه دقیقاً یکی از چهار مقدار مجاز است.
 *  - `raw` همیشه یک `string` است (هرگز حذف نمی‌شود).
 *  - در `validation_error` آرایهٔ `validationErrors` غیرتهی است.
 *  - `durationMs` همیشه ≥ ۰ است.
 */
export interface AiExecutionResult {
  status: AiExecutionStatus;
  raw: string;
  parsed: unknown | null;
  validationErrors?: string[];
  usage?: AiUsage;
  durationMs: number;
  errorMessage?: string;
}

/* ------------------------------------------------------------------ */
/* render تمپلیت (تابع خالص)                                            */
/* ------------------------------------------------------------------ */

/**
 * جایگزینی placeholder های `{{key}}` و `{key}` با مقادیر `input`. مقادیر غیر
 * رشته‌ای به‌صورت JSON serialize می‌شوند. placeholder بدون مقدار متناظر دست‌نخورده
 * باقی می‌ماند (تا خطای خاموش رخ ندهد). `extra_instructions` در صورت وجود به
 * انتهای خروجی افزوده می‌شود.
 */
export function renderTemplate(
  template: string,
  input: Record<string, unknown>,
  extraInstructions?: string,
): string {
  const replaceKey = (raw: string, key: string): string => {
    const trimmed = key.trim();
    if (!(trimmed in input)) return raw;
    const value = input[trimmed];
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      return String(value);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  let rendered = (template ?? '')
    .replace(/\{\{\s*([\w.$-]+)\s*\}\}/g, (m, k) => replaceKey(m, k))
    .replace(/\{\s*([\w.$-]+)\s*\}/g, (m, k) => replaceKey(m, k));

  const extra = (extraInstructions ?? '').trim();
  if (extra) {
    rendered = `${rendered}\n\n${extra}`;
  }
  return rendered;
}

/* ------------------------------------------------------------------ */
/* JSON repair + parse (تابع خالص — Requirement 5.4)                    */
/* ------------------------------------------------------------------ */

/** نتیجهٔ تلاش برای استخراج و parse کردن JSON از متن خام مدل. */
export interface JsonRepairResult {
  /** آیا در نهایت یک JSON معتبر استخراج شد. */
  ok: boolean;
  /** مقدار parse‌شده در صورت موفقیت، در غیر این صورت null. */
  value: unknown | null;
  /** آیا برای رسیدن به نتیجه، repair لازم شد (fence/trailing-comma و …). */
  repaired: boolean;
}

/**
 * تلاش سبک برای استخراج و parse کردن JSON از خروجی خام مدل (Requirement 5.4).
 *
 * گام‌ها (به‌ترتیب، با fallback):
 *  1. parse مستقیم متن trim‌شده.
 *  2. حذف code-fence های markdown (```json … ```), سپس parse.
 *  3. استخراج اولین بلاک متوازن `{…}` یا `[…]`، سپس parse.
 *  4. حذف trailing comma های پیش از `}`/`]`، سپس parse.
 *
 * هر مرحله که از متن خام منحرف شود `repaired = true` می‌کند تا فراخواننده بداند
 * خروجی دقیقاً JSON خام نبوده است. این تابع خالص است و هرگز throw نمی‌کند.
 */
export function repairAndParseJson(raw: string): JsonRepairResult {
  const tryParse = (text: string): { ok: boolean; value: unknown } => {
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch {
      return { ok: false, value: null };
    }
  };

  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, value: null, repaired: false };
  }

  const trimmed = raw.trim();

  // 1) parse مستقیم
  const direct = tryParse(trimmed);
  if (direct.ok) return { ok: true, value: direct.value, repaired: false };

  // 2) حذف code-fence markdown
  const deFenced = stripCodeFences(trimmed);
  if (deFenced !== trimmed) {
    const parsed = tryParse(deFenced);
    if (parsed.ok) return { ok: true, value: parsed.value, repaired: true };
  }

  // 3) استخراج اولین بلاک JSON متوازن
  const candidate = extractFirstJsonBlock(deFenced);
  if (candidate !== null) {
    const parsed = tryParse(candidate);
    if (parsed.ok) return { ok: true, value: parsed.value, repaired: true };

    // 4) حذف trailing comma ها از داخل بلاک
    const noTrailing = removeTrailingCommas(candidate);
    if (noTrailing !== candidate) {
      const reparsed = tryParse(noTrailing);
      if (reparsed.ok)
        return { ok: true, value: reparsed.value, repaired: true };
    }
  }

  // 4b) تلاش نهایی: حذف trailing comma از کل متن de-fenced
  const noTrailingFull = removeTrailingCommas(deFenced);
  if (noTrailingFull !== deFenced) {
    const parsed = tryParse(noTrailingFull);
    if (parsed.ok) return { ok: true, value: parsed.value, repaired: true };
  }

  return { ok: false, value: null, repaired: true };
}

/** حذف code-fence های markdown مانند ```json … ``` یا ``` … ```. */
function stripCodeFences(text: string): string {
  const fenceMatch = text.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fenceMatch && fenceMatch[1]) {
    return fenceMatch[1].trim();
  }
  return text;
}

/**
 * استخراج اولین بلاک JSON متوازن (`{…}` یا `[…]`) با احترام به رشته‌های داخل
 * JSON و escape ها. اگر بلاک متوازنی یافت نشود `null` برمی‌گرداند.
 */
function extractFirstJsonBlock(text: string): string | null {
  const startObj = text.indexOf('{');
  const startArr = text.indexOf('[');
  let start = -1;
  let open = '{';
  let close = '}';

  if (startObj === -1 && startArr === -1) return null;
  if (startArr === -1 || (startObj !== -1 && startObj < startArr)) {
    start = startObj;
    open = '{';
    close = '}';
  } else {
    start = startArr;
    open = '[';
    close = ']';
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === open) {
      depth++;
    } else if (ch === close) {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

/** حذف trailing comma های پیش از `}` یا `]` (خارج از رشته‌ها). */
function removeTrailingCommas(text: string): string {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      result += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      result += ch;
      continue;
    }
    if (ch === ',') {
      // نگاه به جلو: اگر اولین کاراکتر غیر فاصله، `}` یا `]` باشد، کاما حذف شود.
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (j < text.length && (text[j] === '}' || text[j] === ']')) {
        continue; // skip این کاما
      }
    }
    result += ch;
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* اعتبارسنجی schema (تابع خالص — Requirement 5.4)                       */
/* ------------------------------------------------------------------ */

/** نوع زمان‌اجرای یک مقدار JSON برای تطبیق با توصیف‌گر schema. */
function jsonTypeOf(
  value: unknown,
): 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null' {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  const t = typeof value;
  if (t === 'object') return 'object';
  if (t === 'number') return 'number';
  if (t === 'boolean') return 'boolean';
  if (t === 'string') return 'string';
  // bigint/function/symbol/undefined → نامعتبر برای JSON
  return 'null';
}

/**
 * اعتبارسنجی عمل‌گرایانهٔ یک مقدار parse‌شده در برابر یک
 * `OutputSchemaDescriptor` (Requirement 5.4).
 *
 * فهرست خطاهای انسانی‌خوان برمی‌گرداند؛ آرایهٔ تهی یعنی معتبر. اگر `schema` ارائه
 * نشده باشد (`null`/`undefined`)، هر مقداری معتبر تلقی می‌شود (طراحی عمل‌گرایانه:
 * «اگر schema نباشد، هر JSON معتبر پذیرفته می‌شود»). این تابع بازگشتی است و
 * `properties`/`items`/`required` را بررسی می‌کند.
 */
export function validateAgainstSchema(
  value: unknown,
  schema?: OutputSchemaDescriptor | null,
  path = '$',
): string[] {
  if (schema === null || schema === undefined) return [];
  const errors: string[] = [];

  if (schema.type) {
    const actual = jsonTypeOf(value);
    if (actual !== schema.type) {
      errors.push(
        `${path}: انتظار نوع «${schema.type}» می‌رفت ولی «${actual}» دریافت شد`,
      );
      // اگر نوع پایه نخواند، بررسی فرزندان بی‌معنی است.
      return errors;
    }
  }

  if (schema.type === 'object' || (!schema.type && isPlainObject(value))) {
    const obj = (value ?? {}) as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!(key in obj)) {
        errors.push(`${path}.${key}: فیلد الزامی موجود نیست`);
      }
    }
    if (schema.properties) {
      for (const [key, sub] of Object.entries(schema.properties)) {
        if (key in obj) {
          errors.push(
            ...validateAgainstSchema(obj[key], sub, `${path}.${key}`),
          );
        }
      }
    }
  }

  if (schema.type === 'array' && schema.items && Array.isArray(value)) {
    value.forEach((item, idx) => {
      errors.push(
        ...validateAgainstSchema(item, schema.items, `${path}[${idx}]`),
      );
    });
  }

  return errors;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' && value !== null && !Array.isArray(value)
  );
}

/* ------------------------------------------------------------------ */
/* نرمال‌سازی status (تابع خالص — Requirement 5.2)                        */
/* ------------------------------------------------------------------ */

/** دسته‌بندی خام نتیجهٔ یک تلاش provider، پیش از تصمیم نهایی دربارهٔ status. */
export interface StatusClassificationInput {
  /** آیا فراخوانی provider با خطا/استثنا مواجه شد. */
  providerErrored: boolean;
  /** آیا خطای provider از نوع timeout بود (پس از پایان retryها). */
  isTimeout: boolean;
  /** آیا خروجی مدل با موفقیت به JSON معتبر parse شد (پس از repair). */
  parsedOk: boolean;
  /** فهرست خطاهای اعتبارسنجی schema (در صورت parse موفق). */
  validationErrors: string[];
  /** آیا قالب پاسخ ساختاریافته (`json`) انتظار می‌رفت. */
  expectsJson: boolean;
}

/**
 * نرمال‌سازی نتیجه به یکی از چهار مقدار مجاز `status` (Requirement 5.2).
 *
 * اولویت‌بندی:
 *  1. خطای provider از نوع timeout → `timeout` (Requirement 5.3).
 *  2. سایر خطاهای provider → `provider_error` (Requirement 5.7).
 *  3. خروجی JSON مورد انتظار ولی parse‌نشده، یا parse‌شده با خطای schema →
 *     `validation_error` (Requirement 5.4).
 *  4. در غیر این صورت → `success`.
 */
export function classifyStatus(
  input: StatusClassificationInput,
): AiExecutionStatus {
  if (input.providerErrored) {
    return input.isTimeout ? 'timeout' : 'provider_error';
  }
  if (input.expectsJson) {
    if (!input.parsedOk) return 'validation_error';
    if (input.validationErrors.length > 0) return 'validation_error';
  } else {
    // قالب متنی: تنها در صورتی validation_error که schema تعریف شده و خطا داشته باشد.
    if (input.parsedOk && input.validationErrors.length > 0) {
      return 'validation_error';
    }
  }
  return 'success';
}

/* ------------------------------------------------------------------ */
/* backoff (تابع خالص — Requirement 5.3)                                */
/* ------------------------------------------------------------------ */

/**
 * محاسبهٔ تأخیر backoff نمایی برای تلاش شمارهٔ `attempt` (۰-based).
 * `base * 2^attempt` با سقف `max`. تابع خالص و قابل‌تست.
 */
export function backoffDelayMs(
  attempt: number,
  baseMs = 500,
  maxMs = 8000,
): number {
  const safeAttempt = Math.max(0, Math.floor(attempt));
  const delay = baseMs * Math.pow(2, safeAttempt);
  return Math.min(delay, maxMs);
}
