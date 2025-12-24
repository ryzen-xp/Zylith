import { describe, it, expect } from '@jest/globals';
import { getUserFriendlyError, getErrorTitle } from '../error-messages';

describe('Error Messages', () => {
  describe('getUserFriendlyError', () => {
    it('should convert account errors', () => {
      const error = 'Account not connected';
      const result = getUserFriendlyError(error);
      expect(result).toBe('Please connect your wallet to continue');
    });

    it('should convert balance errors', () => {
      const error = 'Insufficient balance';
      const result = getUserFriendlyError(error, { balance: 1000000000000000000n });
      expect(result).toContain('Insufficient balance');
      expect(result).toContain('available');
    });

    it('should convert note index errors', () => {
      const error = 'Note index not found';
      const result = getUserFriendlyError(error);
      expect(result).toContain('syncing');
    });

    it('should convert invalid address errors', () => {
      const error = 'Invalid recipient address';
      const result = getUserFriendlyError(error);
      expect(result).toContain('valid Starknet address');
    });

    it('should convert tick range errors', () => {
      const error = 'Invalid tick range';
      const result = getUserFriendlyError(error);
      expect(result).toContain('price range');
    });

    it('should convert proof errors', () => {
      const error = 'Proof generation failed';
      const result = getUserFriendlyError(error);
      expect(result).toContain('Proof generation');
    });

    it('should truncate very long errors', () => {
      const longError = 'A'.repeat(200);
      const result = getUserFriendlyError(longError);
      expect(result.length).toBeLessThan(longError.length);
      expect(result).toContain('error occurred');
    });

    it('should preserve short meaningful errors', () => {
      const error = 'Custom error message';
      const result = getUserFriendlyError(error);
      expect(result).toBe('Custom error message');
    });
  });

  describe('getErrorTitle', () => {
    it('should return correct title for deposit', () => {
      expect(getErrorTitle('deposit')).toBe('Deposit Failed');
    });

    it('should return correct title for swap', () => {
      expect(getErrorTitle('swap')).toBe('Swap Failed');
    });

    it('should return correct title for withdraw', () => {
      expect(getErrorTitle('withdraw')).toBe('Withdraw Failed');
    });

    it('should return default title for unknown operation', () => {
      expect(getErrorTitle('unknown')).toBe('Operation Failed');
    });

    it('should return default title when no operation provided', () => {
      expect(getErrorTitle()).toBe('Operation Failed');
    });
  });
});

