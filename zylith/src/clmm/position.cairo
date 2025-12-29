// Position Management - Track and manage LP positions

use starknet::storage::*;

#[starknet::storage_node]
pub struct PositionStorage {
    // Mapping: (owner, tick_lower, tick_upper) -> PositionInfo
    // For private positions, owner is position_commitment (felt252)
    // For public positions, owner is ContractAddress from get_caller_address()
    pub positions: Map<(felt252, i32, i32), PositionInfo>,
}

#[derive(Drop, Serde, starknet::Store)]
pub struct PositionInfo {
    pub liquidity: u128,
    pub fee_growth_inside0_last_x128: u256,
    pub fee_growth_inside1_last_x128: u256,
    pub tokens_owed0: u128,
    pub tokens_owed1: u128,
}
// Position storage node definition
// Functions using this storage will be implemented in the main Zylith contract
// Storage nodes can only be accessed from within a #[starknet::contract] module


