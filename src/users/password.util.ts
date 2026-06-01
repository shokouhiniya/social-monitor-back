import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';

/**
 * wrapper مبتنی بر Promise برای `crypto.scrypt` که از overload دارای options
 * پشتیبانی می‌کند (نسخهٔ `promisify` پیش‌فرض تنها overload بدون options را
 * می‌بیند).
 */
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (err, derivedKey) => {
      if (err) {
        reject(err);
      } else {
        resolve(derivedKey);
      }
    });
  });
}

/**
 * هش و تأیید رمز عبور با استفاده از `scrypt` داخلی Node.js.
 *
 * **تصمیم مرزی (انتخاب الگوریتم هش):** عمداً به‌جای افزودن وابستگی native
 * `bcrypt` از `crypto.scrypt` داخلی Node استفاده شده است. دلایل:
 *  - حذف یک وابستگی native که build در محیط‌های مختلف (Docker، CI) را شکننده
 *    می‌کند و نیاز به ابزار build (node-gyp) دارد.
 *  - `scrypt` یک تابع مشتق کلید مقاوم در برابر حملهٔ سخت‌افزاری (memory-hard)
 *    است و برای هش رمز عبور توصیه‌شده است.
 *
 * فرمت ذخیره‌شده: `scrypt$N$r$p$<saltHex>$<hashHex>` تا پارامترها همراه هش حمل
 * شوند و امکان مهاجرت پارامترها در آینده وجود داشته باشد. مقایسه با
 * `timingSafeEqual` انجام می‌شود تا در برابر حملهٔ زمانی مقاوم باشد.
 */

const SALT_BYTES = 16;
const KEY_LEN = 64;
// پارامترهای scrypt (N: cost، r: block size، p: parallelization).
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCHEME = 'scrypt';

/** هش‌کردن یک رمز عبور خام به رشتهٔ خودتوصیف (self-describing). */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scryptAsync(plain, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return [
    SCHEME,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('hex'),
    derived.toString('hex'),
  ].join('$');
}

/**
 * تأیید یک رمز عبور خام در برابر هش ذخیره‌شده. در صورت خرابی فرمت هش یا عدم
 * تطابق، `false` برمی‌گرداند (هرگز استثنا نشت نمی‌دهد).
 */
export async function verifyPassword(
  plain: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (!stored) {
    return false;
  }
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== SCHEME) {
    return false;
  }
  const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
  const N = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return false;
  }

  try {
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const derived = await scryptAsync(plain, salt, expected.length, {
      N,
      r,
      p,
    });
    if (derived.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
