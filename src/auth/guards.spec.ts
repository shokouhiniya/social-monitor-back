import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { ROLES_METADATA_KEY } from './roles.decorator';
import { REQUEST_USER_KEY } from './auth.types';
import {
  ForbiddenException,
  UnauthorizedException,
} from '../common/exceptions';
import { SafeUser } from '../users/user.types';

/**
 * تست واحد guardهای auth (Requirement 11.2, 11.4).
 *
 *  - JwtAuthGuard: رد درخواست بدون توکن یا با توکن نامعتبر با UnauthorizedException.
 *  - RolesGuard: عبور نقش مجاز و رد نقش غیرمجاز با ForbiddenException.
 */

const adminUser: SafeUser = {
  id: 1,
  name: 'Admin',
  username: 'admin',
  role: 'admin',
  is_active: true,
};

const viewerUser: SafeUser = {
  id: 2,
  name: 'Viewer',
  username: 'viewer',
  role: 'viewer',
  is_active: true,
};

/** ساخت یک ExecutionContext جعلی با request دلخواه. */
function makeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => undefined,
    }),
    getHandler: () => function handler() {},
    getClass: () => class Ctrl {},
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard (Requirement 11.2)', () => {
  it('throws UnauthorizedException when no Authorization header is present', async () => {
    const authService = { validate: jest.fn() };
    const guard = new JwtAuthGuard(authService as never);
    const ctx = makeContext({ headers: {} });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(authService.validate).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when the scheme is not Bearer', async () => {
    const authService = { validate: jest.fn() };
    const guard = new JwtAuthGuard(authService as never);
    const ctx = makeContext({ headers: { authorization: 'Basic abc' } });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(authService.validate).not.toHaveBeenCalled();
  });

  it('propagates UnauthorizedException when the token is invalid', async () => {
    const authService = {
      validate: jest
        .fn()
        .mockRejectedValue(new UnauthorizedException('bad token')),
    };
    const guard = new JwtAuthGuard(authService as never);
    const ctx = makeContext({
      headers: { authorization: 'Bearer invalid.token' },
    });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('attaches the validated user to the request and allows access', async () => {
    const authService = { validate: jest.fn().mockResolvedValue(adminUser) };
    const guard = new JwtAuthGuard(authService as never);
    const request: Record<string, unknown> = {
      headers: { authorization: 'Bearer good.token' },
    };
    const ctx = makeContext(request);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request[REQUEST_USER_KEY]).toBe(adminUser);
    expect(authService.validate).toHaveBeenCalledWith('good.token');
  });
});

describe('RolesGuard (Requirement 11.3, 11.4)', () => {
  const makeGuard = (required: string[] | undefined) => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(required),
    } as unknown as Reflector;
    return new RolesGuard(reflector);
  };

  it('allows access when no @Roles metadata is set', () => {
    const guard = makeGuard(undefined);
    const ctx = makeContext({ [REQUEST_USER_KEY]: viewerUser });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows access when the user has an allowed role', () => {
    const guard = makeGuard(['admin']);
    const ctx = makeContext({ [REQUEST_USER_KEY]: adminUser });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when the user role is not allowed', () => {
    const guard = makeGuard(['admin']);
    const ctx = makeContext({ [REQUEST_USER_KEY]: viewerUser });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws UnauthorizedException when no user is attached to the request', () => {
    const guard = makeGuard(['admin']);
    const ctx = makeContext({});
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });
});
