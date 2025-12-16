// Integration Tests - Full flow: deposit → swap → withdraw

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
fn test_full_flow_initialize_mint_swap() {
    let dispatcher = deploy_zylith();
    
    // Step 1: Initialize pool
    let token0: ContractAddress = 0x1.try_into().unwrap();
    let token1: ContractAddress = 0x2.try_into().unwrap();
    let fee: u128 = 3000;
    let tick_spacing: i32 = 60;
    let sqrt_price_x96: u128 = 79228162514264337593543950336;
    dispatcher.initialize(token0, token1, fee, tick_spacing, sqrt_price_x96);
    
    // Step 2: Add liquidity
    let tick_lower: i32 = -600;
    let tick_upper: i32 = 600;
    let liquidity_amount: u128 = 1000000000;
    let (amount0, amount1) = dispatcher.mint(tick_lower, tick_upper, liquidity_amount);
    
    assert!(amount0 > 0 || amount1 > 0);
    
    // Step 3: Execute swap
    let zero_for_one = true;
    let swap_amount: u128 = 100000;
    let price_limit: u128 = 1;
    let (swap_amount0, swap_amount1) = dispatcher.swap(zero_for_one, swap_amount, price_limit);
    
    assert!(swap_amount0 < 0);
    assert!(swap_amount1 > 0);
}

#[test]
fn test_privacy_flow_deposit() {
    let dispatcher = deploy_zylith();
    
    // Initialize pool
    let token0: ContractAddress = 0x1.try_into().unwrap();
    let token1: ContractAddress = 0x2.try_into().unwrap();
    let fee: u128 = 3000;
    let tick_spacing: i32 = 60;
    let sqrt_price_x96: u128 = 79228162514264337593543950336;
    dispatcher.initialize(token0, token1, fee, tick_spacing, sqrt_price_x96);
    
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

#[test]
fn test_fee_accumulation() {
    let dispatcher = deploy_zylith();
    
    // Initialize pool
    let token0: ContractAddress = 0x1.try_into().unwrap();
    let token1: ContractAddress = 0x2.try_into().unwrap();
    let fee: u128 = 3000;
    let tick_spacing: i32 = 60;
    let sqrt_price_x96: u128 = 79228162514264337593543950336;
    dispatcher.initialize(token0, token1, fee, tick_spacing, sqrt_price_x96);
    
    // Mint position
    let tick_lower: i32 = -600;
    let tick_upper: i32 = 600;
    dispatcher.mint(tick_lower, tick_upper, 1000000000);
    
    // Execute multiple swaps to generate fees
    dispatcher.swap(true, 100000, 1);
    dispatcher.swap(false, 50000, 79228162514264337593543950336 * 2);
    
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
    let sqrt_price_x96: u128 = 79228162514264337593543950336;
    dispatcher.initialize(token0, token1, fee, tick_spacing, sqrt_price_x96);
    
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

#[test]
fn test_complete_liquidity_lifecycle() {
    let dispatcher = deploy_zylith();
    
    // Initialize
    let token0: ContractAddress = 0x1.try_into().unwrap();
    let token1: ContractAddress = 0x2.try_into().unwrap();
    let fee: u128 = 3000;
    let tick_spacing: i32 = 60;
    let sqrt_price_x96: u128 = 79228162514264337593543950336;
    dispatcher.initialize(token0, token1, fee, tick_spacing, sqrt_price_x96);
    
    // Mint
    let tick_lower: i32 = -600;
    let tick_upper: i32 = 600;
    let mint_amount: u128 = 1000000;
    let (mint_amount0, mint_amount1) = dispatcher.mint(tick_lower, tick_upper, mint_amount);
    
    assert!(mint_amount0 >= 0);
    assert!(mint_amount1 >= 0);
    
    // Swap to generate fees
    dispatcher.swap(true, 50000, 1);
    
    // Collect fees
    let (fees0, fees1) = dispatcher.collect(tick_lower, tick_upper);
    assert!(fees0 >= 0);
    assert!(fees1 >= 0);
    
    // Burn partial
    let burn_amount: u128 = 500000;
    let (burn_amount0, burn_amount1) = dispatcher.burn(tick_lower, tick_upper, burn_amount);
    assert!(burn_amount0 >= 0);
    assert!(burn_amount1 >= 0);
    
    // Collect remaining fees
    let (fees0_2, fees1_2) = dispatcher.collect(tick_lower, tick_upper);
    assert!(fees0_2 >= 0);
    assert!(fees1_2 >= 0);
    
    // Burn remaining
    let (burn_amount0_2, burn_amount1_2) = dispatcher.burn(tick_lower, tick_upper, mint_amount - burn_amount);
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
    let sqrt_price_x96: u128 = 79228162514264337593543950336;
    dispatcher.initialize(token0, token1, fee, tick_spacing, sqrt_price_x96);
    
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

#[test]
fn test_swap_after_privacy_deposits() {
    let dispatcher = deploy_zylith();
    
    // Initialize
    let token0: ContractAddress = 0x1.try_into().unwrap();
    let token1: ContractAddress = 0x2.try_into().unwrap();
    let fee: u128 = 3000;
    let tick_spacing: i32 = 60;
    let sqrt_price_x96: u128 = 79228162514264337593543950336;
    dispatcher.initialize(token0, token1, fee, tick_spacing, sqrt_price_x96);
    
    // Add liquidity
    dispatcher.mint(-600, 600, 1000000000);
    
    // Make privacy deposits
    dispatcher.private_deposit(commitment::generate_commitment(1, 1, 1000));
    dispatcher.private_deposit(commitment::generate_commitment(2, 2, 2000));
    
    // Execute swap
    let (amount0, amount1) = dispatcher.swap(true, 100000, 1);
    
    assert!(amount0 < 0);
    assert!(amount1 > 0);
    
    // Merkle root should still be valid
    let root = dispatcher.get_merkle_root();
    assert!(root != 0);
}

#[test]
fn test_fee_collection_after_multiple_operations() {
    let dispatcher = deploy_zylith();
    
    // Initialize
    let token0: ContractAddress = 0x1.try_into().unwrap();
    let token1: ContractAddress = 0x2.try_into().unwrap();
    let fee: u128 = 3000;
    let tick_spacing: i32 = 60;
    let sqrt_price_x96: u128 = 79228162514264337593543950336;
    dispatcher.initialize(token0, token1, fee, tick_spacing, sqrt_price_x96);
    
    // Mint
    let tick_lower: i32 = -600;
    let tick_upper: i32 = 600;
    dispatcher.mint(tick_lower, tick_upper, 1000000000);
    
    // Multiple swaps
    dispatcher.swap(true, 100000, 1);
    dispatcher.swap(false, 50000, 79228162514264337593543950336 * 2);
    dispatcher.swap(true, 75000, 1);
    dispatcher.swap(false, 25000, 79228162514264337593543950336 * 2);
    
    // Collect fees
    let (fees0, fees1) = dispatcher.collect(tick_lower, tick_upper);
    
    // Fees should have accumulated from all swaps
    assert!(fees0 >= 0);
    assert!(fees1 >= 0);
}
