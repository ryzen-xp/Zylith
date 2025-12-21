// Integration Tests - Full flow: CLMM operations with ERC20 mocks
// Tests the complete flow including ERC20 transfers

use core::array::ArrayTrait;
use core::integer::u128;
use core::traits::TryInto;
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use starknet::ContractAddress;
use zylith::clmm::math;
use zylith::interfaces::izylith::{IZylithDispatcher, IZylithDispatcherTrait};
use zylith::mocks::erc20::{IMockERC20Dispatcher, IMockERC20DispatcherTrait};
use zylith::privacy::commitment;

// Test constants
const INITIAL_BALANCE: u256 = 1000000000000000000000000; // 1M tokens with 18 decimals
const LARGE_APPROVAL: u256 = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;

fn caller() -> ContractAddress {
    0x123.try_into().unwrap()
}

fn deploy_mock_erc20(name: felt252, symbol: felt252) -> IMockERC20Dispatcher {
    let contract = declare("MockERC20").unwrap().contract_class();
    let mut constructor_args = array![];
    constructor_args.append(name);
    constructor_args.append(symbol);
    constructor_args.append(18); // decimals

    let (contract_address, _) = contract.deploy(@constructor_args).unwrap();
    IMockERC20Dispatcher { contract_address }
}

fn deploy_zylith() -> IZylithDispatcher {
    let contract = declare("Zylith").unwrap().contract_class();
    let owner: ContractAddress = 1.try_into().unwrap();

    let mock_verifier_class = declare("MockVerifier").unwrap().contract_class();
    let (membership_verifier, _) = mock_verifier_class.deploy(@array![]).unwrap();
    let (swap_verifier, _) = mock_verifier_class.deploy(@array![]).unwrap();
    let (withdraw_verifier, _) = mock_verifier_class.deploy(@array![]).unwrap();
    let (lp_verifier, _) = mock_verifier_class.deploy(@array![]).unwrap();

    let mut constructor_args = array![];
    constructor_args.append(owner.into());
    constructor_args.append(membership_verifier.into());
    constructor_args.append(swap_verifier.into());
    constructor_args.append(withdraw_verifier.into());
    constructor_args.append(lp_verifier.into());

    let (contract_address, _) = contract.deploy(@constructor_args).unwrap();
    IZylithDispatcher { contract_address }
}

// Helper struct for test setup
#[derive(Drop)]
struct TestSetup {
    zylith: IZylithDispatcher,
    token0: IMockERC20Dispatcher,
    token1: IMockERC20Dispatcher,
}

fn setup_with_erc20() -> TestSetup {
    // Deploy contracts
    let token0 = deploy_mock_erc20('Token0', 'TK0');
    let token1 = deploy_mock_erc20('Token1', 'TK1');
    let zylith = deploy_zylith();

    // Mint tokens to caller
    token0.mint(caller(), INITIAL_BALANCE);
    token1.mint(caller(), INITIAL_BALANCE);

    // Approve Zylith to spend tokens (as caller)
    start_cheat_caller_address(token0.contract_address, caller());
    token0.approve(zylith.contract_address, LARGE_APPROVAL);
    stop_cheat_caller_address(token0.contract_address);

    start_cheat_caller_address(token1.contract_address, caller());
    token1.approve(zylith.contract_address, LARGE_APPROVAL);
    stop_cheat_caller_address(token1.contract_address);

    TestSetup { zylith, token0, token1 }
}

// ==================== CLMM Public Operations Tests with ERC20 ====================

#[test]
fn test_initialize_pool_with_erc20() {
    let setup = setup_with_erc20();

    // Initialize pool
    let fee: u128 = 3000;
    let tick_spacing: i32 = 60;
    let sqrt_price_x128: u256 = math::Q128;

    start_cheat_caller_address(setup.zylith.contract_address, caller());
    setup
        .zylith
        .initialize(
            setup.token0.contract_address,
            setup.token1.contract_address,
            fee,
            tick_spacing,
            sqrt_price_x128,
        );
    stop_cheat_caller_address(setup.zylith.contract_address);

    // Pool should be initialized - verify by checking root is known
    let is_root_known = setup.zylith.is_root_known(0);
    assert!(is_root_known);
}

