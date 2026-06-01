import { HttpStatus } from '@nestjs/common';
import {
  ConflictException,
  DomainException,
  ERROR_CODES,
  ERROR_CODE_HTTP_STATUS,
  NotFoundException,
} from './domain.exception';

describe('DomainException', () => {
  it('exposes a symbolic code and derives default http status', () => {
    const ex = new DomainException(ERROR_CODES.NOT_FOUND, 'missing');

    expect(ex.code).toBe(ERROR_CODES.NOT_FOUND);
    expect(ex.httpStatus).toBe(HttpStatus.NOT_FOUND);
    expect(ex.message).toBe('missing');
    expect(ex).toBeInstanceOf(Error);
    expect(ex).toBeInstanceOf(DomainException);
  });

  it('allows overriding http status and attaching details', () => {
    const ex = new DomainException(ERROR_CODES.INTERNAL_ERROR, 'oops', {
      httpStatus: HttpStatus.SERVICE_UNAVAILABLE,
      details: { retryAfter: 5 },
    });

    expect(ex.httpStatus).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(ex.details).toEqual({ retryAfter: 5 });
  });

  it('subclasses carry the correct code', () => {
    expect(new NotFoundException().code).toBe(ERROR_CODES.NOT_FOUND);
    expect(new ConflictException().code).toBe(ERROR_CODES.CONFLICT);
    expect(new ConflictException()).toBeInstanceOf(DomainException);
  });

  it('defines an http status for every symbolic code', () => {
    for (const code of Object.values(ERROR_CODES)) {
      expect(ERROR_CODE_HTTP_STATUS[code]).toBeDefined();
    }
  });
});
