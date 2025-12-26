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
 * Mask a field element to 250 bits (matches Cairo Mask250)
 * This is required to match the circuit's commitment calculation
 */
function mask250(value: bigint): bigint {
  const MASK_250 = (1n << 250n) - 1n;
  return value & MASK_250;
}

/**
 * Generate a commitment from secret, nullifier, and amount using BN254 Poseidon
 * Commitment = Mask(Poseidon(Mask(Poseidon(secret, nullifier)), amount))
 * This matches the circuit's calculation in swap.circom, membership.circom, etc.
 * 
 * NOTE: This function now uses BN254 Poseidon (via API) to match the circuit,
 * not Starknet's Poseidon which is incompatible.
 */
export async function generateCommitment(
  secret: bigint,
  nullifier: bigint,
  amount: bigint
): Promise<bigint> {
  // Use API endpoint to calculate commitment with BN254 Poseidon
  // This matches the circuit's Poseidon implementation (Circom/BN254)
  // The frontend's micro-starknet Poseidon uses a different field and is incompatible
  const response = await fetch("/api/commitment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: secret.toString(),
      nullifier: nullifier.toString(),
      amount: amount.toString(),
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || "Failed to generate commitment"
    );
  }

  const data = await response.json();
  return BigInt(data.commitment);
}

/**
 * Compute commitment using the OLD method (Starknet Poseidon)
 * This is used to verify if a note was created before the Poseidon fix
 */
export function computeLegacyCommitment(
  secret: bigint,
  nullifier: bigint,
  amount: bigint
): bigint {
  // Old method: used micro-starknet's Poseidon (Starknet field)
  // This is kept for compatibility checking only
  const hash1 = poseidonHashMany([secret, nullifier]);
  const masked1 = mask250(hash1);
  const hash2 = poseidonHashMany([masked1, amount]);
  const commitment = mask250(hash2);
  return commitment;
}

/**
 * Check if a note is a legacy note (created with old Poseidon method)
 */
export function isLegacyNote(note: Note): boolean {
  const legacyCommitment = computeLegacyCommitment(note.secret, note.nullifier, note.amount);
  return note.commitment === legacyCommitment;
}

/**
 * Verify and fix a note's commitment to ensure it matches BN254 Poseidon calculation
 * This is needed because notes created before the Poseidon fix may have incorrect commitments
 * 
 * If the note's stored commitment doesn't match calculations, we'll trust the Merkle tree
 * (which is the source of truth) and update the note's commitment to match what the circuit
 * will compute. If it's a legacy note, we return it as-is and let the Merkle proof check
 * handle the error.
 * 
 * @param note - The note to verify
 * @param merkleTreeCommitment - Optional: The commitment from the Merkle tree (source of truth)
 * @returns The note with potentially updated commitment
 */
export async function verifyAndFixCommitment(
  note: Note,
  merkleTreeCommitment?: bigint
): Promise<Note> {
  const correctCommitment = await generateCommitment(note.secret, note.nullifier, note.amount);
  
  // If commitment matches the new method, it's good
  if (note.commitment === correctCommitment) {
    return note;
  }
  
  // Check if it's a legacy note (old method)
  if (isLegacyNote(note)) {
    // This is a legacy note - we can't "fix" it because the Merkle tree has the old commitment
    // The user needs to withdraw and re-deposit
    return note; // Return as-is, the error will be caught later
  }
  
  // If we have the Merkle tree commitment, trust that as the source of truth
  if (merkleTreeCommitment !== undefined) {
    if (merkleTreeCommitment === correctCommitment) {
      // Merkle tree has the correct (BN254) commitment, but note's stored value is wrong
      // Update the note to match
      console.warn(
        `Note's stored commitment (${note.commitment.toString()}) doesn't match Merkle tree ` +
        `(${merkleTreeCommitment.toString()}). Updating note to match tree.`
      );
      return {
        ...note,
        commitment: merkleTreeCommitment,
      };
    } else if (merkleTreeCommitment === computeLegacyCommitment(note.secret, note.nullifier, note.amount)) {
      // Merkle tree has legacy commitment - this is a legacy note
      return note;
    }
  }
  
  // If it doesn't match either method and we don't have tree commitment, 
  // don't throw error - let the Merkle proof check handle it
  // The note's stored commitment might be wrong, but the tree is the source of truth
  console.warn(
    `Note commitment (${note.commitment.toString()}) doesn't match calculated values. ` +
    `BN254: ${correctCommitment.toString()}, Legacy: ${computeLegacyCommitment(note.secret, note.nullifier, note.amount).toString()}. ` +
    `Will verify against Merkle tree commitment.`
  );
  return note;
}

/**
 * Generate a new random note
 */
export async function generateNote(amount: bigint = 0n, tokenAddress?: string): Promise<Note> {
  const secret = generateRandomFelt();
  const nullifier = generateRandomFelt();
  const commitment = await generateCommitment(secret, nullifier, amount);

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
 * Handles decimal numbers by converting to string first
 */
export function toBigInt(value: string | number | bigint): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  
  if (typeof value === 'number') {
    // BigInt cannot handle decimals, so convert to string first
    // This will truncate decimals (e.g., 0.5 becomes 0)
    if (Number.isInteger(value)) {
      return BigInt(value);
    } else {
      // For decimals, convert to string and parse
      // This truncates the decimal part
      return BigInt(Math.floor(value));
    }
  }
  
  // String: handle hex or decimal
  if (typeof value === 'string') {
    // Remove whitespace
    const trimmed = value.trim();
    
    // Handle hex strings
    if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
      return BigInt(trimmed);
    }
    
    // Handle decimal strings (may contain decimal point)
    if (trimmed.includes('.')) {
      // Parse float and truncate to integer
      const floatValue = parseFloat(trimmed);
      return BigInt(Math.floor(floatValue));
    }
    
    // Regular integer string
    return BigInt(trimmed);
  }
  
  throw new Error(`Cannot convert ${value} to BigInt`);
}

