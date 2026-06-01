import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException as NestForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException as NestNotFoundException,
  UnauthorizedException as NestUnauthorizedException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import {
  ConflictException,
  DomainException,
  ERROR_CODES,
  InvalidStateTransitionException,
} from '../exceptions/domain.exception';

interface CapturedResponse {
  statusCode?: number;
  body?: any;
}

function createHost(): { host: ArgumentsHost; captured: CapturedResponse } {
  const captured: CapturedResponse = {};
  const response = {
    status(code: number) {
      captured.statusCode = code;
      return this;
    },
    json(body: any) {
      captured.body = body;
      return this;
    },
  };
  const request = { method: 'GET', url: '/test' };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;

  return { host, captured };
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    // جلوگیری از نویز log در خروجی تست.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('produces a well-formed error envelope with ISO-8601 timestamp', () => {
    const { host, captured } = createHost();

    filter.catch(new ConflictException('duplicate'), host);

    expect(captured.body.meta.status).toBe('error');
    const ts = captured.body.meta.timestamp;
    expect(new Date(ts).toISOString()).toBe(ts);
    // شاخهٔ خطا نباید فیلد data داشته باشد.
    expect('data' in captured.body).toBe(false);
    expect(captured.body.error.code).toBeTruthy();
  });

  it('maps a DomainException to its symbolic code and http status', () => {
    const { host, captured } = createHost();

    filter.catch(new ConflictException('already exists'), host);

    expect(captured.statusCode).toBe(HttpStatus.CONFLICT);
    expect(captured.body.error.code).toBe(ERROR_CODES.CONFLICT);
    expect(captured.body.error.message).toBe('already exists');
  });

  it('maps INVALID_STATE_TRANSITION domain exception correctly', () => {
    const { host, captured } = createHost();

    filter.catch(
      new InvalidStateTransitionException('cannot go from A to C'),
      host,
    );

    expect(captured.body.error.code).toBe(
      ERROR_CODES.INVALID_STATE_TRANSITION,
    );
  });

  it('includes details when provided on a DomainException', () => {
    const { host, captured } = createHost();

    filter.catch(
      new DomainException(ERROR_CODES.AI_TIMEOUT, 'timed out', {
        details: { provider: 'openrouter' },
      }),
      host,
    );

    expect(captured.statusCode).toBe(HttpStatus.GATEWAY_TIMEOUT);
    expect(captured.body.error.code).toBe(ERROR_CODES.AI_TIMEOUT);
    expect(captured.body.error.details).toEqual({ provider: 'openrouter' });
  });

  it.each([
    [new NestNotFoundException('nope'), HttpStatus.NOT_FOUND, ERROR_CODES.NOT_FOUND],
    [
      new NestUnauthorizedException('no token'),
      HttpStatus.UNAUTHORIZED,
      ERROR_CODES.UNAUTHORIZED,
    ],
    [
      new NestForbiddenException('denied'),
      HttpStatus.FORBIDDEN,
      ERROR_CODES.FORBIDDEN,
    ],
  ])(
    'maps Nest HttpException %# to the right symbolic code',
    (exception, expectedStatus, expectedCode) => {
      const { host, captured } = createHost();

      filter.catch(exception as HttpException, host);

      expect(captured.statusCode).toBe(expectedStatus);
      expect(captured.body.error.code).toBe(expectedCode);
    },
  );

  it('maps ValidationPipe errors to VALIDATION_ERROR with field details', () => {
    const { host, captured } = createHost();
    const validationException = new BadRequestException({
      statusCode: 400,
      message: ['name should not be empty', 'email must be an email'],
      error: 'Bad Request',
    });

    filter.catch(validationException, host);

    expect(captured.statusCode).toBe(HttpStatus.BAD_REQUEST);
    expect(captured.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(captured.body.error.details).toEqual({
      messages: ['name should not be empty', 'email must be an email'],
    });
  });

  it('maps an unknown exception to INTERNAL_ERROR without leaking details', () => {
    const { host, captured } = createHost();
    const leaky = new Error('secret db connection string failure at host X');

    filter.catch(leaky, host);

    expect(captured.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(captured.body.error.code).toBe(ERROR_CODES.INTERNAL_ERROR);
    expect(captured.body.error.message).toBe(
      'An internal server error occurred',
    );
    // پیام/جزئیات داخلی نباید نشت کند.
    expect(JSON.stringify(captured.body)).not.toContain('secret db');
    expect('details' in captured.body.error).toBe(false);
  });

  it('logs unknown exceptions server-side with stack', () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { host } = createHost();

    filter.catch(new Error('boom'), host);

    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('maps a non-Error thrown value to INTERNAL_ERROR', () => {
    const { host, captured } = createHost();

    filter.catch('just a string', host);

    expect(captured.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(captured.body.error.code).toBe(ERROR_CODES.INTERNAL_ERROR);
  });
});
