import {
  allowedTargets,
  canTransition,
  isKnownStatus,
  TransitionMap,
} from './state-machine.util';

/**
 * تست واحد ابزار خالص ماشین وضعیت (design §5.10 / Requirement 9.1-9.3).
 */
describe('state-machine.util', () => {
  type S = 'a' | 'b' | 'c';
  const map: TransitionMap<S> = {
    a: ['b'],
    b: ['c'],
    c: [],
  };

  describe('canTransition', () => {
    it('allows a documented transition', () => {
      expect(canTransition(map, 'a', 'b')).toBe(true);
      expect(canTransition(map, 'b', 'c')).toBe(true);
    });

    it('rejects an undocumented transition', () => {
      expect(canTransition(map, 'a', 'c')).toBe(false);
      expect(canTransition(map, 'b', 'a')).toBe(false);
    });

    it('rejects a transition out of a terminal state', () => {
      expect(canTransition(map, 'c', 'a')).toBe(false);
      expect(canTransition(map, 'c', 'b')).toBe(false);
    });

    it('rejects a self-transition unless explicitly declared', () => {
      expect(canTransition(map, 'a', 'a')).toBe(false);
    });
  });

  describe('allowedTargets', () => {
    it('returns the configured target list', () => {
      expect(allowedTargets(map, 'a')).toEqual(['b']);
      expect(allowedTargets(map, 'c')).toEqual([]);
    });
  });

  describe('isKnownStatus', () => {
    it('recognizes known and unknown statuses', () => {
      expect(isKnownStatus(map, 'a')).toBe(true);
      expect(isKnownStatus(map, 'z')).toBe(false);
    });
  });
});
