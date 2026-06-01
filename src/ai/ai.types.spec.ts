import {
  backoffDelayMs,
  classifyStatus,
  renderTemplate,
  repairAndParseJson,
  validateAgainstSchema,
} from './ai.types';

/**
 * تست واحد توابع خالص AiModule (design §5.6، Requirement 5.2/5.4).
 *
 * این توابع هستهٔ منطق نرمال‌سازی و JSON repair را بدون شبکه پیاده می‌کنند؛
 * بنابراین مستقیماً و بدون mock آزمایش می‌شوند.
 */
describe('ai.types pure helpers', () => {
  describe('renderTemplate', () => {
    it('replaces both {{var}} and {var} placeholders', () => {
      const out = renderTemplate('سلام {{name}}، سن: {age}', {
        name: 'سجاد',
        age: 30,
      });
      expect(out).toBe('سلام سجاد، سن: 30');
    });

    it('serializes non-primitive values as JSON', () => {
      const out = renderTemplate('data={{payload}}', {
        payload: { a: 1, b: [2, 3] },
      });
      expect(out).toBe('data={"a":1,"b":[2,3]}');
    });

    it('leaves unknown placeholders untouched', () => {
      const out = renderTemplate('hi {missing}', { other: 'x' });
      expect(out).toBe('hi {missing}');
    });

    it('appends extra instructions when provided', () => {
      const out = renderTemplate('base', {}, 'دستور اضافی');
      expect(out).toBe('base\n\nدستور اضافی');
    });
  });

  describe('repairAndParseJson', () => {
    it('parses clean JSON without repair', () => {
      const res = repairAndParseJson('{"a":1}');
      expect(res.ok).toBe(true);
      expect(res.repaired).toBe(false);
      expect(res.value).toEqual({ a: 1 });
    });

    it('extracts JSON from markdown code fences (repair)', () => {
      const raw = 'اینجا خروجی:\n```json\n{"x": 5}\n```\nپایان';
      const res = repairAndParseJson(raw);
      expect(res.ok).toBe(true);
      expect(res.repaired).toBe(true);
      expect(res.value).toEqual({ x: 5 });
    });

    it('extracts the first balanced JSON object from surrounding prose', () => {
      const raw = 'بله، نتیجه این است: {"score": 0.9, "label": "positive"} موفق باشید';
      const res = repairAndParseJson(raw);
      expect(res.ok).toBe(true);
      expect(res.value).toEqual({ score: 0.9, label: 'positive' });
    });

    it('removes trailing commas (repair)', () => {
      const raw = '{"a": 1, "b": [1, 2,], }';
      const res = repairAndParseJson(raw);
      expect(res.ok).toBe(true);
      expect(res.repaired).toBe(true);
      expect(res.value).toEqual({ a: 1, b: [1, 2] });
    });

    it('returns ok=false for non-JSON garbage', () => {
      const res = repairAndParseJson('این فقط یک متن ساده است بدون JSON');
      expect(res.ok).toBe(false);
      expect(res.value).toBeNull();
    });

    it('returns ok=false for empty string', () => {
      const res = repairAndParseJson('');
      expect(res.ok).toBe(false);
    });

    it('does not confuse braces inside JSON strings', () => {
      const raw = '{"text": "this has a } brace inside"}';
      const res = repairAndParseJson(raw);
      expect(res.ok).toBe(true);
      expect(res.value).toEqual({ text: 'this has a } brace inside' });
    });
  });

  describe('validateAgainstSchema', () => {
    it('accepts any value when no schema is provided', () => {
      expect(validateAgainstSchema({ anything: true })).toEqual([]);
      expect(validateAgainstSchema(null)).toEqual([]);
    });

    it('reports a type mismatch at the root', () => {
      const errors = validateAgainstSchema('a string', { type: 'object' });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('reports missing required keys', () => {
      const errors = validateAgainstSchema(
        { a: 1 },
        { type: 'object', required: ['a', 'b'] },
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('b');
    });

    it('validates nested properties recursively', () => {
      const errors = validateAgainstSchema(
        { sentiment: { score: 'not-a-number' } },
        {
          type: 'object',
          properties: {
            sentiment: {
              type: 'object',
              properties: { score: { type: 'number' } },
            },
          },
        },
      );
      expect(errors.length).toBeGreaterThan(0);
    });

    it('passes a valid object that matches the schema', () => {
      const errors = validateAgainstSchema(
        { sentiment: { score: 0.5 }, keywords: ['a'] },
        {
          type: 'object',
          required: ['sentiment', 'keywords'],
          properties: {
            sentiment: { type: 'object' },
            keywords: { type: 'array', items: { type: 'string' } },
          },
        },
      );
      expect(errors).toEqual([]);
    });

    it('validates array item types', () => {
      const errors = validateAgainstSchema([1, 'two', 3], {
        type: 'array',
        items: { type: 'number' },
      });
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('classifyStatus', () => {
    it('returns timeout when provider errored with timeout', () => {
      expect(
        classifyStatus({
          providerErrored: true,
          isTimeout: true,
          parsedOk: false,
          validationErrors: [],
          expectsJson: true,
        }),
      ).toBe('timeout');
    });

    it('returns provider_error for non-timeout provider failures', () => {
      expect(
        classifyStatus({
          providerErrored: true,
          isTimeout: false,
          parsedOk: false,
          validationErrors: [],
          expectsJson: true,
        }),
      ).toBe('provider_error');
    });

    it('returns validation_error when JSON parse fails for json format', () => {
      expect(
        classifyStatus({
          providerErrored: false,
          isTimeout: false,
          parsedOk: false,
          validationErrors: [],
          expectsJson: true,
        }),
      ).toBe('validation_error');
    });

    it('returns validation_error when schema errors exist', () => {
      expect(
        classifyStatus({
          providerErrored: false,
          isTimeout: false,
          parsedOk: true,
          validationErrors: ['$.a: missing'],
          expectsJson: true,
        }),
      ).toBe('validation_error');
    });

    it('returns success for valid parsed json with no schema errors', () => {
      expect(
        classifyStatus({
          providerErrored: false,
          isTimeout: false,
          parsedOk: true,
          validationErrors: [],
          expectsJson: true,
        }),
      ).toBe('success');
    });

    it('returns success for text format without schema errors', () => {
      expect(
        classifyStatus({
          providerErrored: false,
          isTimeout: false,
          parsedOk: false,
          validationErrors: [],
          expectsJson: false,
        }),
      ).toBe('success');
    });
  });

  describe('backoffDelayMs', () => {
    it('grows exponentially from the base', () => {
      expect(backoffDelayMs(0, 500, 8000)).toBe(500);
      expect(backoffDelayMs(1, 500, 8000)).toBe(1000);
      expect(backoffDelayMs(2, 500, 8000)).toBe(2000);
    });

    it('caps at the maximum', () => {
      expect(backoffDelayMs(10, 500, 8000)).toBe(8000);
    });

    it('treats negative attempts as zero', () => {
      expect(backoffDelayMs(-3, 500, 8000)).toBe(500);
    });
  });
});
