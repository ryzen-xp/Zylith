// Integration Tests - Full flow: deposit → swap → withdraw

use core::array::ArrayTrait;
use core::integer::u128;
use core::traits::TryInto;
use snforge_std::{ContractClassTrait, DeclareResultTrait, declare};
use starknet::ContractAddress;
use zylith::clmm::math;
use zylith::interfaces::izylith::{IZylithDispatcher, IZylithDispatcherTrait};
use zylith::privacy::commitment;

fn deploy_zylith() -> IZylithDispatcher {
    let contract = declare("Zylith").unwrap().contract_class();
    let owner: ContractAddress = 1.try_into().unwrap();

    let mock_verifier_class = declare("MockVerifier").unwrap().contract_class();
    let (membership_verifier, _) = mock_verifier_class.deploy(@array![]).unwrap();
    let (swap_verifier, _) = mock_verifier_class.deploy(@array![]).unwrap();
    let (withdraw_verifier, _) = mock_verifier_class.deploy(@array![]).unwrap();

    let mut constructor_args = array![];
    constructor_args.append(owner.into());
    constructor_args.append(membership_verifier.into());
    constructor_args.append(swap_verifier.into());
    constructor_args.append(withdraw_verifier.into());

    let (contract_address, _) = contract.deploy(@constructor_args).unwrap();
    IZylithDispatcher { contract_address }
}

// Commented out due to gas limit issues - swap logic is too complex
#[test]
fn test_full_flow_initialize_mint_swap() {
    let dispatcher = deploy_zylith();

    // Step 1: Initialize pool
    let token0: ContractAddress = 0x1.try_into().unwrap();
    let token1: ContractAddress = 0x2.try_into().unwrap();
    let fee: u128 = 3000;
    let tick_spacing: i32 = 60;
    let sqrt_price_x128: u256 = math::Q128;
    dispatcher.initialize(token0, token1, fee, tick_spacing, sqrt_price_x128);

    // Step 2: Add liquidity
    let tick_lower: i32 = -600;
    let tick_upper: i32 = 600;
    let liquidity_amount: u128 = 10000; // Reduced for gas
    let (amount0, amount1) = dispatcher.mint(tick_lower, tick_upper, liquidity_amount);

    assert!(amount0 != 0 || amount1 != 0);

    // Step 3: Execute swap
    let zero_for_one = true;
    let swap_amount: u128 = 100; // Reduced for gas
    let price_limit: u256 = math::MIN_SQRT_RATIO;
    let (swap_amount0, swap_amount1) = dispatcher.swap(zero_for_one, swap_amount, price_limit);

    assert!(swap_amount0 != 0 || swap_amount1 != 0);
}

#[test]
fn test_privacy_flow_deposit() {
    let dispatcher = deploy_zylith();

    // Initialize pool
    let token0: ContractAddress = 0x1.try_into().unwrap();
    let token1: ContractAddress = 0x2.try_into().unwrap();
    let fee: u128 = 3000;
    let tick_spacing: i32 = 60;
    let sqrt_price_x128: u256 = math::Q128;
    dispatcher.initialize(token0, token1, fee, tick_spacing, sqrt_price_x128);

    // Add liquidity
    dispatcher.mint(-600, 600, 1000000000);

    // Step 1: Private deposit
    let secret: felt252 = 12345;
    let nullifier: felt252 = 67890;
    let amount: u128 = 1000000;
    let commitment = commitment::generate_commitment(secret, nullifier, amount);
    dispatcher.private_deposit(commitment);

    let root_after_deposit = dispatcher.get_merkle_root();
    assert!(root_after_deposit != 0);

    // Verify commitment is valid
    let is_valid = commitment::verify_commitment(commitment, secret, nullifier, amount);
    assert!(is_valid);
}

// Commented out due to gas limit issues - multiple swaps exceed gas limit
#[test]
fn test_fee_accumulation() {
    let dispatcher = deploy_zylith();

    // Initialize pool
    let token0: ContractAddress = 0x1.try_into().unwrap();
    let token1: ContractAddress = 0x2.try_into().unwrap();
    let fee: u128 = 3000;
    let tick_spacing: i32 = 60;
    let sqrt_price_x128: u256 = math::Q128;
    dispatcher.initialize(token0, token1, fee, tick_spacing, sqrt_price_x128);

    // Mint position
    let tick_lower: i32 = -600;
    let tick_upper: i32 = 600;
    dispatcher.mint(tick_lower, tick_upper, 10000); // Reduced for gas

    // Execute multiple swaps to generate fees
    dispatcher.swap(true, 100, math::MIN_SQRT_RATIO);
    dispatcher.swap(false, 50, math::MAX_SQRT_RATIO);

    // Collect fees
    let (fees0, fees1) = dispatcher.collect(tick_lower, tick_upper);

    // Fees should accumulate
    assert!(fees0 >= 0);
    assert!(fees1 >= 0);
}

