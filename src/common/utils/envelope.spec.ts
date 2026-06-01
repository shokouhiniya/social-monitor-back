import {
  buildEnvelope,
  buildErrorEnvelope,
  buildSuccessEnvelope,
  isoTimestamp,
} from './envelope';

describe('envelope helpers', () => {
  it('isoTimestamp returns a round-trippable ISO-8601 string', () => {
    const ts = isoTimestamp();
    expect(new Date(ts).toISOString()).toBe(ts);
  });

  it('isoTimestamp uses the provided date', () => {
    const date = new Date('2025-01-01T10:00:00.000Z');
    expect(isoTimestamp(date)).toBe('2025-01-01T10:00:00.000Z');
  });

  describe('buildSuccessEnvelope', () => {
    it('has status "success", data present, and no error field', () => {
      const env = buildSuccessEnvelope({ id: 1 });
      expect(env.meta.status).toBe('success');
      expect(env.data).toEqual({ id: 1 });
      expect('error' in env).toBe(false);
      expect(new Date(env.meta.timestamp).toISOString()).toBe(
        env.meta.timestamp,
      );
    });

    it('preserves falsy payloads (null, 0, empty string, false)', () => {
      for (const data of [null, 0, '', false]) {
        const env = buildSuccessEnvelope(data);
        expect(env.meta.status).toBe('success');
        expect('data' in env).toBe(true);
        expect(env.data).toBe(data);
      }
    });
  });

  describe('buildErrorEnvelope', () => {
    it('has a non-empty symbolic code, no data field, ISO-8601 timestamp', () => {
      const env = buildErrorEnvelope({ code: 'NOT_FOUND', message: 'missing' });
      expect(env.meta.status).toBe('error');
      expect(env.error.code).toBe('NOT_FOUND');
      expect(env.error.code.length).toBeGreaterThan(0);
      expect('data' in env).toBe(false);
      expect(new Date(env.meta.timestamp).toISOString()).toBe(
        env.meta.timestamp,
      );
    });

    it('omits details when undefined', () => {
      const env = buildErrorEnvelope({ code: 'INTERNAL_ERROR', message: 'x' });
      expect('details' in env.error).toBe(false);
    });

    it('keeps details when provided', () => {
      const env = buildErrorEnvelope({
        code: 'VALIDATION_ERROR',
        message: 'bad',
        details: { messages: ['field is required'] },
      });
      expect(env.error.details).toEqual({ messages: ['field is required'] });
    });
  });

  describe('buildEnvelope dispatcher', () => {
    it('routes a success outcome to the success branch (XOR)', () => {
      const env = buildEnvelope({ status: 'success', data: 42 });
      expect('data' in env && !('error' in env)).toBe(true);
      expect(env.meta.status).toBe('success');
    });

    it('routes an error outcome to the error branch (XOR)', () => {
      const env = buildEnvelope({
        status: 'error',
        error: { code: 'CONFLICT', message: 'dup' },
      });
      expect('error' in env && !('data' in env)).toBe(true);
      expect(env.meta.status).toBe('error');
    });

    it('uses the provided date for the timestamp', () => {
      const date = new Date('2025-06-15T08:30:00.000Z');
      const env = buildEnvelope({ status: 'success', data: null }, date);
      expect(env.meta.timestamp).toBe('2025-06-15T08:30:00.000Z');
    });
  });
});
