use ark_bn254::Fr;
use ark_ff::{BigInteger, PrimeField};
use light_poseidon::{Poseidon, PoseidonHasher};
use num_bigint::BigUint;
use num_traits::Num;

/// Mask used in Cairo contract to ensure BN254 hash fits in felt252
/// 0x3ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff (250 bits)
const MASK: &str = "3ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

/// Generate a commitment from secret, nullifier, and amount
/// Replicates the logic from zylith/src/privacy/commitment.cairo
/// Formula: Poseidon(Poseidon(secret, nullifier), amount)
pub fn generate_commitment(secret: &str, nullifier: &str, amount: u128) -> Result<String, String> {
    let mask = BigUint::from_str_radix(MASK, 16)
        .map_err(|_| "Failed to parse mask".to_string())?;

    // Parse inputs to Fr
    let secret_fr = parse_felt_to_fr(secret)?;
    let nullifier_fr = parse_felt_to_fr(nullifier)?;
    let amount_fr = Fr::from(amount);

    // First hash: Poseidon(secret, nullifier)
    let mut poseidon1 = Poseidon::<Fr>::new_circom(2)
        .map_err(|e| format!("Failed to create Poseidon hasher: {:?}", e))?;
    let intermediate = poseidon1.hash(&[secret_fr, nullifier_fr])
        .map_err(|e| format!("Failed to hash: {:?}", e))?;

    // Second hash: Poseidon(intermediate, amount)
    let mut poseidon2 = Poseidon::<Fr>::new_circom(2)
        .map_err(|e| format!("Failed to create Poseidon hasher: {:?}", e))?;
    let result = poseidon2.hash(&[intermediate, amount_fr])
        .map_err(|e| format!("Failed to hash: {:?}", e))?;

    // Convert to BigUint and apply mask
    let result_big = biguint_from_fr(&result);
    let safe_val = result_big & mask;

    // Convert to hex string
    Ok(format!("0x{:x}", safe_val))
}

/// Generate random secret and nullifier
pub fn generate_note() -> (String, String) {
    use rand::Rng;
    
    let mut rng = rand::thread_rng();
    
    // Generate 32 random bytes for secret
    let secret_bytes: Vec<u8> = (0..32).map(|_| rng.gen()).collect();
    let secret = format!("0x{}", hex::encode(secret_bytes));
    
    // Generate 32 random bytes for nullifier
    let nullifier_bytes: Vec<u8> = (0..32).map(|_| rng.gen()).collect();
    let nullifier = format!("0x{}", hex::encode(nullifier_bytes));
    
    (secret, nullifier)
}

/// Parse felt252 from hex string to Fr
fn parse_felt_to_fr(hex_str: &str) -> Result<Fr, String> {
    let cleaned = hex_str.trim_start_matches("0x");
    let big = BigUint::from_str_radix(cleaned, 16)
        .map_err(|e| format!("Failed to parse felt252: {}", e))?;
    
    // Convert BigUint to Fr using from_be_bytes_mod_order
    let bytes = big.to_bytes_be();
    let mut buf = [0u8; 32];
    let len = bytes.len().min(32);
    buf[32 - len..].copy_from_slice(&bytes[bytes.len().saturating_sub(len)..]);
    
    Ok(Fr::from_be_bytes_mod_order(&buf))
}

/// Convert Fr to BigUint
fn biguint_from_fr(fr: &Fr) -> BigUint {
    let bytes = fr.into_bigint().to_bytes_be();
    BigUint::from_bytes_be(&bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_commitment() {
        let secret = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
        let nullifier = "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321";
        let amount = 1000000000000000000u128; // 1 token with 18 decimals
        
        let commitment = generate_commitment(secret, nullifier, amount).unwrap();
        assert!(commitment.starts_with("0x"));
        assert_eq!(commitment.len(), 66); // 0x + 64 hex chars
    }

    #[test]
    fn test_generate_note() {
        let (secret, nullifier) = generate_note();
        assert!(secret.starts_with("0x"));
        assert!(nullifier.starts_with("0x"));
        assert_eq!(secret.len(), 66);
        assert_eq!(nullifier.len(), 66);
    }
}

