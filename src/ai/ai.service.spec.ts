import axios from 'axios';
import { AiService } from './ai.service';
import { AiExecutionRequest, PromptVersionSnapshot } from './ai.types';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * تست واحد AiService — نرمال‌سازی status و ناوردا‌های خروجی (Requirement 5.1-5.7).
 *
 * axios به‌صورت کامل mock می‌شود تا هیچ فراخوانی شبکهٔ واقعی انجام نشود. تمرکز
 * تست‌ها بر قرارداد `AiExecutionResult` است:
 *  - status دقیقاً یکی از چهار مقدار مجاز (Req 5.2)
 *  - timeout پس از retry با backoff (Req 5.3)
 *  - validation_error با تلاش JSON repair و فهرست غیرتهی (Req 5.4)
 *  - provider_error بدون نشت استثنای خام (Req 5.7)
 *  - raw همیشه string (Req 5.5)
 */
describe('AiService', () => {
  let service: AiService;

  const settings = {
    // کلید را از تنظیمات می‌دهیم تا منطق resolve طی شود.
    get: jest.fn().mockResolvedValue('test-openrouter-key'),
  };

  // پیکربندی سریع برای تست: backoff صفر، حداکثر ۳ تلاش.
  const fastConfig = {
    requestTimeoutMs: 1000,
    maxAttempts: 3,
    backoffBaseMs: 0,
    backoffMaxMs: 0,
    defaultTemperature: 0.3,
    fallbackModel: 'test/model',
  };

  const jsonVersion: PromptVersionSnapshot = {
    template: 'تحلیل کن: {text}',
    model: 'test/model',
    response_format: 'json',
    output_schema: {
      type: 'object',
      required: ['sentiment'],
      properties: { sentiment: { type: 'object' } },
    },
  };

  const makeRequest = (
    version: PromptVersionSnapshot = jsonVersion,
  ): AiExecutionRequest => ({
    promptKey: 'content_analysis',
    version,
    input: { text: 'متن نمونه' },
  });

  /** ساخت یک پاسخ OpenRouter موفق با محتوای دلخواه. */
  const okResponse = (content: string, usage?: unknown) => ({
    data: {
      choices: [{ message: { content } }],
      usage,
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    settings.get.mockResolvedValue('test-openrouter-key');
    service = new AiService(settings as never, fastConfig);
  });

  it('returns status=success with parsed JSON when output matches schema (Req 5.1/5.2)', async () => {
    mockedAxios.post.mockResolvedValueOnce(
      okResponse('{"sentiment": {"score": 0.8}}', {
        prompt_tokens: 10,
        completion_tokens: 20,
      }),
    );

    const result = await service.execute(makeRequest());

    expect(result.status).toBe('success');
    expect(result.parsed).toEqual({ sentiment: { score: 0.8 } });
    expect(typeof result.raw).toBe('string');
    expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 20 });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });

  it('repairs fenced JSON and still succeeds (Req 5.4 repair path)', async () => {
    mockedAxios.post.mockResolvedValueOnce(
      okResponse('```json\n{"sentiment": {"score": 1}}\n```'),
    );

    const result = await service.execute(makeRequest());

    expect(result.status).toBe('success');
    expect(result.parsed).toEqual({ sentiment: { score: 1 } });
  });

  it('returns validation_error with a non-empty validationErrors array when JSON cannot be parsed (Req 5.4/5.5)', async () => {
    mockedAxios.post.mockResolvedValueOnce(
      okResponse('این یک پاسخ متنی بدون JSON است'),
    );

    const result = await service.execute(makeRequest());

    expect(result.status).toBe('validation_error');
    expect(Array.isArray(result.validationErrors)).toBe(true);
    expect(result.validationErrors!.length).toBeGreaterThan(0);
    // raw حفظ می‌شود حتی وقتی parse شکست می‌خورد (Req 5.5).
    expect(result.raw).toBe('این یک پاسخ متنی بدون JSON است');
    expect(result.parsed).toBeNull();
  });

  it('returns validation_error when parsed JSON violates the schema (Req 5.4)', async () => {
    // فاقد کلید الزامی `sentiment`.
    mockedAxios.post.mockResolvedValueOnce(okResponse('{"keywords": ["a"]}'));

    const result = await service.execute(makeRequest());

    expect(result.status).toBe('validation_error');
    expect(result.validationErrors!.length).toBeGreaterThan(0);
    expect(result.parsed).toEqual({ keywords: ['a'] });
  });

  it('returns status=timeout after bounded retries with backoff (Req 5.3)', async () => {
    const timeoutErr = Object.assign(new Error('timeout of 1000ms exceeded'), {
      code: 'ECONNABORTED',
      isAxiosError: true,
    });
    mockedAxios.post.mockRejectedValue(timeoutErr);

    const result = await service.execute(makeRequest());

    expect(result.status).toBe('timeout');
    expect(result.errorMessage).toBeDefined();
    expect(result.raw).toBe(''); // همیشه string (Req 5.5)
    // تلاش اولیه + ۲ retry = ۳ بار (Req 5.3 — retry محدود).
    expect(mockedAxios.post).toHaveBeenCalledTimes(3);
  });

  it('returns status=provider_error for a permanent 4xx without leaking the raw exception (Req 5.7)', async () => {
    const httpErr = Object.assign(new Error('Request failed with status code 400'), {
      isAxiosError: true,
      response: { status: 400, data: { error: 'bad request' } },
    });
    mockedAxios.post.mockRejectedValue(httpErr);

    const result = await service.execute(makeRequest());

    expect(result.status).toBe('provider_error');
    expect(result.errorMessage).toContain('400');
    expect(result.raw).toBe('');
    // 4xx غیر گذرا → بدون retry.
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });

  it('retries transient 5xx then succeeds (Req 5.3 retry of transient errors)', async () => {
    const serverErr = Object.assign(new Error('Request failed with status code 503'), {
      isAxiosError: true,
      response: { status: 503, data: {} },
    });
    mockedAxios.post
      .mockRejectedValueOnce(serverErr)
      .mockResolvedValueOnce(okResponse('{"sentiment": {"score": 0}}'));

    const result = await service.execute(makeRequest());

    expect(result.status).toBe('success');
    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
  });

  it('treats an empty provider response as provider_error (no content leaks)', async () => {
    mockedAxios.post.mockResolvedValue(okResponse(''));

    const result = await service.execute(makeRequest());

    // پاسخ تهی → خطای گذرا که پس از اتمام retryها provider_error می‌شود.
    expect(result.status).toBe('provider_error');
    expect(result.raw).toBe('');
  });

  it('keeps raw as a string in every branch (Req 5.5 invariant)', async () => {
    // success
    mockedAxios.post.mockResolvedValueOnce(
      okResponse('{"sentiment": {"x": 1}}'),
    );
    const ok = await service.execute(makeRequest());
    expect(typeof ok.raw).toBe('string');

    // provider error
    mockedAxios.post.mockRejectedValue(
      Object.assign(new Error('boom'), {
        isAxiosError: true,
        response: { status: 400 },
      }),
    );
    const err = await service.execute(makeRequest());
    expect(typeof err.raw).toBe('string');
  });

  it('handles a plain-text prompt (response_format=text) without JSON parsing', async () => {
    mockedAxios.post.mockResolvedValueOnce(okResponse('یک خلاصهٔ متنی ساده'));

    const result = await service.execute(
      makeRequest({
        template: 'خلاصه کن: {text}',
        model: 'test/model',
        response_format: 'text',
      }),
    );

    expect(result.status).toBe('success');
    expect(result.parsed).toBe('یک خلاصهٔ متنی ساده');
    expect(result.raw).toBe('یک خلاصهٔ متنی ساده');
  });

  it('never throws — always resolves to an AiExecutionResult (Req 5.7)', async () => {
    mockedAxios.post.mockRejectedValue(new Error('totally unexpected'));

    await expect(service.execute(makeRequest())).resolves.toMatchObject({
      status: expect.stringMatching(/^(provider_error|timeout)$/),
    });
  });
});

