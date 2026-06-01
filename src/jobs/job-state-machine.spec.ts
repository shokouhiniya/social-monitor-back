import {
  allowedTaskTargets,
  canTransitionJob,
  canTransitionTask,
  computeProgress,
  deriveJobStatus,
  isJobComplete,
  isTerminalTaskStatus,
  JobTaskStatus,
  progressInvariantHolds,
} from './job-state-machine';

/**
 * تست واحد ماشین وضعیت خالص Job/JobTask (Requirement 10.2, 10.3, 10.4).
 *
 * این تست‌ها منطق خالص گذار و محاسبهٔ پیشرفت را بدون دیتابیس می‌سنجند و مکمل
 * property test اختیاری ۷.۳ هستند.
 */
describe('job-state-machine', () => {
  describe('canTransitionTask (Requirement 10.3)', () => {
    it('allows the documented forward transitions', () => {
      expect(canTransitionTask('pending', 'running')).toBe(true);
      expect(canTransitionTask('running', 'succeeded')).toBe(true);
      expect(canTransitionTask('running', 'failed')).toBe(true);
      expect(canTransitionTask('running', 'skipped')).toBe(true);
      expect(canTransitionTask('pending', 'cancelled')).toBe(true);
      expect(canTransitionTask('pending', 'skipped')).toBe(true);
      expect(canTransitionTask('running', 'cancelled')).toBe(true);
    });

    it('allows only failed -> pending out of terminal states (retryFailed)', () => {
      expect(canTransitionTask('failed', 'pending')).toBe(true);
    });

    it('rejects transitions out of non-failed terminal states', () => {
      const terminals: JobTaskStatus[] = ['succeeded', 'cancelled', 'skipped'];
      const targets: JobTaskStatus[] = [
        'pending',
        'running',
        'succeeded',
        'failed',
        'cancelled',
        'skipped',
      ];
      for (const from of terminals) {
        for (const to of targets) {
          expect(canTransitionTask(from, to)).toBe(false);
        }
      }
    });

    it('rejects illegal forward transitions (e.g. pending -> succeeded)', () => {
      expect(canTransitionTask('pending', 'succeeded')).toBe(false);
      expect(canTransitionTask('pending', 'failed')).toBe(false);
      expect(canTransitionTask('succeeded', 'failed')).toBe(false);
      expect(canTransitionTask('failed', 'running')).toBe(false);
    });
  });

  describe('canTransitionJob', () => {
    it('allows reopening a terminal job to pending (retryFailed)', () => {
      expect(canTransitionJob('failed', 'pending')).toBe(true);
      expect(canTransitionJob('succeeded', 'pending')).toBe(true);
    });

    it('does not allow leaving a cancelled job', () => {
      expect(canTransitionJob('cancelled', 'pending')).toBe(false);
      expect(canTransitionJob('cancelled', 'running')).toBe(false);
    });
  });

  describe('isTerminalTaskStatus', () => {
    it('classifies terminal vs active statuses', () => {
      expect(isTerminalTaskStatus('succeeded')).toBe(true);
      expect(isTerminalTaskStatus('failed')).toBe(true);
      expect(isTerminalTaskStatus('cancelled')).toBe(true);
      expect(isTerminalTaskStatus('skipped')).toBe(true);
      expect(isTerminalTaskStatus('pending')).toBe(false);
      expect(isTerminalTaskStatus('running')).toBe(false);
    });
  });

  describe('allowedTaskTargets', () => {
    it('returns the documented targets for pending', () => {
      expect(allowedTaskTargets('pending')).toEqual([
        'running',
        'cancelled',
        'skipped',
      ]);
    });

    it('returns an empty list for a non-failed terminal state', () => {
      expect(allowedTaskTargets('succeeded')).toEqual([]);
    });
  });

  describe('computeProgress + invariant (Requirement 10.4)', () => {
    it('counts statuses correctly and preserves completed + failed <= total', () => {
      const statuses: JobTaskStatus[] = [
        'succeeded',
        'succeeded',
        'failed',
        'pending',
        'running',
        'skipped',
        'cancelled',
      ];
      const counts = computeProgress(statuses);

      expect(counts.total).toBe(7);
      expect(counts.completed).toBe(2);
      expect(counts.failed).toBe(1);
      expect(counts.skipped).toBe(1);
      expect(counts.cancelled).toBe(1);
      expect(counts.pending).toBe(1);
      expect(counts.running).toBe(1);
      expect(progressInvariantHolds(counts)).toBe(true);
    });

    it('honors a totalOverride larger than the provided statuses', () => {
      const counts = computeProgress(['succeeded', 'failed'], 10);
      expect(counts.total).toBe(10);
      expect(progressInvariantHolds(counts)).toBe(true);
    });

    it('satisfies completed + failed + skipped = total at terminal completion', () => {
      const statuses: JobTaskStatus[] = [
        'succeeded',
        'failed',
        'skipped',
        'succeeded',
      ];
      const counts = computeProgress(statuses);
      expect(isJobComplete(counts)).toBe(true);
      expect(counts.completed + counts.failed + counts.skipped).toBe(
        counts.total,
      );
    });
  });

  describe('deriveJobStatus', () => {
    it('is succeeded when there are no tasks', () => {
      expect(deriveJobStatus(computeProgress([]))).toBe('succeeded');
    });

    it('is pending when nothing has started', () => {
      expect(deriveJobStatus(computeProgress(['pending', 'pending']))).toBe(
        'pending',
      );
    });

    it('is running while some work is active or partially done', () => {
      expect(
        deriveJobStatus(computeProgress(['running', 'pending'])),
      ).toBe('running');
      expect(
        deriveJobStatus(computeProgress(['succeeded', 'pending'])),
      ).toBe('running');
    });

    it('is failed when all are terminal and at least one failed', () => {
      expect(
        deriveJobStatus(computeProgress(['succeeded', 'failed'])),
      ).toBe('failed');
    });

    it('is succeeded when all terminal with no failures', () => {
      expect(
        deriveJobStatus(computeProgress(['succeeded', 'skipped'])),
      ).toBe('succeeded');
    });

    it('is cancelled when every task is cancelled', () => {
      expect(
        deriveJobStatus(computeProgress(['cancelled', 'cancelled'])),
      ).toBe('cancelled');
    });
  });
});
