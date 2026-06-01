import { computeFinalStatus } from './analysis-run.service';

/**
 * تست واحد تابع خالص `computeFinalStatus` — منطق محاسبهٔ وضعیت نهایی اجرای
 * تحلیل از روی شمارش‌ها (Requirement 7.6).
 */
describe('computeFinalStatus', () => {
  it('returns succeeded for an empty run (total = 0)', () => {
    expect(computeFinalStatus(0, 0, 0)).toBe('succeeded');
  });

  it('returns succeeded when there are no failures', () => {
    expect(computeFinalStatus(5, 5, 0)).toBe('succeeded');
  });

  it('returns failed when nothing succeeded', () => {
    expect(computeFinalStatus(3, 0, 3)).toBe('failed');
  });

  it('returns partial when some succeed and some fail', () => {
    expect(computeFinalStatus(4, 2, 2)).toBe('partial');
    expect(computeFinalStatus(10, 9, 1)).toBe('partial');
  });
});
