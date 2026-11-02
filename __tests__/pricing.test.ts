import {
  PLAN_TIERS,
  SEGMENT_VARIABLE_COST_USD,
  TARGET_GROSS_MARGIN,
  countSmsSegments,
  grossMargin,
  isAtCap,
  isAtWarning,
  maxSegmentsForMargin,
  nextTierId,
  shouldAllowInProgressConversation,
  totalCostUsd,
} from '../src/config/pricing';

describe('pricing math', () => {
  it('keeps at least 50% gross margin at each published allowance', () => {
    for (const plan of Object.values(PLAN_TIERS)) {
      const margin = grossMargin(plan.monthlyPriceUsd, plan.includedSegments);
      expect(margin).toBeGreaterThanOrEqual(TARGET_GROSS_MARGIN);
      expect(plan.includedSegments).toBeLessThanOrEqual(
        maxSegmentsForMargin(plan.monthlyPriceUsd)
      );
    }
  });

  it('publishes the documented allowances', () => {
    expect(PLAN_TIERS.STARTER.includedSegments).toBe(500);
    expect(PLAN_TIERS.GROWTH.includedSegments).toBe(850);
    expect(PLAN_TIERS.PRO.includedSegments).toBe(1200);
    expect(PLAN_TIERS.STARTER.monthlyPriceUsd).toBe(19.99);
    expect(PLAN_TIERS.GROWTH.monthlyPriceUsd).toBe(29.99);
    expect(PLAN_TIERS.PRO.monthlyPriceUsd).toBe(39.99);
  });

  it('matches the documented starter margin near 50.95%', () => {
    const margin = grossMargin(19.99, 500);
    expect(margin).toBeGreaterThan(0.509);
    expect(margin).toBeLessThan(0.511);
    expect(totalCostUsd(19.99, 500)).toBeLessThan(19.99 * 0.5);
    expect(SEGMENT_VARIABLE_COST_USD).toBeCloseTo(0.01255, 5);
  });

  it('warns at 80% and caps at 100%', () => {
    expect(isAtWarning(400, 500)).toBe(true);
    expect(isAtWarning(399, 500)).toBe(false);
    expect(isAtCap(500, 500)).toBe(true);
    expect(isAtCap(499, 500)).toBe(false);
  });

  it('never drops an in progress booking at the cap', () => {
    expect(
      shouldAllowInProgressConversation({
        atCap: true,
        hasInProgressBooking: true,
      })
    ).toBe(true);
    expect(
      shouldAllowInProgressConversation({
        atCap: true,
        hasInProgressBooking: false,
        conversationState: 'CONFIRMING',
      })
    ).toBe(true);
    expect(
      shouldAllowInProgressConversation({
        atCap: true,
        hasInProgressBooking: false,
        conversationState: 'GREETING',
      })
    ).toBe(false);
    expect(
      shouldAllowInProgressConversation({
        atCap: false,
        hasInProgressBooking: false,
        conversationState: 'GREETING',
      })
    ).toBe(true);
  });

  it('points Starter and Growth at the next tier and Pro at contact', () => {
    expect(nextTierId('STARTER')).toBe('GROWTH');
    expect(nextTierId('GROWTH')).toBe('PRO');
    expect(nextTierId('PRO')).toBeNull();
  });

  it('counts GSM and unicode SMS segments', () => {
    expect(countSmsSegments('Hi')).toBe(1);
    expect(countSmsSegments('a'.repeat(160))).toBe(1);
    expect(countSmsSegments('a'.repeat(161))).toBe(2);
    expect(countSmsSegments('é'.repeat(70))).toBe(1);
    expect(countSmsSegments('é'.repeat(71))).toBe(2);
  });
});
