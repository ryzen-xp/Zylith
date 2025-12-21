// Privacy Tests - Merkle tree, commitments, nullifiers, and root history

use core::array::ArrayTrait;
use core::integer::u128;
use core::traits::TryInto;
use snforge_std::{ContractClassTrait, DeclareResultTrait, declare, start_cheat_caller_address};
use starknet::ContractAddress;
use zylith::interfaces::izylith::{IZylithDispatcher, IZylithDispatcherTrait};
use zylith::privacy::commitment;

// Mock ERC20 token addresses (for testing without actual ERC20)
fn token0() -> ContractAddress {
    100.try_into().unwrap()
}

fn token1() -> ContractAddress {
    101.try_into().unwrap()
}

fn caller() -> ContractAddress {
    200.try_into().unwrap()
}

fn deploy_zylith() -> IZylithDispatcher {
    let contract = declare("Zylith").unwrap().contract_class();
    let owner: ContractAddress = 1.try_into().unwrap();
    let membership_verifier: ContractAddress = 2.try_into().unwrap();
    let swap_verifier: ContractAddress = 3.try_into().unwrap();
    let withdraw_verifier: ContractAddress = 4.try_into().unwrap();
    let lp_verifier: ContractAddress = 5.try_into().unwrap();

    let mut constructor_args = array![];
    constructor_args.append(owner.into());
    constructor_args.append(membership_verifier.into());
    constructor_args.append(swap_verifier.into());
    constructor_args.append(withdraw_verifier.into());
    constructor_args.append(lp_verifier.into());

    let (contract_address, _) = contract.deploy(@constructor_args).unwrap();
    IZylithDispatcher { contract_address }
}

fn deploy_and_initialize() -> IZylithDispatcher {
    let dispatcher = deploy_zylith();

    // Initialize with token0 and token1
    let fee: u128 = 3000; // 0.3%
    let tick_spacing: i32 = 60;
    let sqrt_price_x128: u256 = 79228162514264337593543950336; // Price 1:1

    dispatcher.initialize(token0(), token1(), fee, tick_spacing, sqrt_price_x128);

    dispatcher
}

// ==================== Commitment Tests ====================

#[test]
fn test_commitment_generation() {
    let secret: felt252 = 111;
    let nullifier: felt252 = 222;
    let amount: u128 = 1000;

    let commitment1 = commitment::generate_commitment(secret, nullifier, amount);
    let commitment2 = commitment::generate_commitment(secret, nullifier, amount);

    // Same inputs should produce same commitment
    assert!(commitment1 == commitment2);

    // Different inputs should produce different commitments
    let commitment3 = commitment::generate_commitment(secret + 1, nullifier, amount);
    assert!(commitment1 != commitment3);

    let commitment4 = commitment::generate_commitment(secret, nullifier + 1, amount);
    assert!(commitment1 != commitment4);

    let commitment5 = commitment::generate_commitment(secret, nullifier, amount + 1);
    assert!(commitment1 != commitment5);
}

#[test]
fn test_commitment_verification() {
    let secret: felt252 = 555;
    let nullifier: felt252 = 666;
    let amount: u128 = 5000;

    let commitment = commitment::generate_commitment(secret, nullifier, amount);
    let is_valid = commitment::verify_commitment(commitment, secret, nullifier, amount);

    assert!(is_valid);

    // Wrong secret should fail
    let is_invalid = commitment::verify_commitment(commitment, secret + 1, nullifier, amount);
    assert!(!is_invalid);

    // Wrong nullifier should fail
    let is_invalid2 = commitment::verify_commitment(commitment, secret, nullifier + 1, amount);
    assert!(!is_invalid2);

    // Wrong amount should fail
    let is_invalid3 = commitment::verify_commitment(commitment, secret, nullifier, amount + 1);
    assert!(!is_invalid3);
}