/**
 * تست واحد ثبت لاگ اجرا در `ai_execution_logs` (Requirement 5.6).
 *
 * یک repository ساختگی (mock) به سازندهٔ AiService تزریق می‌شود و رفتار
 * best-effort بررسی می‌شود:
 *  - در پایان اجرای موفق یک رکورد با فیلدهای درست ذخیره می‌شود.
 *  - در پایان اجرای ناموفق (provider_error) نیز رکورد با status/error_message ثبت می‌شود.
 *  - شکست repository.save نباید قرارداد خروجی execute را بشکند یا throw کند.
 */
describe('AiService — ثبت لاگ اجرا (Req 5.6)', () => {
  const settings = {
    get: jest.fn().mockResolvedValue('test-openrouter-key'),
  };

  const fastConfig = {
    requestTimeoutMs: 1000,
    maxAttempts: 1,
    backoffBaseMs: 0,
    backoffMaxMs: 0,
    defaultTemperature: 0.3,
    fallbackModel: 'test/model',
  };

  const jsonVersion: PromptVersionSnapshot = {
    template: 'تحلیل کن: {text}',
    model: 'test/model',
    response_format: 'json',
    versionId: 42,
    output_schema: {
      type: 'object',
      required: ['sentiment'],
      properties: { sentiment: { type: 'object' } },
    },
  };

  const request: AiExecutionRequest = {
    promptKey: 'content_analysis',
    version: jsonVersion,
    input: { text: 'متن نمونه' },
    entityRef: { type: 'content', id: 7 },
  };

  const okResponse = (content: string, usage?: unknown) => ({
    data: { choices: [{ message: { content } }], usage },
  });

  /** ساخت یک repository ساختگی با create (echo) و save قابل‌کنترل. */
  const makeRepo = () => {
    const saved: Array<Record<string, unknown>> = [];
    const repo = {
      create: jest.fn((entity: Record<string, unknown>) => entity),
      save: jest.fn((entity: Record<string, unknown>) => {
        saved.push(entity);
        return Promise.resolve({ id: 1, ...entity });
      }),
    };
    return { repo, saved };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    settings.get.mockResolvedValue('test-openrouter-key');
  });

  it('writes a success log row capturing status/usage/duration/entity (Req 5.6)', async () => {
    const { repo, saved } = makeRepo();
    const service = new AiService(
      settings as never,
      fastConfig,
      repo as never,
    );

    mockedAxios.post.mockResolvedValueOnce(
      okResponse('{"sentiment": {"score": 0.8}}', {
        prompt_tokens: 10,
        completion_tokens: 20,
        cost: 0.0012,
      }),
    );

    const result = await service.execute(request);

    expect(result.status).toBe('success');
    expect(repo.save).toHaveBeenCalledTimes(1);
    const row = saved[0];
    expect(row.prompt_key).toBe('content_analysis');
    expect(row.prompt_version_id).toBe(42);
    expect(row.model).toBe('test/model');
    expect(row.status).toBe('success');
    expect(row.raw_output).toBe('{"sentiment": {"score": 0.8}}');
    expect(row.parsed_output).toEqual({ sentiment: { score: 0.8 } });
    expect(row.duration_ms).toBe(result.durationMs);
    expect(row.token_usage).toEqual({
      promptTokens: 10,
      completionTokens: 20,
      costEstimate: 0.0012,
    });
    expect(row.cost_estimate).toBe(0.0012);
    expect(row.entity_type).toBe('content');
    expect(row.entity_id).toBe('7');
    // input_hash یک sha256 hex است و raw_input برابر prompt رندرشده.
    expect(typeof row.input_hash).toBe('string');
    expect((row.input_hash as string).length).toBe(64);
    expect(row.raw_input).toContain('متن نمونه');
  });

  it('writes a failure log row on provider_error with error_message (Req 5.6)', async () => {
    const { repo, saved } = makeRepo();
    const service = new AiService(
      settings as never,
      fastConfig,
      repo as never,
    );

    mockedAxios.post.mockRejectedValue(
      Object.assign(new Error('Request failed with status code 400'), {
        isAxiosError: true,
        response: { status: 400, data: { error: 'bad request' } },
      }),
    );

    const result = await service.execute(request);

    expect(result.status).toBe('provider_error');
    expect(repo.save).toHaveBeenCalledTimes(1);
    const row = saved[0];
    expect(row.status).toBe('provider_error');
    expect(typeof row.error_message).toBe('string');
    expect((row.error_message as string).length).toBeGreaterThan(0);
    // در حالت خطای provider خروجی خام تهی است ولی همچنان string.
    expect(row.raw_output).toBe('');
    expect(row.token_usage).toBeNull();
  });

  it('does not break execute() when the repository save fails (best-effort Req 5.6)', async () => {
    const { repo } = makeRepo();
    repo.save.mockRejectedValueOnce(new Error('db down'));
    const service = new AiService(
      settings as never,
      fastConfig,
      repo as never,
    );

    mockedAxios.post.mockResolvedValueOnce(
      okResponse('{"sentiment": {"score": 1}}'),
    );

    const result = await service.execute(request);

    // قرارداد خروجی حفظ می‌شود حتی با شکست ثبت لاگ.
    expect(result.status).toBe('success');
    expect(result.parsed).toEqual({ sentiment: { score: 1 } });
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('skips logging without throwing when no repository is provided', async () => {
    const service = new AiService(settings as never, fastConfig);

    mockedAxios.post.mockResolvedValueOnce(
      okResponse('{"sentiment": {"score": 1}}'),
    );

    await expect(service.execute(request)).resolves.toMatchObject({
      status: 'success',
    });
  });
});
