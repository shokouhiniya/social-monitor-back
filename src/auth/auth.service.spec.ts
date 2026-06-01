import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '../common/exceptions';
import { hashPassword } from '../users/password.util';
import { User } from '../modules/user/user.entity';

/**
 * تست واحد AuthService (Requirement 11.1).
 *
 * منطق واقعی login/validate آزمایش می‌شود؛ تنها UsersService با یک fake سبک
 * جایگزین می‌شود و JwtService واقعی (با secret تست) استفاده می‌شود تا توکن واقعی
 * امضا/تأیید گردد (بدون mock کردن رمزنگاری).
 */
describe('AuthService (Requirement 11.1)', () => {
  let jwtService: JwtService;

  const makeUser = (over: Partial<User> = {}): User =>
    ({
      id: 10,
      name: 'Tester',
      username: 'tester',
      role: 'operator',
      is_active: true,
      phone: 'internal-tester',
      ...over,
    }) as User;

  const makeService = (user: User | null) => {
    const usersService = {
      findByUsernameWithSecret: jest.fn().mockResolvedValue(user),
      findById: jest
        .fn()
        .mockResolvedValue(
          user
            ? {
                id: user.id,
                name: user.name,
                username: user.username,
                role: user.role,
                is_active: user.is_active,
              }
            : null,
        ),
    };
    const service = new AuthService(usersService as never, jwtService);
    return { service, usersService };
  };

  beforeAll(() => {
    jwtService = new JwtService({
      secret: 'test-secret',
      signOptions: { expiresIn: '60m' },
    });
  });

  it('login returns a signed JWT and a SafeUser (no password_hash) for valid credentials', async () => {
    const password_hash = await hashPassword('correct-pass');
    const user = makeUser({ password_hash });
    const { service } = makeService(user);

    const result = await service.login({
      username: 'tester',
      password: 'correct-pass',
    });

    expect(typeof result.token).toBe('string');
    expect(result.user).toEqual({
      id: 10,
      name: 'Tester',
      username: 'tester',
      role: 'operator',
      is_active: true,
    });
    // SafeUser نباید password_hash داشته باشد.
    expect(
      (result.user as unknown as Record<string, unknown>).password_hash,
    ).toBeUndefined();

    // payload توکن باید sub و role را داشته باشد.
    const payload = jwtService.verify(result.token);
    expect(payload.sub).toBe(10);
    expect(payload.role).toBe('operator');
  });

  it('login throws UnauthorizedException for an unknown user', async () => {
    const { service } = makeService(null);
    await expect(
      service.login({ username: 'ghost', password: 'x' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login throws UnauthorizedException for a wrong password', async () => {
    const password_hash = await hashPassword('correct-pass');
    const { service } = makeService(makeUser({ password_hash }));
    await expect(
      service.login({ username: 'tester', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login throws UnauthorizedException for an inactive user', async () => {
    const password_hash = await hashPassword('correct-pass');
    const { service } = makeService(
      makeUser({ password_hash, is_active: false }),
    );
    await expect(
      service.login({ username: 'tester', password: 'correct-pass' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('validate returns the SafeUser for a valid token', async () => {
    const password_hash = await hashPassword('correct-pass');
    const { service } = makeService(makeUser({ password_hash }));
    const token = jwtService.sign({ sub: 10, role: 'operator' });

    const safeUser = await service.validate(token);
    expect(safeUser.id).toBe(10);
    expect(safeUser.role).toBe('operator');
  });

  it('validate throws UnauthorizedException for a malformed/invalid token', async () => {
    const { service } = makeService(makeUser());
    await expect(service.validate('not-a-jwt')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
