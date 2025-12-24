/**
 * User-friendly error messages
 * Maps technical errors to human-readable messages
 */

export interface ErrorContext {
  operation?: 'deposit' | 'swap' | 'withdraw' | 'mint' | 'burn' | 'collect';
  amount?: bigint;
  balance?: bigint;
  token?: string;
}

/**
 * Convert technical error messages to user-friendly ones
 */
export function getUserFriendlyError(error: string | Error, context?: ErrorContext): string {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const lowerError = errorMessage.toLowerCase();

  // Account errors
  if (lowerError.includes('account not connected') || lowerError.includes('no account')) {
    return 'Please connect your wallet to continue';
  }

  // Balance errors
  if (lowerError.includes('insufficient balance') || lowerError.includes('exceeds')) {
    const balance = context?.balance ? formatAmount(context.balance) : 'your balance';
    return `Insufficient balance. You have ${balance} available`;
  }

  // Note errors
  if (lowerError.includes('note index') || lowerError.includes('leaf index')) {
    return 'Note is still syncing. Please wait a moment and try again';
  }

  if (lowerError.includes('note not found')) {
    return 'Note not found. Please refresh your portfolio';
  }

  // Validation errors
  if (lowerError.includes('invalid recipient') || lowerError.includes('invalid address')) {
    return 'Please enter a valid Starknet address (starts with 0x)';
  }

  if (lowerError.includes('amount must be') || lowerError.includes('amount must')) {
    return 'Please enter a valid amount greater than zero';
  }

  if (lowerError.includes('tick') && lowerError.includes('range')) {
    return 'Invalid price range. Lower tick must be less than upper tick';
  }

  // Proof errors
  if (lowerError.includes('proof') || lowerError.includes('verification')) {
    return 'Proof generation failed. Please try again';
  }

  if (lowerError.includes('merkle') || lowerError.includes('root')) {
    return 'Merkle tree sync issue. Please wait and try again';
  }

  // Network errors
  if (lowerError.includes('network') || lowerError.includes('rpc')) {
    return 'Network error. Please check your connection and try again';
  }

  if (lowerError.includes('timeout') || lowerError.includes('time out')) {
    return 'Request timed out. Please try again';
  }

  // Transaction errors
  if (lowerError.includes('transaction') && lowerError.includes('revert')) {
    return 'Transaction failed. Please check your inputs and try again';
  }

  if (lowerError.includes('user rejected') || lowerError.includes('rejected')) {
    return 'Transaction was cancelled';
  }

  // Generic fallback
  return errorMessage.length > 100 
    ? 'An error occurred. Please try again or contact support if the problem persists'
    : errorMessage;
}

/**
 * Format amount for display
 */
function formatAmount(amount: bigint, decimals: number = 18): string {
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  
  if (fraction === 0n) {
    return whole.toString();
  }
  
  const fractionStr = fraction.toString().padStart(decimals, '0');
  const trimmed = fractionStr.replace(/0+$/, '');
  
  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}

/**
 * Get error title based on operation
 */
export function getErrorTitle(operation?: string): string {
  switch (operation) {
    case 'deposit':
      return 'Deposit Failed';
    case 'swap':
      return 'Swap Failed';
    case 'withdraw':
      return 'Withdraw Failed';
    case 'mint':
      return 'Add Liquidity Failed';
    case 'burn':
      return 'Remove Liquidity Failed';
    case 'collect':
      return 'Collect Fees Failed';
    default:
      return 'Operation Failed';
  }
}

