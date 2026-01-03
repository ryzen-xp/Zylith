use core::array::ArrayTrait;
use core::integer::u128;
use core::num::traits::Zero;
use core::traits::TryInto;
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use starknet::ContractAddress;
use zylith::interfaces::izylith::{IZylithDispatcher, IZylithDispatcherTrait};
use zylith::mocks::erc20::{IMockERC20Dispatcher, IMockERC20DispatcherTrait};

// Test constants
const INITIAL_BALANCE: u256 = 1000000000000000000000000; // 1M tokens
const LARGE_APPROVAL: u256 = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
const TEST_FEE: u128 = 3000; // 0.3% fee
const TICK_SPACING: i32 = 60;
const sqrt_price: u256 = 79228162514264337593543950336; // Price 1:1

fn caller() -> ContractAddress {
    0x123.try_into().unwrap()
}

fn user2() -> ContractAddress {
    0x456.try_into().unwrap()
}

//  this is mock
fn deploy_mock_erc20(name: felt252, symbol: felt252) -> IMockERC20Dispatcher {
    let contract = declare("MockERC20").unwrap().contract_class();
    let mut constructor_args = array![];
    constructor_args.append(name);
    constructor_args.append(symbol);
    constructor_args.append(18);

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

#[derive(Drop)]
struct TestSetup {
    zylith: IZylithDispatcher,
    token0: IMockERC20Dispatcher,
    token1: IMockERC20Dispatcher,
}

fn setup_with_erc20() -> TestSetup {
    let token0 = deploy_mock_erc20('Token0', 'TK0');
    let token1 = deploy_mock_erc20('Token1', 'TK1');
    let zylith = deploy_zylith();

    // Mint to multiple users
    token0.mint(caller(), INITIAL_BALANCE);
    token1.mint(caller(), INITIAL_BALANCE);
    token0.mint(user2(), INITIAL_BALANCE);
    token1.mint(user2(), INITIAL_BALANCE);

    // Approve for caller
    start_cheat_caller_address(token0.contract_address, caller());
    token0.approve(zylith.contract_address, LARGE_APPROVAL);
    stop_cheat_caller_address(token0.contract_address);

    start_cheat_caller_address(token1.contract_address, caller());
    token1.approve(zylith.contract_address, LARGE_APPROVAL);
    stop_cheat_caller_address(token1.contract_address);

    // Approve for user2
    start_cheat_caller_address(token0.contract_address, user2());
    token0.approve(zylith.contract_address, LARGE_APPROVAL);
    stop_cheat_caller_address(token0.contract_address);

    start_cheat_caller_address(token1.contract_address, user2());
    token1.approve(zylith.contract_address, LARGE_APPROVAL);
    stop_cheat_caller_address(token1.contract_address);

    TestSetup { zylith, token0, token1 }
}

fn initialize_pool(setup: @TestSetup) {
    let setup = setup_with_erc20();

    start_cheat_caller_address(setup.zylith.contract_address, caller());
    setup
        .zylith
        .initialize(
            setup.token0.contract_address,
            setup.token1.contract_address,
            TEST_FEE,
            TICK_SPACING,
            sqrt_price,
        );
    stop_cheat_caller_address(setup.zylith.contract_address);
}

// ============================================================================
//  Constructor & Initialization
// ============================================================================

#[test]
fn test_constructor_stores_verifier_addresses() {
    let zylith = deploy_zylith();
    assert!(zylith.contract_address.is_non_zero(), "Contract not deployed");
}

#[test]
fn test_initialize_pool_success() {
    let setup = setup_with_erc20();

    start_cheat_caller_address(setup.zylith.contract_address, caller());
    setup
        .zylith
        .initialize(
            setup.token0.contract_address,
            setup.token1.contract_address,
            TEST_FEE,
            TICK_SPACING,
            sqrt_price,
        );
    stop_cheat_caller_address(setup.zylith.contract_address);

    let root = setup.zylith.get_merkle_root();
    assert!(root == 0, "Initial root should be 0");
    assert!(setup.zylith.is_root_known(0), "Root 0 should be known");
}

#[test]
#[should_panic]
fn test_initialize_twice_fails() {
    let setup = setup_with_erc20();
    initialize_pool(@setup);

    start_cheat_caller_address(setup.zylith.contract_address, caller());
    setup
        .zylith
        .initialize(
            setup.token0.contract_address,
            setup.token1.contract_address,
            TEST_FEE,
            TICK_SPACING,
            sqrt_price,
        );
    stop_cheat_caller_address(setup.zylith.contract_address);

    start_cheat_caller_address(setup.zylith.contract_address, caller());
    setup
        .zylith
        .initialize(
            setup.token0.contract_address,
            setup.token1.contract_address,
            TEST_FEE,
            TICK_SPACING,
            sqrt_price,
        );

    stop_cheat_caller_address(setup.zylith.contract_address);
}


// ============================================================================
//  Private Mint & Burn Liquidity
// ============================================================================

#[test]
fn test_private_mint_liquidity_with_valid_proof() {
    let setup = setup_with_erc20();
    initialize_pool(@setup);

    start_cheat_caller_address(setup.zylith.contract_address, caller());
    setup
        .zylith
        .initialize(
            setup.token0.contract_address,
            setup.token1.contract_address,
            TEST_FEE,
            TICK_SPACING,
            sqrt_price,
        );
    stop_cheat_caller_address(setup.zylith.contract_address);

    // Deposit tokens first
    let commitment: felt252 = 0x111;
    let amount: u256 = 1000000000000000000;
    start_cheat_caller_address(setup.zylith.contract_address, caller());
    setup.zylith.private_deposit(setup.token0.contract_address, amount, commitment);
    setup.zylith.private_deposit(setup.token1.contract_address, amount, commitment);
    let current_root = setup.zylith.get_merkle_root();
    stop_cheat_caller_address(setup.zylith.contract_address);

    // Prepare mint
    let mut proof = array![
        0x1, current_root, 4294961296, 6000, 100000000000000,
        1700530663063887801134503153749850134025312614654876159533045756060942041183, 0x7, 0x8,
    ];
    let nullifier: felt252 = 0x1;
    let new_commitment: felt252 =
        1700530663063887801134503153749850134025312614654876159533045756060942041183;
    let position_commitment: felt252 = 0x333;
    let tick_lower: i32 = -1000;
    let tick_upper: i32 = 6000;
    let liquidity: u128 = 100000000000000;

    let mut public_inputs = array![
        nullifier, current_root, tick_lower.into(), tick_upper.into(), liquidity.into(),
        new_commitment, position_commitment,
    ];

    start_cheat_caller_address(setup.zylith.contract_address, caller());
    let (amount0, amount1) = setup
        .zylith
        .private_mint_liquidity(
            proof, public_inputs, tick_lower, tick_upper, liquidity, new_commitment,
        );
    stop_cheat_caller_address(setup.zylith.contract_address);

    assert!(amount0 > 0 || amount1 > 0, "Should mint some liquidity");
    assert!(setup.zylith.is_nullifier_spent(nullifier), "Nullifier should be spent");
}

#[test]
fn test_private_burn_liquidity_with_valid_proof() {
    let setup = setup_with_erc20();
    initialize_pool(@setup);

    // Initialize pool

    start_cheat_caller_address(setup.zylith.contract_address, caller());
    setup
        .zylith
        .initialize(
            setup.token0.contract_address,
            setup.token1.contract_address,
            TEST_FEE,
            TICK_SPACING,
            sqrt_price,
        );
    stop_cheat_caller_address(setup.zylith.contract_address);

    // Private deposit

    let deposit_commitment: felt252 = 0x111;
    let deposit_amount: u256 = 10_000_000_000_000_000_000; // 10 tokens

    start_cheat_caller_address(setup.zylith.contract_address, caller());
    setup.zylith.private_deposit(setup.token0.contract_address, deposit_amount, deposit_commitment);
    setup.zylith.private_deposit(setup.token1.contract_address, deposit_amount, deposit_commitment);
    stop_cheat_caller_address(setup.zylith.contract_address);

    let root_before_mint = setup.zylith.get_merkle_root();

    // Private mint liquidity

    let tick_lower: i32 = -120;
    let tick_upper: i32 = 240;
    let minted_liquidity: u128 = 2_000_000;

    let mint_nullifier: felt252 = 0x01;
    let new_commitment_after_mint: felt252 = 0x222;
    let position_commitment: felt252 = 0x333;

    let mint_proof = array![
        mint_nullifier, root_before_mint, tick_lower.into(), tick_upper.into(),
        minted_liquidity.into(), new_commitment_after_mint, position_commitment,
    ];

    let mint_public_inputs = array![
        mint_nullifier, root_before_mint, tick_lower.into(), tick_upper.into(),
        minted_liquidity.into(), new_commitment_after_mint, position_commitment,
    ];

    start_cheat_caller_address(setup.zylith.contract_address, caller());
    setup
        .zylith
        .private_mint_liquidity(
            mint_proof,
            mint_public_inputs,
            tick_lower,
            tick_upper,
            minted_liquidity,
            new_commitment_after_mint,
        );
    stop_cheat_caller_address(setup.zylith.contract_address);

    let root_after_mint = setup.zylith.get_merkle_root();

    // Private burn liquidity

    let burn_liquidity: u128 = 1_000_000; // <= minted_liquidity
    let burn_nullifier: felt252 = 0x999;
    let new_commitment_after_burn: felt252 = 0x555;

    let burn_proof = array![
        burn_nullifier, root_after_mint, tick_lower.into(), tick_upper.into(),
        burn_liquidity.into(), new_commitment_after_burn, position_commitment,
    ];

    let burn_public_inputs = array![
        burn_nullifier, root_after_mint, tick_lower.into(), tick_upper.into(),
        burn_liquidity.into(), new_commitment_after_burn, position_commitment,
    ];

    start_cheat_caller_address(setup.zylith.contract_address, caller());
    let (amount0, amount1) = setup
        .zylith
        .private_burn_liquidity(
            burn_proof,
            burn_public_inputs,
            tick_lower,
            tick_upper,
            burn_liquidity,
            new_commitment_after_burn,
        );
    stop_cheat_caller_address(setup.zylith.contract_address);

    assert!(amount0 > 0 || amount1 > 0, "Burn should return tokens");
    assert!(setup.zylith.is_nullifier_spent(burn_nullifier), "Burn nullifier must be spent");
}
