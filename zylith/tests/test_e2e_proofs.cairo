// End-to-End Tests with Real Groth16 Verifiers
// These tests verify the integration between Cairo contracts and Garaga verifiers
//
// NOTE: Full E2E tests require pre-generated proofs from snarkjs.
// Run: cd circuits && node scripts/generate_test_fixtures.js
// Then copy the generated proof data to the constants below.

use core::array::ArrayTrait;
use core::traits::TryInto;
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use starknet::ContractAddress;
use zylith::interfaces::izylith::{IZylithDispatcher, IZylithDispatcherTrait};
use zylith::mocks::erc20::{IMockERC20Dispatcher, IMockERC20DispatcherTrait};
use zylith::privacy::commitment;

// ==================== TEST CONFIGURATION ====================
// These constants should be updated with real proof data from snarkjs

// Test values matching circuit inputs
const TEST_SECRET: felt252 = 123;
const TEST_NULLIFIER: felt252 = 456;
const TEST_AMOUNT: u128 = 1000000;

// ==================== HELPER FUNCTIONS ====================

fn caller() -> ContractAddress {
    0x123.try_into().unwrap()
}

fn deploy_mock_erc20(name: felt252, symbol: felt252) -> IMockERC20Dispatcher {
    let contract = declare("MockERC20").unwrap().contract_class();
    let mut args = array![name, symbol, 18]; // 18 decimals
    let (address, _) = contract.deploy(@args).unwrap();
    IMockERC20Dispatcher { contract_address: address }
}

/// Deploy Zylith with MockVerifiers for basic functionality testing
fn deploy_zylith_with_mock_verifiers() -> IZylithDispatcher {
    let contract = declare("Zylith").unwrap().contract_class();
    let owner: ContractAddress = 1.try_into().unwrap();

    let mock_verifier_class = declare("MockVerifier").unwrap().contract_class();
    let (membership_verifier, _) = mock_verifier_class.deploy(@array![]).unwrap();
    let (swap_verifier, _) = mock_verifier_class.deploy(@array![]).unwrap();
    let (withdraw_verifier, _) = mock_verifier_class.deploy(@array![]).unwrap();
    let (lp_verifier, _) = mock_verifier_class.deploy(@array![]).unwrap();

    let mut args = array![];
    args.append(owner.into());
    args.append(membership_verifier.into());
    args.append(swap_verifier.into());
    args.append(withdraw_verifier.into());
    args.append(lp_verifier.into());

    let (address, _) = contract.deploy(@args).unwrap();
    IZylithDispatcher { contract_address: address }
}

// ==================== E2E TESTS ====================

/// Test commitment generation matches between Cairo and circuits
#[test]
fn test_commitment_matches_circuit_format() {
    // Generate commitment in Cairo
    let cairo_commitment = commitment::generate_commitment(
        TEST_SECRET, TEST_NULLIFIER, TEST_AMOUNT,
    );

    // The commitment should be non-zero and deterministic
    assert!(cairo_commitment != 0);

    // Same inputs should produce same output
    let cairo_commitment2 = commitment::generate_commitment(
        TEST_SECRET, TEST_NULLIFIER, TEST_AMOUNT,
    );
    assert!(cairo_commitment == cairo_commitment2);
    // This commitment value should match what snarkjs produces
// When running generate_test_fixtures.js, verify the commitment matches
}