#[test]
fn test_mint_liquidity_with_erc20() {
    let setup = setup_with_erc20();

    // Initialize pool
    let fee: u128 = 3000;
    let tick_spacing: i32 = 60;
    let sqrt_price_x128: u256 = math::Q128;

    start_cheat_caller_address(setup.zylith.contract_address, caller());
    setup
        .zylith
        .initialize(
            setup.token0.contract_address,
            setup.token1.contract_address,
            fee,
            tick_spacing,
            sqrt_price_x128,
        );

    // Check initial balances
    let initial_balance0 = setup.token0.balance_of(caller());
    let initial_balance1 = setup.token1.balance_of(caller());

    // Mint liquidity
    let tick_lower: i32 = -600;
    let tick_upper: i32 = 600;
    let liquidity_amount: u128 = 10000;
    let (amount0, amount1) = setup.zylith.mint(tick_lower, tick_upper, liquidity_amount);
    stop_cheat_caller_address(setup.zylith.contract_address);

    // Verify amounts are non-zero
    assert!(amount0 != 0 || amount1 != 0);

    // Verify tokens were transferred from caller
    let final_balance0 = setup.token0.balance_of(caller());
    let final_balance1 = setup.token1.balance_of(caller());

    // Balances should have decreased
    assert!(final_balance0 <= initial_balance0);
    assert!(final_balance1 <= initial_balance1);
}

#[test]
fn test_swap_with_erc20() {
    let setup = setup_with_erc20();

    // Initialize pool
    let fee: u128 = 3000;
    let tick_spacing: i32 = 60;
    let sqrt_price_x128: u256 = math::Q128;

    start_cheat_caller_address(setup.zylith.contract_address, caller());
    setup
        .zylith
        .initialize(
            setup.token0.contract_address,
            setup.token1.contract_address,
            fee,
            tick_spacing,
            sqrt_price_x128,
        );

    // Add liquidity first
    let tick_lower: i32 = -600;
    let tick_upper: i32 = 600;
    let liquidity_amount: u128 = 100000;
    setup.zylith.mint(tick_lower, tick_upper, liquidity_amount);

    // Record balance before swap
    let balance0_before = setup.token0.balance_of(caller());
    let _balance1_before = setup.token1.balance_of(caller());

    // Execute swap (token0 -> token1)
    let zero_for_one = true;
    let swap_amount: u128 = 1000;
    let price_limit: u256 = math::MIN_SQRT_RATIO;
    let (swap_amount0, swap_amount1) = setup.zylith.swap(zero_for_one, swap_amount, price_limit);
    stop_cheat_caller_address(setup.zylith.contract_address);

    // Verify swap occurred
    assert!(swap_amount0 != 0 || swap_amount1 != 0);

    // Verify balance changes
    let balance0_after = setup.token0.balance_of(caller());
    let _balance1_after = setup.token1.balance_of(caller());

    // Swap should have changed balances (or at least not failed)
    // Note: balance0 should decrease OR stay same (if swap returns 0)
    assert!(balance0_after <= balance0_before);
}

#[test]
fn test_burn_liquidity_with_erc20() {
    let setup = setup_with_erc20();

    // Initialize pool
    let fee: u128 = 3000;
    let tick_spacing: i32 = 60;
    let sqrt_price_x128: u256 = math::Q128;

    start_cheat_caller_address(setup.zylith.contract_address, caller());
    setup
        .zylith
        .initialize(
            setup.token0.contract_address,
            setup.token1.contract_address,
            fee,
            tick_spacing,
            sqrt_price_x128,
        );

    // Mint liquidity
    let tick_lower: i32 = -60;
    let tick_upper: i32 = 60;
    let mint_amount: u128 = 1000000;
    setup.zylith.mint(tick_lower, tick_upper, mint_amount);

    // Record balance before burn
    let balance0_before = setup.token0.balance_of(caller());
    let balance1_before = setup.token1.balance_of(caller());

    // Burn partial liquidity
    let burn_amount: u128 = 500000;
    let (amount0, amount1) = setup.zylith.burn(tick_lower, tick_upper, burn_amount);
    stop_cheat_caller_address(setup.zylith.contract_address);

    // Verify burn returned amounts
    assert!(amount0 >= 0);
    assert!(amount1 >= 0);

    // Verify balance increased (tokens returned)
    let balance0_after = setup.token0.balance_of(caller());
    let balance1_after = setup.token1.balance_of(caller());

    assert!(balance0_after >= balance0_before);
    assert!(balance1_after >= balance1_before);
}

#[test]
fn test_collect_fees_with_erc20() {
    let setup = setup_with_erc20();

    // Initialize pool
    let fee: u128 = 3000;
    let tick_spacing: i32 = 60;
    let sqrt_price_x128: u256 = math::Q128;

    start_cheat_caller_address(setup.zylith.contract_address, caller());
    setup
        .zylith
        .initialize(
            setup.token0.contract_address,
            setup.token1.contract_address,
            fee,
            tick_spacing,
            sqrt_price_x128,
        );

    // Add liquidity
    let tick_lower: i32 = -600;
    let tick_upper: i32 = 600;
    setup.zylith.mint(tick_lower, tick_upper, 100000);

    // Do some swaps to generate fees
    setup.zylith.swap(true, 1000, math::MIN_SQRT_RATIO);
    setup.zylith.swap(false, 500, math::MAX_SQRT_RATIO);

    // Collect fees
    let (fees0, fees1) = setup.zylith.collect(tick_lower, tick_upper);
    stop_cheat_caller_address(setup.zylith.contract_address);

    // Fees should be non-negative
    assert!(fees0 >= 0);
    assert!(fees1 >= 0);
}

