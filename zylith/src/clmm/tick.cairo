// Tick Management - BitMap and tick spacing logic
// Based on Ekubo's tick management approach

use starknet::storage::*;

/// Tick spacing for the pool (large spacing for MVP to reduce complexity)
pub const TICK_SPACING: i32 = 60;

/// Minimum and maximum ticks
pub const MIN_TICK: i32 = -887272;
pub const MAX_TICK: i32 = 887272;

/// BitMap for tracking initialized ticks
#[starknet::storage_node]
pub struct TickBitmap {
    pub bitmap: Map<i32, u256>,
}

/// Tick info storage
#[starknet::storage_node]
pub struct TickInfo {
    pub liquidity_gross: u128,
    pub liquidity_net: i128,
    pub fee_growth_outside0_x128: u256,
    pub fee_growth_outside1_x128: u256,
    pub tick_cumulative_outside: i128,
    pub seconds_per_liquidity_outside_x128: u256,
    pub seconds_outside: u32,
    pub initialized: bool,
}

/// Get the word position and bit position for a tick
pub fn position(tick: i32) -> (i32, i32) {
    let (word_pos, bit_pos) = if tick >= 0 {
        (tick / 256, tick % 256)
    } else {
        // For negative ticks: -1 is word -1 bit 255, -256 is word -1 bit 0
        let wp = (tick + 1) / 256 - 1;
        let mut bp = tick % 256;
        if bp < 0 {
            bp = bp + 256;
        }
        (wp, bp)
    };
    (word_pos, bit_pos)
}

/// Calculate 2^bit_pos for u256 (optimized O(log N))
pub fn power_of_2_u256(bit_pos: i32) -> u256 {
    let mut bit_pos_u32: u32 = bit_pos.try_into().unwrap();
    let mut res: u256 = 1;
    let mut base: u256 = 2;

    while bit_pos_u32 > 0 {
        if bit_pos_u32 % 2 == 1 {
            res = res * base;
        }
        if bit_pos_u32 > 1 {
            base = base * base;
        }
        bit_pos_u32 = bit_pos_u32 / 2;
    }
    res
}

/// Helper: Check if a bit is set in a u256 word
pub fn is_bit_set(word: u256, bit_pos: i32) -> bool {
    let mask = power_of_2_u256(bit_pos);
    let masked = word & mask;
    masked != 0
}

/// Helper: Set a bit in a u256 word
pub fn set_bit(word: u256, bit_pos: i32) -> u256 {
    let mask = power_of_2_u256(bit_pos);
    word | mask
}

/// Helper: Clear a bit in a u256 word
pub fn clear_bit(word: u256, bit_pos: i32) -> u256 {
    let mask = power_of_2_u256(bit_pos);
    // Clear bit: word & (~mask)
    // In Cairo, we check if bit is set and subtract mask if so
    if (word & mask) != 0 {
        word - mask
    } else {
        word
    }
}

/// Helper: Toggle a bit in a u256 word
pub fn toggle_bit(word: u256, bit_pos: i32) -> u256 {
    let mask = power_of_2_u256(bit_pos);
    word ^ mask
}
/// Storage node definitions only
/// Functions that use these storage nodes must be implemented within contracts