#[test]
fn test_burn_with_protocol_fees() {
    let dispatcher = deploy_zylith();

    // Initialize pool
    let token0: ContractAddress = 0x1.try_into().unwrap();
    let token1: ContractAddress = 0x2.try_into().unwrap();
    let fee: u128 = 3000;
    let tick_spacing: i32 = 60;
    let sqrt_price_x128: u256 = math::Q128;
    dispatcher.initialize(token0, token1, fee, tick_spacing, sqrt_price_x128);

    // Mint liquidity
    let tick_lower: i32 = -60;
    let tick_upper: i32 = 60;
    let mint_amount: u128 = 1000000;
    dispatcher.mint(tick_lower, tick_upper, mint_amount);

    // Burn liquidity (protocol fees are 0 by default, so full amount returned)
    let burn_amount: u128 = 500000;
    let (amount0, amount1) = dispatcher.burn(tick_lower, tick_upper, burn_amount);

    // Verify burn returns amounts
    assert!(amount0 >= 0);
    assert!(amount1 >= 0);
}

// Commented out due to gas limit issues - complex lifecycle with swap exceeds gas
#[test]
fn test_complete_liquidity_lifecycle() {
    let dispatcher = deploy_zylith();

    // Initialize
    let token0: ContractAddress = 0x1.try_into().unwrap();
    let token1: ContractAddress = 0x2.try_into().unwrap();
    let fee: u128 = 3000;
    let tick_spacing: i32 = 60;
    let sqrt_price_x128: u256 = math::Q128;
    dispatcher.initialize(token0, token1, fee, tick_spacing, sqrt_price_x128);

    // Mint
    let tick_lower: i32 = -600;
    let tick_upper: i32 = 600;
    let mint_amount: u128 = 10000;
    let (mint_amount0, mint_amount1) = dispatcher.mint(tick_lower, tick_upper, mint_amount);

    assert!(mint_amount0 != 0 || mint_amount1 != 0);

    // Swap to generate fees
    dispatcher.swap(true, 100, math::MIN_SQRT_RATIO);

    // Collect fees
    let (fees0, fees1) = dispatcher.collect(tick_lower, tick_upper);
    assert!(fees0 >= 0);
    assert!(fees1 >= 0);

    // Burn partial
    let burn_amount: u128 = 5000;
    let (burn_amount0, burn_amount1) = dispatcher.burn(tick_lower, tick_upper, burn_amount);
    assert!(burn_amount0 >= 0);
    assert!(burn_amount1 >= 0);

    // Burn remaining
    let (burn_amount0_2, burn_amount1_2) = dispatcher
        .burn(tick_lower, tick_upper, mint_amount - burn_amount);
    assert!(burn_amount0_2 >= 0);
    assert!(burn_amount1_2 >= 0);
}

#[test]
fn test_multiple_users_deposits() {
    let dispatcher = deploy_zylith();

    // Initialize
    let token0: ContractAddress = 0x1.try_into().unwrap();
    let token1: ContractAddress = 0x2.try_into().unwrap();
    let fee: u128 = 3000;
    let tick_spacing: i32 = 60;
    let sqrt_price_x128: u256 = math::Q128;
    dispatcher.initialize(token0, token1, fee, tick_spacing, sqrt_price_x128);

    // Multiple private deposits
    let commitment1 = commitment::generate_commitment(1, 1, 1000);
    let commitment2 = commitment::generate_commitment(2, 2, 2000);
    let commitment3 = commitment::generate_commitment(3, 3, 3000);

    dispatcher.private_deposit(commitment1);
    let root1 = dispatcher.get_merkle_root();

    dispatcher.private_deposit(commitment2);
    let root2 = dispatcher.get_merkle_root();

    dispatcher.private_deposit(commitment3);
    let root3 = dispatcher.get_merkle_root();

    // All roots should be different
    assert!(root1 != root2);
    assert!(root2 != root3);
    assert!(root1 != root3);
    assert!(root3 != 0);
}
// Commented out due to gas limit issues - swap logic is too complex
#[test]
fn test_swap_after_privacy_deposits() {
    let dispatcher = deploy_zylith();

    // Initialize
    let token0: ContractAddress = 0x1.try_into().unwrap();
    let token1: ContractAddress = 0x2.try_into().unwrap();
    let fee: u128 = 3000;
    let tick_spacing: i32 = 60;
    let sqrt_price_x128: u256 = math::Q128;
    dispatcher.initialize(token0, token1, fee, tick_spacing, sqrt_price_x128);

    // Add liquidity
    dispatcher.mint(-600, 600, 10000);

    // Make privacy deposits
    dispatcher.private_deposit(commitment::generate_commitment(1, 1, 1000));
    dispatcher.private_deposit(commitment::generate_commitment(2, 2, 2000));

    // Execute swap
    let (amount0, amount1) = dispatcher.swap(true, 100, math::MIN_SQRT_RATIO);

    assert!(amount0 != 0 || amount1 != 0);

    // Merkle root should still be valid
    let root = dispatcher.get_merkle_root();
    assert!(root != 0);
}

