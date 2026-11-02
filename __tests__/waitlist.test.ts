import { matchesWaitlistWindow, tryClaimWaitlistOffer } from '../src/services/waitlist';

describe('waitlist matching and race', () => {
  const slot = new Date('2026-11-04T15:00:00');

  it('matches a preferred day and time window', () => {
    expect(
      matchesWaitlistWindow({
        preferredDate: new Date('2026-11-04T00:00:00'),
        windowStart: '14:00',
        windowEnd: '16:00',
        slotStart: slot,
      })
    ).toBe(true);
    expect(
      matchesWaitlistWindow({
        preferredDate: new Date('2026-11-05T00:00:00'),
        windowStart: '14:00',
        windowEnd: '16:00',
        slotStart: slot,
      })
    ).toBe(false);
    expect(
      matchesWaitlistWindow({
        preferredDate: new Date('2026-11-04T00:00:00'),
        windowStart: '16:00',
        windowEnd: '18:00',
        slotStart: slot,
      })
    ).toBe(false);
  });

  it('lets the first YES claim the slot and rejects the second', () => {
    const expiresAt = new Date('2026-11-02T16:00:00Z');
    const now = new Date('2026-11-02T15:50:00Z');
    const offer = { status: 'OFFERED', offerExpiresAt: expiresAt };

    const first = tryClaimWaitlistOffer({ ...offer, now });
    expect(first).toBe('claimed');
    offer.status = 'ACCEPTED';

    const second = tryClaimWaitlistOffer({ ...offer, now });
    expect(second).toBe('taken');
  });

  it('expires stale offers before anyone can claim them', () => {
    const result = tryClaimWaitlistOffer({
      status: 'OFFERED',
      offerExpiresAt: new Date('2026-11-02T15:00:00Z'),
      now: new Date('2026-11-02T15:01:00Z'),
    });
    expect(result).toBe('expired');
  });

  it('simulates two concurrent YES replies with a shared lock', async () => {
    let locked = false;
    const claim = async () => {
      if (locked) return false;
      locked = true;
      const result = tryClaimWaitlistOffer({
        status: 'OFFERED',
        offerExpiresAt: new Date(Date.now() + 60_000),
      });
      if (result !== 'claimed') {
        locked = false;
        return false;
      }
      return true;
    };

    const [a, b] = await Promise.all([claim(), claim()]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
  });
});
