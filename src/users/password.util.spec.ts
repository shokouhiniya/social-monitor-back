import { hashPassword, verifyPassword } from './password.util';

/**
 * تست واحد ابزار هش رمز عبور (scrypt). منطق واقعی آزمایش می‌شود — بدون mock.
 */
describe('password.util (scrypt)', () => {
  it('hashPassword produces a self-describing scrypt string', async () => {
    const hash = await hashPassword('s3cret-pass');
    expect(hash.startsWith('scrypt$')).toBe(true);
    // فرمت: scheme$N$r$p$salt$hash → ۶ بخش.
    expect(hash.split('$')).toHaveLength(6);
  });

  it('produces different hashes for the same password (random salt)', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');
    expect(a).not.toEqual(b);
  });

  it('verifyPassword returns true for the correct password', async () => {
    const hash = await hashPassword('correct-horse');
    await expect(verifyPassword('correct-horse', hash)).resolves.toBe(true);
  });

  it('verifyPassword returns false for an incorrect password', async () => {
    const hash = await hashPassword('correct-horse');
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });

  it('verifyPassword returns false for null/empty/malformed stored hash', async () => {
    await expect(verifyPassword('x', null)).resolves.toBe(false);
    await expect(verifyPassword('x', '')).resolves.toBe(false);
    await expect(verifyPassword('x', 'not-a-valid-hash')).resolves.toBe(false);
    await expect(verifyPassword('x', 'bcrypt$1$2$3$4$5')).resolves.toBe(false);
  });
});
