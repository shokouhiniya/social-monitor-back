import {
  ACTION_PLAN_INITIAL_STATUS,
  ACTION_PLAN_STATUSES,
  allowedTargetsForActionPlan,
  canTransitionActionPlan,
} from './action-plan.state-machine';

/**
 * تست واحد ماشین وضعیت ActionPlan (Requirement 9.2).
 */
describe('ActionPlan state machine', () => {
  it('uses "todo" as the valid initial status', () => {
    expect(ACTION_PLAN_INITIAL_STATUS).toBe('todo');
  });

  it('accepts the documented forward path', () => {
    expect(canTransitionActionPlan('todo', 'in_progress')).toBe(true);
    expect(canTransitionActionPlan('in_progress', 'done')).toBe(true);
  });

  it('accepts "* -> cancelled" except from done', () => {
    expect(canTransitionActionPlan('todo', 'cancelled')).toBe(true);
    expect(canTransitionActionPlan('in_progress', 'cancelled')).toBe(true);
    // از done نباید cancel شود
    expect(canTransitionActionPlan('done', 'cancelled')).toBe(false);
  });

  it('rejects skipping todo -> done directly', () => {
    expect(canTransitionActionPlan('todo', 'done')).toBe(false);
  });

  it('treats done and cancelled as terminal', () => {
    expect(allowedTargetsForActionPlan('done')).toEqual([]);
    expect(allowedTargetsForActionPlan('cancelled')).toEqual([]);
    for (const to of ACTION_PLAN_STATUSES) {
      expect(canTransitionActionPlan('done', to)).toBe(false);
      expect(canTransitionActionPlan('cancelled', to)).toBe(false);
    }
  });

  it('never allows a self-transition', () => {
    for (const s of ACTION_PLAN_STATUSES) {
      expect(canTransitionActionPlan(s, s)).toBe(false);
    }
  });
});
