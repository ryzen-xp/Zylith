// Commitment System - Hash(Hash(secret, nullifier), amount)
use core::integer::u128;
use garaga::definitions::u384;
use garaga::hashes::poseidon_hash_2_bn254;
use starknet::storage::*;

/// Generate a commitment from secret, nullifier, and amount\

pub fn generate_commitment(secret: felt252, nullifier: felt252, amount: u128) -> felt252 {
    let state1: u384 = poseidon_hash_2_bn254(secret.into(), nullifier.into());
    let state2: u256 = poseidon_hash_2_bn254(state1, amount.into()).try_into().unwrap();

    state2.try_into().unwrap()
}

/// Verify a commitment matches the expected values
pub fn verify_commitment(
    commitment: felt252, secret: felt252, nullifier: felt252, amount: u128,
) -> bool {
    let computed = generate_commitment(secret, nullifier, amount);
    commitment.into() == computed
}

#[starknet::storage_node]
pub struct NullifierStorage {
    // Track spent nullifiers to prevent double spending
    pub spent_nullifiers: Map<felt252, bool>,
}

// Nullifier storage node definition
// Functions using this storage will be implemented in the main Zylith contract
// Storage nodes can only be accessed from within a #[starknet::contract] module

/// Check if a nullifier has been spent (pure function, no storage access)
/// NOTE: Actual implementation will be in the main contract
pub fn is_nullifier_spent(_nullifier: felt252) -> bool {
    // TODO: Implement in main contract
    false
}

/// Mark a nullifier as spent (pure function, no storage access)
/// NOTE: Actual implementation will be in the main contract
pub fn mark_nullifier_spent(_nullifier: felt252) { // TODO: Implement in main contract
}

