import { lastValueFrom, of } from 'rxjs';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { ResponseInterceptor } from './response.interceptor';

function makeCallHandler<T>(value: T): CallHandler<T> {
  return { handle: () => of(value) };
}

const execContext = {} as ExecutionContext;

describe('ResponseInterceptor', () => {
  it('wraps the handler result in a success envelope', async () => {
    const interceptor = new ResponseInterceptor();
    const handler = makeCallHandler({ id: 1, name: 'sajad' });

    const result = await lastValueFrom(
      interceptor.intercept(execContext, handler),
    );

    expect(result.meta.status).toBe('success');
    expect(result.data).toEqual({ id: 1, name: 'sajad' });
    expect('error' in result).toBe(false);
  });

  it('produces an ISO-8601 timestamp (round-trip invariant)', async () => {
    const interceptor = new ResponseInterceptor();
    const handler = makeCallHandler('payload');

    const result = await lastValueFrom(
      interceptor.intercept(execContext, handler),
    );

    expect(new Date(result.meta.timestamp).toISOString()).toBe(
      result.meta.timestamp,
    );
  });

  it('preserves array payloads as data', async () => {
    const interceptor = new ResponseInterceptor<number[]>();
    const handler = makeCallHandler([1, 2, 3]);

    const result = await lastValueFrom(
      interceptor.intercept(execContext, handler),
    );

    expect(result.data).toEqual([1, 2, 3]);
    expect(result.meta.status).toBe('success');
  });
});