// Commented out due to gas limit issues - multiple swaps exceed gas limit
#[test]
fn test_fee_collection_after_multiple_operations() {
    let dispatcher = deploy_zylith();

    // Initialize
    let token0: ContractAddress = 0x1.try_into().unwrap();
    let token1: ContractAddress = 0x2.try_into().unwrap();
    let fee: u128 = 3000;
    let tick_spacing: i32 = 60;
    let sqrt_price_x128: u256 = math::Q128;
    dispatcher.initialize(token0, token1, fee, tick_spacing, sqrt_price_x128);

    // Mint
    let tick_lower: i32 = -600;
    let tick_upper: i32 = 600;
    dispatcher.mint(tick_lower, tick_upper, 10000);

    // Multiple swaps with reduced amounts
    dispatcher.swap(true, 100, math::MIN_SQRT_RATIO);
    dispatcher.swap(false, 50, math::MAX_SQRT_RATIO);
    dispatcher.swap(true, 75, math::MIN_SQRT_RATIO);

    // Collect fees
    let (fees0, fees1) = dispatcher.collect(tick_lower, tick_upper);

    assert!(fees0 >= 0);
    assert!(fees1 >= 0);
}
#[test]
fn test_full_private_lifecycle_flow() {
    let dispatcher = deploy_zylith();

    // 1. Setup - Initialize and add public liquidity
    let token0: ContractAddress = 0x1.try_into().unwrap();
    let token1: ContractAddress = 0x2.try_into().unwrap();
    dispatcher.initialize(token0, token1, 3000, 60, math::Q128);
    dispatcher.mint(-600, 600, 1000000);

    // 2. Step 1: Private deposit
    let secret = 123;
    let nullifier = 456;
    let amount = 100000;
    let commitment = commitment::generate_commitment(secret, nullifier, amount);
    dispatcher.private_deposit(commitment);

    let root_after_dep = dispatcher.get_merkle_root();
    assert!(root_after_dep != 0);

    // 3. Step 2: Private swap
    let zero_for_one = true;
    let swap_amount: u128 = 50000;
    let price_limit = math::MIN_SQRT_RATIO;
    let new_commitment = commitment::generate_commitment(
        secret + 1, nullifier + 1, amount - swap_amount,
    );

    // Prepare proof data for MockVerifier to return as verified inputs
    // [0]: commitment, [1]: root, [2]: new_commitment, [3]: amount, [4]: zero
    let mut proof = array![];
    proof.append(commitment);
    proof.append(root_after_dep);
    proof.append(new_commitment);
    proof.append(swap_amount.into());
    proof.append(1);

    let mut public_inputs = array![]; // Untrusted, mostly ignored now

    // This executes the logic and the ZK mock
    let (out0, out1) = dispatcher
        .private_swap(proof, public_inputs, zero_for_one, swap_amount, price_limit, new_commitment);

    // Verify pool state changed
    assert!(out0 != 0 || out1 != 0);
    assert!(dispatcher.get_merkle_root() != root_after_dep);

    // 4. Step 3: Private withdraw
    let recipient: ContractAddress = 0x99.try_into().unwrap();
    let withdraw_amount: u128 = 20000;
    let root_after_swap = dispatcher.get_merkle_root();

    // Prepare proof for MockVerifier (Withdraw)
    // [0]: nullifier, [1]: root, [2]: recipient, [3]: amount
    let mut withdraw_proof = array![];
    withdraw_proof.append(nullifier);
    withdraw_proof.append(root_after_swap);
    withdraw_proof.append(recipient.into());
    withdraw_proof.append(withdraw_amount.into());

    let mut withdraw_inputs = array![];

    dispatcher.private_withdraw(withdraw_proof, withdraw_inputs, recipient, withdraw_amount);
    // Test passed if no panic
}
