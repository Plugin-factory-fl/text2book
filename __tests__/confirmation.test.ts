import { isAffirmativeReply, shouldExpireYesHold, yesConfirmMessage } from '../src/services/confirmation';

describe('YES confirmation', () => {
  it('accepts common YES replies', () => {
    expect(isAffirmativeReply('YES')).toBe(true);
    expect(isAffirmativeReply('yes!')).toBe(true);
    expect(isAffirmativeReply(' yep ')).toBe(true);
    expect(isAffirmativeReply('confirm')).toBe(true);
    expect(isAffirmativeReply('no')).toBe(false);
    expect(isAffirmativeReply('maybe later')).toBe(false);
  });

  it('holds AI bookings as pending until YES or expiry', () => {
    const now = new Date('2026-11-02T12:00:00Z');
    expect(
      shouldExpireYesHold(
        {
          yesConfirmRequired: true,
          yesConfirmedAt: null,
          yesConfirmExpiresAt: new Date('2026-11-02T11:00:00Z'),
          status: 'PENDING',
        },
        now
      )
    ).toBe(true);

    expect(
      shouldExpireYesHold(
        {
          yesConfirmRequired: true,
          yesConfirmedAt: new Date('2026-11-02T11:30:00Z'),
          yesConfirmExpiresAt: new Date('2026-11-02T11:00:00Z'),
          status: 'CONFIRMED',
        },
        now
      )
    ).toBe(false);

    expect(
      shouldExpireYesHold(
        {
          yesConfirmRequired: true,
          yesConfirmedAt: null,
          yesConfirmExpiresAt: new Date('2026-11-02T13:00:00Z'),
          status: 'PENDING',
        },
        now
      )
    ).toBe(false);
  });

  it('asks for YES without dashes in the SMS copy', () => {
    const message = yesConfirmMessage({
      serviceName: "Women's Haircut",
      startTime: new Date('2026-11-03T14:00:00'),
      minutes: 60,
    });
    expect(message.startsWith('Reply YES to confirm')).toBe(true);
    expect(message.includes('—')).toBe(false);
    expect(message.includes('–')).toBe(false);
    expect(message.includes(' - ')).toBe(false);
  });
});
