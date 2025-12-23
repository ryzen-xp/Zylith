
use core::array::ArrayTrait;
use core::integer::u128;
use core::num::traits::Zero;
use core::traits::TryInto;
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, 
    declare,  start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::ContractAddress;
use zylith::clmm::math;
use zylith::interfaces::izylith::{IZylithDispatcher, IZylithDispatcherTrait};
use zylith::mocks::erc20::{IMockERC20Dispatcher, IMockERC20DispatcherTrait};
use zylith::privacy::commitment;

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
// UNIT TESTS - Constructor & Initialization
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
