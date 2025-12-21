// LP Mint Circuit
// Proves creation of a liquidity position in the CLMM

use dep::poseidon::poseidon::bn254;

// Constants matching Cairo implementation
global TICK_SPACING: i32 = 60;
global MIN_TICK: i32 = -887272;
global MAX_TICK: i32 = 887272;

fn main(
    // Public inputs
    merkle_root: Field,
    old_commitment: Field,
    new_commitment: Field,
    tick_lower: i32,
    tick_upper: i32,
    liquidity_delta: u128,
    sqrt_price_current: u128,

    // Private inputs - Input commitment (tokens being added)
    secret_in: Field,
    nullifier_in: Field,
    amount0: u128,
    amount1: u128,

    // Private inputs - Output commitment (LP position)
    secret_out: Field,
    nullifier_out: Field,

    // Merkle proof for input commitment
    path_elements: [Field; 20],
    path_indices: [Field; 20]
) {
    // ============================================
    // Step 1: Verify input commitment membership
    // ============================================

    // Compute the input commitment (tokens being provided)
    // commitment = Poseidon(Poseidon(secret, nullifier), Poseidon(amount0, amount1))
    let leaf_hash_in = bn254::hash_2([secret_in, nullifier_in]);
    let amounts_hash = bn254::hash_2([amount0 as Field, amount1 as Field]);
    let computed_input_commitment = bn254::hash_2([leaf_hash_in, amounts_hash]);

    // Verify the input commitment exists in the Merkle tree
    let mut current_hash = computed_input_commitment;
    for i in 0..20 {
        let path_element = path_elements[i];
        let path_index = path_indices[i];

        let (left, right) = if path_index == 0 {
            (current_hash, path_element)
        } else {
            (path_element, current_hash)
        };

        current_hash = bn254::hash_2([left, right]);
    }

    assert(
        current_hash == merkle_root,
        "Input commitment not found in Merkle tree"
    );

    // ============================================
    // Step 2: Verify old commitment construction
    // ============================================

    assert(
        computed_input_commitment == old_commitment,
        "Old commitment does not match input commitment"
    );

    // ============================================
    // Step 3: Verify new commitment construction
    // ============================================

    // The new commitment represents the LP position
    // commitment = Poseidon(Poseidon(secret, nullifier), liquidity_delta)
    let leaf_hash_out = bn254::hash_2([secret_out, nullifier_out]);
    let computed_output_commitment = bn254::hash_2([leaf_hash_out, liquidity_delta as Field]);

    assert(
        computed_output_commitment == new_commitment,
        "New commitment does not match computed output commitment"
    );

    // ============================================
    // Step 4: Validate tick parameters
    // ============================================

    // Ticks must be within valid range
    assert(tick_lower >= MIN_TICK, "tick_lower below minimum");
    assert(tick_lower <= MAX_TICK, "tick_lower above maximum");
    assert(tick_upper >= MIN_TICK, "tick_upper below minimum");
    assert(tick_upper <= MAX_TICK, "tick_upper above maximum");

    // tick_lower must be less than tick_upper
    assert(tick_lower < tick_upper, "tick_lower must be less than tick_upper");

    // Both ticks must be divisible by TICK_SPACING
    assert(
        tick_lower % TICK_SPACING == 0,
        "tick_lower not divisible by TICK_SPACING"
    );
    assert(
        tick_upper % TICK_SPACING == 0,
        "tick_upper not divisible by TICK_SPACING"
    );

    // ============================================
    // Step 5: Validate liquidity and amounts
    // ============================================

    // Liquidity must be positive
    assert(liquidity_delta > 0, "Liquidity delta must be positive");

    // At least one amount must be positive
    assert(
        (amount0 > 0) | (amount1 > 0),
        "At least one amount must be positive"
    );

    // Basic validation that amounts are reasonable given liquidity
    // In production, this would use precise Q64.96 calculations
    assert(sqrt_price_current > 0, "Current price must be positive");

    // ============================================
    // Step 6: Simplified liquidity calculation check
    // ============================================

    // TODO: Implement precise liquidity calculation
    // The liquidity should be calculated from amounts and tick range:
    //
    // If current price is below range (price < tick_lower):
    //   L = amount0 * (sqrt_price_upper * sqrt_price_lower) / (sqrt_price_upper - sqrt_price_lower)
    //
    // If current price is above range (price > tick_upper):
    //   L = amount1 / (sqrt_price_upper - sqrt_price_lower)
    //
    // If current price is in range:
    //   L = min(
    //     amount0 * sqrt_price * sqrt_price_lower / (sqrt_price - sqrt_price_lower),
    //     amount1 / (sqrt_price - sqrt_price_lower)
    //   )
    //
    // For now, we just verify basic invariants:

    // If only amount0 provided, price should be below the range
    // If only amount1 provided, price should be above the range
    // If both amounts provided, price should be in the range

    if (amount0 > 0) & (amount1 == 0) {
        // Single-sided liquidity provision (token0 only)
        // This is valid when current price is below the range
        // TODO: Verify sqrt_price_current < sqrt_price_at_tick_lower
    }

    if (amount0 == 0) & (amount1 > 0) {
        // Single-sided liquidity provision (token1 only)
        // This is valid when current price is above the range
        // TODO: Verify sqrt_price_current > sqrt_price_at_tick_upper
    }

    if (amount0 > 0) & (amount1 > 0) {
        // Two-sided liquidity provision
        // This is valid when current price is within the range
        // TODO: Verify tick_lower < current_tick < tick_upper
    }

    // TODO: Verify exact liquidity calculation matches the amounts
    // This requires:
    // - Converting ticks to sqrt_price values
    // - Q96 fixed-point arithmetic
    // - Matching the Cairo implementation's get_amounts_for_liquidity function
}

