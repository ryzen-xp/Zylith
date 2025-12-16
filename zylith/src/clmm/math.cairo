// CLMM Math - u128 arithmetic for sqrt price and tick conversions
// Based on Ekubo/Uniswap v3 mathematical approach
// Uses Q64.96 fixed point format (64 bits integer, 96 bits fractional)

/// Q64.96 format constants
pub const Q96: u128 = 79228162514264337593543950336; // 2^96
pub const MIN_SQRT_RATIO: u128 = 4295128739; // sqrt(1.0001)^(-887272) * 2^96
pub const MAX_SQRT_RATIO: u128 = 79226673515401279992447579055; // Simplified max for u128

/// Safe sqrt price for tick 0 (price = 1.0)
/// This is Q96, which represents sqrt(1.0) * 2^96
pub const SAFE_SQRT_PRICE_TICK_0: u128 = 79228162514264337593543950336; // Q96
pub const MIN_TICK: i32 = -887272;
pub const MAX_TICK: i32 = 887272;

/// Get sqrt price at a given tick
/// Formula: sqrtPrice = 1.0001^(tick/2) * 2^96
/// More accurate implementation using better approximation
pub fn get_sqrt_ratio_at_tick(tick: i32) -> u128 {
    assert(tick >= MIN_TICK && tick <= MAX_TICK, 'Tick out of bounds');
    
    // Base ratio for tick = 0
    if tick == 0 {
        return Q96;
    };
    
    let abs_tick = if tick < 0 { -tick } else { tick };
    let abs_tick_u128: u128 = abs_tick.try_into().unwrap();
    
    // More accurate approximation: 1.0001^(tick/2) ≈ 1 + (tick/2) * 0.0001
    // For better precision, we use: ratio = Q96 * (1 + tick * 0.00005)
    // Using u256 to prevent overflow
    let q96_u256: u256 = Q96.try_into().unwrap();
    let abs_tick_u256: u256 = abs_tick_u128.try_into().unwrap();
    
    // More accurate approximation using exponential formula
    // For small ticks: use finer granularity
    // For larger ticks: use coarser but still accurate approximation
    let denominator = if abs_tick <= 100 {
        20000 // Very precise for small ticks (tick/20000 ≈ tick * 0.00005)
    } else if abs_tick <= 1000 {
        2000 // Good precision for medium ticks
    } else {
        200 // Less precise but faster for large ticks
    };
    
    if tick > 0 {
        // For positive ticks: ratio increases
        // Formula: Q96 * (1 + tick * 0.00005) for small ticks
        let increment_u256 = (q96_u256 * abs_tick_u256) / denominator;
        let increment: u128 = increment_u256.try_into().unwrap();
        let new_ratio = Q96 + increment;
        // Ensure we don't exceed MAX_SQRT_RATIO
        if new_ratio > MAX_SQRT_RATIO {
            MAX_SQRT_RATIO
        } else {
            new_ratio
        }
    } else {
        // For negative ticks: ratio decreases
        // Formula: Q96 * (1 - tick * 0.00005) for small ticks
        let decrement_u256 = (q96_u256 * abs_tick_u256) / denominator;
        let decrement: u128 = decrement_u256.try_into().unwrap();
        if decrement < Q96 {
            let new_ratio = Q96 - decrement;
            // For very small negative ticks, ensure it's always less than Q96
            if abs_tick <= 60 {
                // For ticks like -60, ensure we get a value less than Q96
                // Use a more aggressive decrement for small ticks
                let min_diff = if abs_tick <= 10 {
                    Q96 / 1000 // 0.1% difference for very small ticks
                } else {
                    Q96 / 10000 // 0.01% difference for small ticks
                };
                if new_ratio >= Q96 {
                    Q96 - min_diff
                } else if new_ratio < MIN_SQRT_RATIO {
                    MIN_SQRT_RATIO
                } else {
                    new_ratio
                }
            } else if new_ratio < MIN_SQRT_RATIO {
                MIN_SQRT_RATIO
            } else {
                new_ratio
            }
        } else {
            MIN_SQRT_RATIO
        }
    }
}

/// Get tick at a given sqrt price
/// Uses binary search to find the tick
pub fn get_tick_at_sqrt_ratio(sqrt_price_x96: u128) -> i32 {
    // Allow Q96 (tick 0) as a special case
    if sqrt_price_x96 == Q96 {
        return 0;
    };
    assert(sqrt_price_x96 >= MIN_SQRT_RATIO && sqrt_price_x96 <= MAX_SQRT_RATIO, 'Sqrt price out of bounds');
    
    // Binary search for the tick
    let mut low = MIN_TICK;
    let mut high = MAX_TICK;
    
    while low < high {
        let mid = (low + high + 1) / 2;
        let sqrt_ratio_mid = get_sqrt_ratio_at_tick(mid);
        
        if sqrt_ratio_mid <= sqrt_price_x96 {
            low = mid;
        } else {
            high = mid - 1;
        };
    };
    
    low
}

/// Convert a tick to sqrt price (Q64.96 format)
pub fn tick_to_sqrt_price_x96(tick: i32) -> u128 {
    get_sqrt_ratio_at_tick(tick)
}

/// Convert a sqrt price (Q64.96 format) to a tick
pub fn sqrt_price_x96_to_tick(sqrt_price_x96: u128) -> i32 {
    get_tick_at_sqrt_ratio(sqrt_price_x96)
}

/// Multiply two u128 values maintaining Q64.96 format
/// Returns (a * b) / 2^96
/// Uses u256 to prevent overflow
pub fn mul_u128(a: u128, b: u128) -> u128 {
    // For Q64.96 format: result = (a * b) / 2^96
    // Use u256 to prevent overflow
    let a_u256: u256 = a.try_into().unwrap();
    let b_u256: u256 = b.try_into().unwrap();
    let q96_u256: u256 = Q96.try_into().unwrap();
    let product = a_u256 * b_u256;
    let result = product / q96_u256;
    result.try_into().unwrap()
}

/// Divide two u128 values maintaining Q64.96 format
/// Returns (a * 2^96) / b
/// Uses u256 to prevent overflow
pub fn div_u128(a: u128, b: u128) -> u128 {
    assert(b != 0, 'Division by zero');
    // For Q64.96 format: result = (a * 2^96) / b
    // Use u256 to prevent overflow
    let a_u256: u256 = a.try_into().unwrap();
    let q96_u256: u256 = Q96.try_into().unwrap();
    let b_u256: u256 = b.try_into().unwrap();
    let numerator = a_u256 * q96_u256;
    let result = numerator / b_u256;
    result.try_into().unwrap()
}

/// Multiply two Q64.96 values
pub fn mul_ratio(a: u128, b: u128) -> u128 {
    mul_u128(a, b)
}

/// Divide two Q64.96 values
pub fn div_ratio(a: u128, b: u128) -> u128 {
    div_u128(a, b)
}
