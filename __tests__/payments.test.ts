import {
  PAYMENT_PROMPT_BODY,
  remainderCents,
  shouldPromptForInPersonPayment,
} from '../src/services/payments';

describe('in person payment prompt', () => {
  const past = new Date('2026-10-01T15:00:00Z');
  const future = new Date('2026-12-01T15:00:00Z');
  const now = new Date('2026-11-02T18:00:00Z');

  it('uses the required Chief copy', () => {
    expect(PAYMENT_PROMPT_BODY).toBe(
      'The appointment has passed but no payment has yet been recorded. Did they pay the remainder of the service in person?'
    );
    expect(PAYMENT_PROMPT_BODY.includes('—')).toBe(false);
    expect(PAYMENT_PROMPT_BODY.includes('–')).toBe(false);
    expect(PAYMENT_PROMPT_BODY.includes(' - ')).toBe(false);
  });

  it('computes remainder after a paid deposit', () => {
    expect(
      remainderCents({
        priceUsd: 65,
        depositStatus: 'PAID',
        depositAmountCents: 2000,
      })
    ).toBe(4500);
    expect(
      remainderCents({
        priceUsd: 35,
        depositStatus: 'NOT_REQUIRED',
        depositAmountCents: null,
      })
    ).toBe(3500);
    expect(
      remainderCents({
        priceUsd: 20,
        depositStatus: 'PAID',
        depositAmountCents: 2000,
      })
    ).toBe(0);
  });

  it('prompts after the slot ends when a remainder is unpaid', () => {
    expect(
      shouldPromptForInPersonPayment(
        {
          endTime: past,
          status: 'CONFIRMED',
          paymentStatus: 'UNPAID',
          paymentPromptSent: false,
          price: 65,
          depositStatus: 'PAID',
          depositAmount: 2000,
        },
        now
      )
    ).toBe(true);
  });

  it('prompts when a trusted client had the deposit waived', () => {
    expect(
      shouldPromptForInPersonPayment(
        {
          endTime: past,
          status: 'CONFIRMED',
          paymentStatus: 'UNPAID',
          paymentPromptSent: false,
          price: 65,
          depositStatus: 'NOT_REQUIRED',
          depositAmount: null,
        },
        now
      )
    ).toBe(true);
  });

  it('does not prompt before the slot ends or after a decision', () => {
    expect(
      shouldPromptForInPersonPayment(
        {
          endTime: future,
          status: 'CONFIRMED',
          paymentStatus: 'UNPAID',
          paymentPromptSent: false,
          price: 65,
          depositStatus: 'NOT_REQUIRED',
          depositAmount: null,
        },
        now
      )
    ).toBe(false);

    expect(
      shouldPromptForInPersonPayment(
        {
          endTime: past,
          status: 'CONFIRMED',
          paymentStatus: 'PAID',
          paymentPromptSent: false,
          price: 65,
          depositStatus: 'NOT_REQUIRED',
          depositAmount: null,
        },
        now
      )
    ).toBe(false);

    expect(
      shouldPromptForInPersonPayment(
        {
          endTime: past,
          status: 'CONFIRMED',
          paymentStatus: 'UNPAID',
          paymentPromptSent: true,
          price: 65,
          depositStatus: 'NOT_REQUIRED',
          depositAmount: null,
        },
        now
      )
    ).toBe(false);
  });
});
