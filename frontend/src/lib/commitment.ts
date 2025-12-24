import { poseidonHashMany } from "micro-starknet";

// Starknet Field Modulus (approx 2^251.85)
// We use 31 bytes (248 bits) for random values to be safely within the field
const RANDOM_BYTES = 31;

export interface Note {
  secret: bigint;
  nullifier: bigint;
  amount: bigint;
  commitment: bigint;
  tokenAddress?: string;
  index?: number;
}

/**
 * Generate a commitment from secret, nullifier, and amount
 * Commitment = Poseidon(Poseidon(secret, nullifier), amount)
 */
export function generateCommitment(
  secret: bigint,
  nullifier: bigint,
  amount: bigint
): bigint {
  // First hash: Poseidon(secret, nullifier)
  const intermediate = poseidonHashMany([secret, nullifier]);
  
  // Second hash: Poseidon(intermediate, amount)
  const commitment = poseidonHashMany([intermediate, amount]);
  
  return commitment;
}

/**
 * Generate a new random note
 */
export function generateNote(amount: bigint = 0n, tokenAddress?: string): Note {
  const secret = generateRandomFelt();
  const nullifier = generateRandomFelt();
  const commitment = generateCommitment(secret, nullifier, amount);

  return {
    secret,
    nullifier,
    amount,
    commitment,
    tokenAddress
  };
}

/**
 * Generate a random Field Element (felt252)
 * Uses 31 bytes of randomness to ensure it fits in the field
 */
function generateRandomFelt(): bigint {
  const values = new Uint8Array(RANDOM_BYTES);
  crypto.getRandomValues(values);
  return BigInt("0x" + buf2hex(values));
}

function buf2hex(buffer: Uint8Array) { // buffer is an ArrayBuffer
  return [...new Uint8Array(buffer)]
      .map(x => x.toString(16).padStart(2, '0'))
      .join('');
}

/**
 * Format BigInt to hex string with 0x prefix
 */
export function toHex(value: bigint): string {
  return "0x" + value.toString(16);
}

/**
 * Parse hex string or number to BigInt
 */
export function toBigInt(value: string | number | bigint): bigint {
  return BigInt(value);
}