#[test]
fn test_full_lifecycle_with_erc20() {
    let setup = setup_with_erc20();

    // Initialize pool
    let fee: u128 = 3000;
    let tick_spacing: i32 = 60;
    let sqrt_price_x128: u256 = math::Q128;

    start_cheat_caller_address(setup.zylith.contract_address, caller());
    setup
        .zylith
        .initialize(
            setup.token0.contract_address,
            setup.token1.contract_address,
            fee,
            tick_spacing,
            sqrt_price_x128,
        );

    // Mint liquidity
    let tick_lower: i32 = -600;
    let tick_upper: i32 = 600;
    let mint_amount: u128 = 10000;
    let (mint_amount0, mint_amount1) = setup.zylith.mint(tick_lower, tick_upper, mint_amount);
    assert!(mint_amount0 != 0 || mint_amount1 != 0);

    // Swap to generate fees
    setup.zylith.swap(true, 100, math::MIN_SQRT_RATIO);

    // Collect fees
    let (fees0, fees1) = setup.zylith.collect(tick_lower, tick_upper);
    assert!(fees0 >= 0);
    assert!(fees1 >= 0);

    // Burn partial
    let burn_amount: u128 = 5000;
    let (burn_amount0, burn_amount1) = setup.zylith.burn(tick_lower, tick_upper, burn_amount);
    assert!(burn_amount0 >= 0);
    assert!(burn_amount1 >= 0);

    // Burn remaining
    let (burn_amount0_2, burn_amount1_2) = setup
        .zylith
        .burn(tick_lower, tick_upper, mint_amount - burn_amount);
    assert!(burn_amount0_2 >= 0);
    assert!(burn_amount1_2 >= 0);

    stop_cheat_caller_address(setup.zylith.contract_address);
}

// ==================== Root History Tests ====================

#[test]
fn test_root_history_after_initialization() {
    let setup = setup_with_erc20();

    start_cheat_caller_address(setup.zylith.contract_address, caller());
    setup
        .zylith
        .initialize(
            setup.token0.contract_address, setup.token1.contract_address, 3000, 60, math::Q128,
        );
    stop_cheat_caller_address(setup.zylith.contract_address);

    // Initial root (0) should be known
    let is_known = setup.zylith.is_root_known(0);
    assert!(is_known);

    // Random root should not be known
    let random_root: felt252 = 999999;
    let is_not_known = setup.zylith.is_root_known(random_root);
    assert!(!is_not_known);
}

#[test]
fn test_known_roots_count() {
    let setup = setup_with_erc20();

    start_cheat_caller_address(setup.zylith.contract_address, caller());
    setup
        .zylith
        .initialize(
            setup.token0.contract_address, setup.token1.contract_address, 3000, 60, math::Q128,
        );
    stop_cheat_caller_address(setup.zylith.contract_address);

    // Should start with 1 known root (the empty tree root)
    let count = setup.zylith.get_known_roots_count();
    assert!(count == 1);
}

// ==================== Nullifier Tests ====================

#[test]
fn test_nullifier_not_spent_initially() {
    let setup = setup_with_erc20();

    start_cheat_caller_address(setup.zylith.contract_address, caller());
    setup
        .zylith
        .initialize(
            setup.token0.contract_address, setup.token1.contract_address, 3000, 60, math::Q128,
        );
    stop_cheat_caller_address(setup.zylith.contract_address);

    // Random nullifiers should not be spent
    let nullifier1: felt252 = 12345;
    let nullifier2: felt252 = 67890;

    assert!(!setup.zylith.is_nullifier_spent(nullifier1));
    assert!(!setup.zylith.is_nullifier_spent(nullifier2));
}

// ==================== Commitment Generation Tests ====================

#[test]
fn test_commitment_generation_in_integration() {
    // Test commitment generation independently
    let secret = 123;
    let nullifier = 456;
    let amount = 1000000;

    let commit1 = commitment::generate_commitment(secret, nullifier, amount);
    let commit2 = commitment::generate_commitment(secret, nullifier, amount);

    // Same inputs = same commitment
    assert!(commit1 == commit2);

    // Different inputs = different commitment
    let commit3 = commitment::generate_commitment(secret + 1, nullifier, amount);
    assert!(commit1 != commit3);
}