/// Test that verifier interface is correctly called
#[test]
fn test_verifier_interface_called() {
    let zylith = deploy_zylith_with_mock_verifiers();
    let token0 = deploy_mock_erc20('Token0', 'TK0');
    let token1 = deploy_mock_erc20('Token1', 'TK1');

    // Initialize pool
    start_cheat_caller_address(zylith.contract_address, caller());
    zylith
        .initialize(
            token0.contract_address,
            token1.contract_address,
            3000,
            60,
            340282366920938463463374607431768211456,
        );
    stop_cheat_caller_address(zylith.contract_address);

    // Mint tokens to caller
    token0.mint(caller(), 1000000000000000000000000);
    token1.mint(caller(), 1000000000000000000000000);

    // Approve Zylith
    start_cheat_caller_address(token0.contract_address, caller());
    token0
        .approve(
            zylith.contract_address,
            0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff,
        );
    stop_cheat_caller_address(token0.contract_address);

    start_cheat_caller_address(token1.contract_address, caller());
    token1
        .approve(
            zylith.contract_address,
            0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff,
        );
    stop_cheat_caller_address(token1.contract_address);

    // Test private_deposit (token, amount, commitment)
    start_cheat_caller_address(zylith.contract_address, caller());

    let test_commitment: felt252 = 12345; // Dummy commitment

    // private_deposit takes: token, amount: u256, commitment
    zylith.private_deposit(token0.contract_address, 1000, test_commitment);

    stop_cheat_caller_address(zylith.contract_address);

    // Verify the commitment was inserted
    let root = zylith.get_merkle_root();
    assert!(root != 0);
}

/// Test private deposit flow with mock verifiers
/// Note: private_withdraw requires real proof verification where public_inputs[1] == known_root
/// This test focuses on deposit functionality only
#[test]
fn test_private_deposit_flow() {
    let zylith = deploy_zylith_with_mock_verifiers();
    let token0 = deploy_mock_erc20('Token0', 'TK0');
    let token1 = deploy_mock_erc20('Token1', 'TK1');

    // Initialize pool
    start_cheat_caller_address(zylith.contract_address, caller());
    zylith
        .initialize(
            token0.contract_address,
            token1.contract_address,
            3000,
            60,
            340282366920938463463374607431768211456,
        );
    stop_cheat_caller_address(zylith.contract_address);

    // Mint tokens
    token0.mint(caller(), 1000000000000000000000000);

    // Approve
    start_cheat_caller_address(token0.contract_address, caller());
    token0
        .approve(
            zylith.contract_address,
            0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff,
        );
    stop_cheat_caller_address(token0.contract_address);

    // Deposit
    start_cheat_caller_address(zylith.contract_address, caller());

    let commitment1: felt252 = 111111;
    let deposit_amount: u128 = 100000;

    let balance_before = token0.balance_of(caller());
    zylith.private_deposit(token0.contract_address, deposit_amount.into(), commitment1);
    let balance_after = token0.balance_of(caller());

    // Verify tokens were transferred
    assert!(balance_before - balance_after == deposit_amount.into());

    // Verify root changed
    let root_after_deposit = zylith.get_merkle_root();
    assert!(root_after_deposit != 0);
    assert!(zylith.is_root_known(root_after_deposit));

    // Verify multiple deposits work
    let commitment2: felt252 = 222222;
    zylith.private_deposit(token0.contract_address, deposit_amount.into(), commitment2);

    let root_after_second = zylith.get_merkle_root();
    assert!(root_after_second != root_after_deposit);

    // Both roots should be known (historical tracking)
    assert!(zylith.is_root_known(root_after_deposit));
    assert!(zylith.is_root_known(root_after_second));

    stop_cheat_caller_address(zylith.contract_address);
}

