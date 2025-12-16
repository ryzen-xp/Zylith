// Liquidity Management - Calculate and update liquidity
// Based on Uniswap v3 / Ekubo formulas

use super::math;

/// Calculate liquidity for a given range (token0)
/// Formula: L = amount0 * (sqrt(P_b) * sqrt(P_a)) / (sqrt(P_b) - sqrt(P_a))
/// Where P_a and P_b are sqrt prices at tick boundaries
pub fn get_liquidity_for_amount0(
    sqrt_price_a_x96: u128,
    sqrt_price_b_x96: u128,
    amount0: u128,
) -> u128 {
    // Ensure price_a < price_b (swap if needed)
    let (price_lower, price_upper) = if sqrt_price_a_x96 < sqrt_price_b_x96 {
        (sqrt_price_a_x96, sqrt_price_b_x96)
    } else {
        (sqrt_price_b_x96, sqrt_price_a_x96)
    };
    assert(price_lower < price_upper, 'Invalid price range');
    
    // Calculate: amount0 * (sqrt(P_b) * sqrt(P_a)) / (sqrt(P_b) - sqrt(P_a))
    // In Q64.96 format
    
    let sqrt_price_diff = price_upper - price_lower;
    assert(sqrt_price_diff > 0, 'Price diff must be positive');
    
    // numerator = amount0 * sqrt(P_b) * sqrt(P_a)
    let numerator = math::mul_u128(amount0, price_upper);
    let numerator = math::mul_u128(numerator, price_lower);
    
    // result = numerator / sqrt_price_diff
    // But we need to account for Q64.96 format
    let result = numerator / sqrt_price_diff;
    
    result
}

/// Calculate liquidity for a given range (token1)
/// Formula: L = amount1 / (sqrt(P_b) - sqrt(P_a))
pub fn get_liquidity_for_amount1(
    sqrt_price_a_x96: u128,
    sqrt_price_b_x96: u128,
    amount1: u128,
) -> u128 {
    // Ensure price_a < price_b (swap if needed)
    let (price_lower, price_upper) = if sqrt_price_a_x96 < sqrt_price_b_x96 {
        (sqrt_price_a_x96, sqrt_price_b_x96)
    } else {
        (sqrt_price_b_x96, sqrt_price_a_x96)
    };
    assert(price_lower < price_upper, 'Invalid price range');
    
    // Calculate: amount1 / (sqrt(P_b) - sqrt(P_a))
    let sqrt_price_diff = price_upper - price_lower;
    assert(sqrt_price_diff > 0, 'Price diff must be positive');
    
    // In Q64.96 format: result = (amount1 * 2^96) / sqrt_price_diff
    let numerator = math::mul_u128(amount1, 79228162514264337593543950336); // Q96
    let result = numerator / sqrt_price_diff;
    
    result
}

/// Calculate amount0 from liquidity
/// Inverse of get_liquidity_for_amount0
pub fn get_amount0_for_liquidity(
    sqrt_price_a_x96: u128,
    sqrt_price_b_x96: u128,
    liquidity: u128,
) -> u128 {
    // Ensure price_a < price_b (swap if needed)
    let (price_lower, price_upper) = if sqrt_price_a_x96 < sqrt_price_b_x96 {
        (sqrt_price_a_x96, sqrt_price_b_x96)
    } else {
        (sqrt_price_b_x96, sqrt_price_a_x96)
    };
    assert(price_lower < price_upper, 'Invalid price range');
    
    // Formula: amount0 = L * (sqrt(P_b) - sqrt(P_a)) / (sqrt(P_b) * sqrt(P_a))
    let sqrt_price_diff = price_upper - price_lower;
    let numerator = math::mul_u128(liquidity, sqrt_price_diff);
    
    let denominator = math::mul_u128(price_upper, price_lower);
    assert(denominator > 0, 'Denominator must be positive');
    
    // Account for Q64.96 format
    // Use u256 to prevent overflow
    let q96_u256: u256 = 79228162514264337593543950336_u128.try_into().unwrap();
    let numerator_u256: u256 = numerator.try_into().unwrap();
    let scaled_numerator = numerator_u256 * q96_u256;
    let denominator_u256: u256 = denominator.try_into().unwrap();
    let result_u256 = scaled_numerator / denominator_u256;
    result_u256.try_into().unwrap()
}

/// Calculate amount1 from liquidity
/// Inverse of get_liquidity_for_amount1
pub fn get_amount1_for_liquidity(
    sqrt_price_a_x96: u128,
    sqrt_price_b_x96: u128,
    liquidity: u128,
) -> u128 {
    // Ensure price_a < price_b (swap if needed)
    let (price_lower, price_upper) = if sqrt_price_a_x96 < sqrt_price_b_x96 {
        (sqrt_price_a_x96, sqrt_price_b_x96)
    } else {
        (sqrt_price_b_x96, sqrt_price_a_x96)
    };
    // Allow equal prices (return 0 in that case)
    if price_lower >= price_upper {
        return 0;
    };
    
    // Formula: amount1 = L * (sqrt(P_b) - sqrt(P_a)) / 2^96
    let sqrt_price_diff = price_upper - price_lower;
    let numerator = math::mul_u128(liquidity, sqrt_price_diff);
    
    // Divide by Q96 to get amount1
    let result = numerator / 79228162514264337593543950336;
    
    result
}

/// Update liquidity at a tick (helper function)
/// NOTE: Actual implementation will be in the contract that has tick storage
pub fn calculate_liquidity_delta(
    liquidity_gross: u128,
    liquidity_net: i128,
    upper: bool,
) -> i128 {
    if upper {
        -liquidity_net
    } else {
        liquidity_net
    }
}
