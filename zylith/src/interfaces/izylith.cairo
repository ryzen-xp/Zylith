use starknet::ContractAddress;

#[starknet::interface]
pub trait IZylith<TContractState> {
    fn initialize(
        ref self: TContractState,
        token0: ContractAddress,
        token1: ContractAddress,
        fee: u128,
        tick_spacing: i32,
        sqrt_price_x128: u256,
    );

    fn private_deposit(
        ref self: TContractState, token: ContractAddress, amount: u256, commitment: felt252,
    );

    fn private_swap(
        ref self: TContractState,
        proof: Array<felt252>,
        public_inputs: Array<felt252>,
        zero_for_one: bool,
        amount_specified: u128,
        sqrt_price_limit_x128: u256,
        new_commitment: felt252,
    ) -> (i128, i128);

    fn private_withdraw(
        ref self: TContractState,
        proof: Array<felt252>,
        public_inputs: Array<felt252>,
        token: ContractAddress,
        recipient: ContractAddress,
        amount: u128,
    );

    fn private_mint_liquidity(
        ref self: TContractState,
        proof: Array<felt252>,
        public_inputs: Array<felt252>,
        tick_lower: i32, // ← Changed from i32 to felt252 for Starknet.js compatibility
        tick_upper: i32, // ← Changed from i32 to felt252 for Starknet.js compatibility
        liquidity: u128,
        new_commitment: felt252,
    ) -> (u128, u128);

    fn private_burn_liquidity(
        ref self: TContractState,
        proof: Array<felt252>,
        public_inputs: Array<felt252>,
        tick_lower: i32, // ← Changed from i32 to felt252 for Starknet.js compatibility
        tick_upper: i32, // ← Changed from i32 to felt252 for Starknet.js compatibility
        liquidity: u128,
        new_commitment: felt252,
    ) -> (u128, u128);

    fn private_collect(
        ref self: TContractState,
        proof: Array<felt252>,
        public_inputs: Array<felt252>,
        tick_lower: i32, // ← Changed from i32 to felt252 for Starknet.js compatibility
        tick_upper: i32, // ← Changed from i32 to felt252 for Starknet.js compatibility
        new_commitment: felt252,
    ) -> (u128, u128);

    fn mint(
        ref self: TContractState, tick_lower: i32, tick_upper: i32, amount: u128,
    ) -> (u128, u128);

    fn swap(
        ref self: TContractState,
        zero_for_one: bool,
        amount_specified: u128,
        sqrt_price_limit_x128: u256,
    ) -> (i128, i128);

    fn burn(
        ref self: TContractState, tick_lower: i32, tick_upper: i32, amount: u128,
    ) -> (u128, u128);

    fn collect(ref self: TContractState, tick_lower: i32, tick_upper: i32) -> (u128, u128);

    fn get_merkle_root(self: @TContractState) -> felt252;

    fn is_nullifier_spent(self: @TContractState, nullifier: felt252) -> bool;

    fn is_root_known(self: @TContractState, root: felt252) -> bool;

    fn get_known_roots_count(self: @TContractState) -> u32;
}
