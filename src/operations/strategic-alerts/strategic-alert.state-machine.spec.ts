import {
  AlertStatus,
  ALERT_INITIAL_STATUS,
  ALERT_STATUSES,
  ALERT_TRANSITIONS,
  allowedTargetsForAlert,
  canTransitionAlert,
} from './strategic-alert.state-machine';

/**
 * تست واحد ماشین وضعیت StrategicAlert (Requirement 9.1).
 */
describe('StrategicAlert state machine', () => {
  it('uses "active" as the valid initial status', () => {
    expect(ALERT_INITIAL_STATUS).toBe('active');
  });

  it('accepts the main documented path', () => {
    expect(canTransitionAlert('active', 'investigating')).toBe(true);
    expect(canTransitionAlert('investigating', 'needs_response')).toBe(true);
    expect(canTransitionAlert('needs_response', 'acknowledged')).toBe(true);
    expect(canTransitionAlert('acknowledged', 'archived')).toBe(true);
  });

  it('accepts documented shortcuts (acknowledge / archive early)', () => {
    expect(canTransitionAlert('active', 'acknowledged')).toBe(true);
    expect(canTransitionAlert('active', 'archived')).toBe(true);
    expect(canTransitionAlert('investigating', 'archived')).toBe(true);
    expect(canTransitionAlert('needs_response', 'investigating')).toBe(true);
  });

  it('rejects reverse jumps and undocumented transitions', () => {
    expect(canTransitionAlert('investigating', 'active')).toBe(false);
    expect(canTransitionAlert('acknowledged', 'active')).toBe(false);
    expect(canTransitionAlert('active', 'needs_response')).toBe(false);
  });

  it('treats "archived" as terminal', () => {
    expect(allowedTargetsForAlert('archived')).toEqual([]);
    for (const to of ALERT_STATUSES) {
      expect(canTransitionAlert('archived', to)).toBe(false);
    }
  });

  it('never allows a self-transition', () => {
    for (const s of ALERT_STATUSES) {
      expect(canTransitionAlert(s, s)).toBe(false);
    }
  });

  it('only declares known statuses as transition targets', () => {
    const known = new Set<AlertStatus>(ALERT_STATUSES);
    for (const from of ALERT_STATUSES) {
      for (const to of ALERT_TRANSITIONS[from]) {
        expect(known.has(to)).toBe(true);
      }
    }
  });
});