#[test]
fn test_commitment_determinism() {
    // Test that same inputs always produce same commitment
    let secret: felt252 = 42;
    let nullifier: felt252 = 24;
    let amount: u128 = 100;

    let commitment1 = commitment::generate_commitment(secret, nullifier, amount);
    let commitment2 = commitment::generate_commitment(secret, nullifier, amount);
    let commitment3 = commitment::generate_commitment(secret, nullifier, amount);

    assert!(commitment1 == commitment2);
    assert!(commitment2 == commitment3);
    assert!(commitment1 == commitment3);
}

#[test]
fn test_commitment_collision_resistance() {
    // Test that different inputs produce different commitments
    let mut commitments: Array<felt252> = ArrayTrait::new();

    // Generate many commitments with different inputs
    let mut i: u128 = 1;
    while i <= 10 {
        let secret: felt252 = i.try_into().unwrap();
        let nullifier: felt252 = (i * 100).try_into().unwrap();
        let amount: u128 = i * 1000;
        let commitment = commitment::generate_commitment(secret, nullifier, amount);
        commitments.append(commitment);
        i = i + 1;
    }

    // All commitments should be unique
    let mut i: u32 = 0;
    while i < commitments.len() {
        let mut j: u32 = i + 1;
        while j < commitments.len() {
            assert!(*commitments.at(i) != *commitments.at(j));
            j = j + 1;
        }
        i = i + 1;
    };
}

#[test]
fn test_zero_amount_commitment() {
    // Test commitment with zero amount
    let commitment = commitment::generate_commitment(1, 1, 0);

    // Should still generate a valid commitment
    let is_valid = commitment::verify_commitment(commitment, 1, 1, 0);
    assert!(is_valid);
}

#[test]
fn test_large_amount_commitments() {
    // Test with large amounts
    let large_amount: u128 = 1000000000000000; // 1e15
    let commitment = commitment::generate_commitment(12345, 67890, large_amount);

    // Verify commitment still works with large amount
    let is_valid = commitment::verify_commitment(commitment, 12345, 67890, large_amount);
    assert!(is_valid);
}

// ==================== Merkle Root Tests ====================

#[test]
fn test_initial_merkle_root() {
    let dispatcher = deploy_and_initialize();

    // After initialization, root should be 0 (empty tree)
    let root = dispatcher.get_merkle_root();
    assert!(root == 0);
}

#[test]
fn test_is_root_known_initial() {
    let dispatcher = deploy_and_initialize();

    // Initial root (0) should be known
    let initial_root: felt252 = 0;
    let is_known = dispatcher.is_root_known(initial_root);
    assert!(is_known);

    // Random root should not be known
    let random_root: felt252 = 12345;
    let is_unknown = dispatcher.is_root_known(random_root);
    assert!(!is_unknown);
}

#[test]
fn test_known_roots_count_initial() {
    let dispatcher = deploy_and_initialize();

    // Should have 1 known root initially (the empty tree root)
    let count = dispatcher.get_known_roots_count();
    assert!(count == 1);
}

// ==================== Nullifier Tests ====================

#[test]
fn test_nullifier_initially_unspent() {
    let dispatcher = deploy_and_initialize();

    let nullifier: felt252 = 99999;

    // Initially nullifier should not be spent
    let is_spent = dispatcher.is_nullifier_spent(nullifier);
    assert!(!is_spent);
}

#[test]
fn test_nullifier_uniqueness() {
    let dispatcher = deploy_and_initialize();

    let nullifier1: felt252 = 11111;
    let nullifier2: felt252 = 22222;

    // Both should be unspent initially
    assert!(!dispatcher.is_nullifier_spent(nullifier1));
    assert!(!dispatcher.is_nullifier_spent(nullifier2));

    // Different nullifiers should be independent
    assert!(nullifier1 != nullifier2);
}
// ==================== Integration Tests ====================
// Note: Full integration tests with private_deposit require mocking ERC20 transfers
// These would be in a separate integration test file with proper ERC20 mocks