// Test module
#[test]
fn test_lp_mint_valid_proof() {
    // Test values
    let secret_in: Field = 12345;
    let nullifier_in: Field = 67890;
    let amount0: u128 = 1000;
    let amount1: u128 = 1000;

    let secret_out: Field = 54321;
    let nullifier_out: Field = 98760;

    // Compute input commitment
    let leaf_hash_in = bn254::hash_2([secret_in, nullifier_in]);
    let amounts_hash = bn254::hash_2([amount0 as Field, amount1 as Field]);
    let old_commitment = bn254::hash_2([leaf_hash_in, amounts_hash]);

    // LP position parameters
    let tick_lower: i32 = -60;  // Divisible by TICK_SPACING
    let tick_upper: i32 = 60;   // Divisible by TICK_SPACING
    let liquidity_delta: u128 = 100000;
    let sqrt_price_current: u128 = 1000000;

    // Compute output commitment (LP position)
    let leaf_hash_out = bn254::hash_2([secret_out, nullifier_out]);
    let new_commitment = bn254::hash_2([leaf_hash_out, liquidity_delta as Field]);

    // Compute Merkle root (single leaf tree)
    let mut current = old_commitment;
    for _i in 0..20 {
        current = bn254::hash_2([current, 0]);
    }
    let merkle_root = current;

    // Merkle proof (all zeros for single leaf)
    let path_elements: [Field; 20] = [0; 20];
    let path_indices: [Field; 20] = [0; 20];

    // This should pass
    main(
        merkle_root,
        old_commitment,
        new_commitment,
        tick_lower,
        tick_upper,
        liquidity_delta,
        sqrt_price_current,
        secret_in,
        nullifier_in,
        amount0,
        amount1,
        secret_out,
        nullifier_out,
        path_elements,
        path_indices
    );
}

#[test]
fn test_lp_mint_invalid_tick_spacing() {
    // Test that invalid tick spacing is rejected

    let secret_in: Field = 12345;
    let nullifier_in: Field = 67890;
    let amount0: u128 = 1000;
    let amount1: u128 = 1000;

    let secret_out: Field = 54321;
    let nullifier_out: Field = 98760;

    let leaf_hash_in = bn254::hash_2([secret_in, nullifier_in]);
    let amounts_hash = bn254::hash_2([amount0 as Field, amount1 as Field]);
    let old_commitment = bn254::hash_2([leaf_hash_in, amounts_hash]);

    // Invalid tick_lower (not divisible by TICK_SPACING)
    let tick_lower: i32 = -65;  // NOT divisible by 60
    let tick_upper: i32 = 60;
    let liquidity_delta: u128 = 100000;
    let sqrt_price_current: u128 = 1000000;

    let leaf_hash_out = bn254::hash_2([secret_out, nullifier_out]);
    let new_commitment = bn254::hash_2([leaf_hash_out, liquidity_delta as Field]);

    let mut current = old_commitment;
    for _i in 0..20 {
        current = bn254::hash_2([current, 0]);
    }
    let merkle_root = current;

    let path_elements: [Field; 20] = [0; 20];
    let path_indices: [Field; 20] = [0; 20];

    // This should fail with "tick_lower not divisible by TICK_SPACING"
    main(
        merkle_root,
        old_commitment,
        new_commitment,
        tick_lower,
        tick_upper,
        liquidity_delta,
        sqrt_price_current,
        secret_in,
        nullifier_in,
        amount0,
        amount1,
        secret_out,
        nullifier_out,
        path_elements,
        path_indices
    );
}
