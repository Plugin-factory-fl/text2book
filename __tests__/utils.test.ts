import { describe, it, expect } from '@jest/globals';
import { formatPhoneNumber, formatCurrency, formatDuration, cn } from '../src/lib/utils';

describe('Utility Functions', () => {
  describe('formatPhoneNumber', () => {
    it('should format 10 digit US phone numbers', () => {
      expect(formatPhoneNumber('5551234567')).toBe('(555) 123-4567');
    });

    it('should format 11 digit US phone numbers with country code', () => {
      expect(formatPhoneNumber('15551234567')).toBe('+1 (555) 123-4567');
    });

    it('should return unformatted number for other formats', () => {
      expect(formatPhoneNumber('+44123456789')).toBe('+44123456789');
    });
  });

  describe('formatCurrency', () => {
    it('should format currency values', () => {
      expect(formatCurrency(19.99)).toBe('$19.99');
      expect(formatCurrency(100)).toBe('$100.00');
      expect(formatCurrency(0)).toBe('$0.00');
    });
  });

  describe('formatDuration', () => {
    it('should format minutes under an hour', () => {
      expect(formatDuration(30)).toBe('30 min');
      expect(formatDuration(45)).toBe('45 min');
    });

    it('should format exact hours', () => {
      expect(formatDuration(60)).toBe('1 hr');
      expect(formatDuration(120)).toBe('2 hr');
    });

    it('should format hours and minutes', () => {
      expect(formatDuration(90)).toBe('1 hr 30 min');
      expect(formatDuration(150)).toBe('2 hr 30 min');
    });
  });

  describe('cn', () => {
    it('should merge class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('should handle conditional classes', () => {
      expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
    });

    it('should handle conflicting tailwind classes', () => {
      expect(cn('p-4', 'p-8')).toBe('p-8');
    });
  });
});