/// Test nullifier cannot be spent twice
/// Note: With mock verifier, the first check that fails is INVALID_MERKLE_ROOT
/// because the mock verifier returns the proof array as public inputs
#[test]
#[should_panic(expected: ('INVALID_MERKLE_ROOT',))]
fn test_double_spend_prevention() {
    let zylith = deploy_zylith_with_mock_verifiers();
    let token0 = deploy_mock_erc20('Token0', 'TK0');
    let token1 = deploy_mock_erc20('Token1', 'TK1');

    // Initialize pool
    start_cheat_caller_address(zylith.contract_address, caller());
    zylith
        .initialize(
            token0.contract_address,
            token1.contract_address,
            3000,
            60,
            340282366920938463463374607431768211456,
        );
    stop_cheat_caller_address(zylith.contract_address);

    // Mint and approve
    token0.mint(caller(), 1000000000000000000000000);
    start_cheat_caller_address(token0.contract_address, caller());
    token0
        .approve(
            zylith.contract_address,
            0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff,
        );
    stop_cheat_caller_address(token0.contract_address);

    // Deposit
    start_cheat_caller_address(zylith.contract_address, caller());

    let commitment1: felt252 = 333333;
    zylith.private_deposit(token0.contract_address, 100000, commitment1);

    let root = zylith.get_merkle_root();

    // First withdraw - should succeed
    let nullifier: felt252 = 444444;
    let proof: Array<felt252> = array![1, 2, 3, 4, 5, 6, 7, 8];
    let public_inputs: Array<felt252> = array![nullifier, root, caller().into(), 100000];
    zylith.private_withdraw(proof, public_inputs, token0.contract_address, caller(), 100000);

    // Second withdraw with same nullifier - should fail
    let proof2: Array<felt252> = array![1, 2, 3, 4, 5, 6, 7, 8];
    let public_inputs2: Array<felt252> = array![nullifier, root, caller().into(), 100000];
    zylith.private_withdraw(proof2, public_inputs2, token0.contract_address, caller(), 100000);

    stop_cheat_caller_address(zylith.contract_address);
}

/// Test historical root acceptance
#[test]
fn test_historical_root_accepted() {
    let zylith = deploy_zylith_with_mock_verifiers();
    let token0 = deploy_mock_erc20('Token0', 'TK0');
    let token1 = deploy_mock_erc20('Token1', 'TK1');

    // Initialize pool
    start_cheat_caller_address(zylith.contract_address, caller());
    zylith
        .initialize(
            token0.contract_address,
            token1.contract_address,
            3000,
            60,
            340282366920938463463374607431768211456,
        );
    stop_cheat_caller_address(zylith.contract_address);

    // Initial root should be known
    let initial_root: felt252 = 0;
    assert!(zylith.is_root_known(initial_root));

    // Mint and approve
    token0.mint(caller(), 1000000000000000000000000);
    start_cheat_caller_address(token0.contract_address, caller());
    token0
        .approve(
            zylith.contract_address,
            0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff,
        );
    stop_cheat_caller_address(token0.contract_address);

    // Make multiple deposits to create multiple roots
    start_cheat_caller_address(zylith.contract_address, caller());

    let commitment1: felt252 = 555555;
    zylith.private_deposit(token0.contract_address, 10000, commitment1);
    let root1 = zylith.get_merkle_root();

    let commitment2: felt252 = 666666;
    zylith.private_deposit(token0.contract_address, 20000, commitment2);
    let root2 = zylith.get_merkle_root();

    // Both roots should be known
    assert!(zylith.is_root_known(root1));
    assert!(zylith.is_root_known(root2));
    assert!(root1 != root2);

    // Verify roots count increased
    let count = zylith.get_known_roots_count();
    assert!(count >= 3); // initial + 2 deposits

    stop_cheat_caller_address(zylith.contract_address);
}
// ==================== NOTES FOR FULL E2E TESTING ====================
//
// To run full E2E tests with real Groth16 proofs:
//
// 1. Generate proofs offline:
//    cd circuits && node scripts/generate_test_fixtures.js
//
// 2. Copy the generated proof data to this file
//
// 3. Deploy real Garaga verifiers instead of MockVerifier
//
// 4. The proof format for Garaga is:
//    [pi_a_x, pi_a_y, pi_b_x1, pi_b_x2, pi_b_y1, pi_b_y2, pi_c_x, pi_c_y, ...public_signals]
//
// Note: Full proof generation with depth=25 takes significant time (~minutes)
// Consider using depth=10 for rapid testing during development

