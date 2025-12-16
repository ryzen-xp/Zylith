// Privacy Tests - Merkle tree, commitments, and nullifiers

use starknet::ContractAddress;
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait,
    start_cheat_caller_address, stop_cheat_caller_address
};
use core::array::ArrayTrait;
use core::integer::u128;
use core::traits::TryInto;

use zylith::interfaces::izylith::IZylithDispatcher;
use zylith::interfaces::izylith::IZylithDispatcherTrait;
use zylith::privacy::commitment;

fn deploy_zylith() -> IZylithDispatcher {
    let contract = declare("Zylith").unwrap().contract_class();
    let owner: ContractAddress = 1.try_into().unwrap();
    let mut constructor_args = array![];
    constructor_args.append(owner.into());
    let (contract_address, _) = contract.deploy(@constructor_args).unwrap();
    IZylithDispatcher { contract_address }
}

#[test]
fn test_private_deposit() {
    let dispatcher = deploy_zylith();
    
    // Generate commitment
    let secret: felt252 = 12345;
    let nullifier: felt252 = 67890;
    let amount: u128 = 1000000;
    let commitment = commitment::generate_commitment(secret, nullifier, amount);
    
    // Deposit commitment
    dispatcher.private_deposit(commitment);
    
    // Verify root is updated
    let root = dispatcher.get_merkle_root();
    assert!(root != 0);
}

#[test]
fn test_private_deposit_empty_tree() {
    let dispatcher = deploy_zylith();
    
    // Initially root should be 0
    let root_before = dispatcher.get_merkle_root();
    assert!(root_before == 0);
    
    // Deposit first commitment
    let commitment = commitment::generate_commitment(1, 1, 1000);
    dispatcher.private_deposit(commitment);
    
    // Root should be non-zero
    let root_after = dispatcher.get_merkle_root();
    assert!(root_after != 0);
}

#[test]
fn test_commitment_generation() {
    // Test commitment generation
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
fn test_nullifier_tracking() {
    let dispatcher = deploy_zylith();
    
    let nullifier: felt252 = 99999;
    
    // Initially nullifier should not be spent
    let is_spent = dispatcher.is_nullifier_spent(nullifier);
    assert!(!is_spent);
    
    // Note: Actual nullifier spending happens in private_withdraw
    // This test verifies the tracking mechanism exists
}

#[test]
fn test_nullifier_uniqueness() {
    let dispatcher = deploy_zylith();
    
    let nullifier1: felt252 = 11111;
    let nullifier2: felt252 = 22222;
    
    // Both should be unspent initially
    assert!(!dispatcher.is_nullifier_spent(nullifier1));
    assert!(!dispatcher.is_nullifier_spent(nullifier2));
    
    // Different nullifiers should be independent
    assert!(nullifier1 != nullifier2);
}

#[test]
fn test_multiple_deposits() {
    let dispatcher = deploy_zylith();
    
    // Make multiple deposits
    let commitment1 = commitment::generate_commitment(1, 1, 1000);
    let commitment2 = commitment::generate_commitment(2, 2, 2000);
    let commitment3 = commitment::generate_commitment(3, 3, 3000);
    
    dispatcher.private_deposit(commitment1);
    let root1 = dispatcher.get_merkle_root();
    
    dispatcher.private_deposit(commitment2);
    let root2 = dispatcher.get_merkle_root();
    
    dispatcher.private_deposit(commitment3);
    let root3 = dispatcher.get_merkle_root();
    
    // Each deposit should change the root
    assert!(root1 != root2);
    assert!(root2 != root3);
    assert!(root1 != root3);
}

#[test]
fn test_merkle_root_consistency() {
    let dispatcher = deploy_zylith();
    
    // Deposit multiple commitments
    let commitments = array![
        commitment::generate_commitment(1, 1, 1000),
        commitment::generate_commitment(2, 2, 2000),
        commitment::generate_commitment(3, 3, 3000),
        commitment::generate_commitment(4, 4, 4000),
    ];
    
    let mut roots: Array<felt252> = ArrayTrait::new();
    
    // Deposit one by one and track roots
    let mut i: u32 = 0;
    while i < commitments.len() {
        dispatcher.private_deposit(*commitments.at(i));
        roots.append(dispatcher.get_merkle_root());
        i = i + 1;
    };
    
    // All roots should be different
    assert!(*roots.at(0) != *roots.at(1));
    assert!(*roots.at(1) != *roots.at(2));
    assert!(*roots.at(2) != *roots.at(3));
    assert!(*roots.at(0) != *roots.at(3));
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
    };
    
    // All commitments should be unique
    let mut i: u32 = 0;
    while i < commitments.len() {
        let mut j: u32 = i + 1;
        while j < commitments.len() {
            assert!(*commitments.at(i) != *commitments.at(j));
            j = j + 1;
        };
        i = i + 1;
    };
}

#[test]
fn test_large_amount_commitments() {
    let dispatcher = deploy_zylith();
    
    // Test with large amounts
    let large_amount: u128 = 1000000000000000; // 1e15
    let commitment = commitment::generate_commitment(12345, 67890, large_amount);
    
    dispatcher.private_deposit(commitment);
    
    let root = dispatcher.get_merkle_root();
    assert!(root != 0);
    
    // Verify commitment still works with large amount
    let is_valid = commitment::verify_commitment(commitment, 12345, 67890, large_amount);
    assert!(is_valid);
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
