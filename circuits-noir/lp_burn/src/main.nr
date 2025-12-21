// LP Burn Circuit
// Proves removal of liquidity from a position in the CLMM

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
    liquidity_delta: u128,  // Amount being removed
    sqrt_price_current: u128,

    // Private inputs - Input commitment (LP position being burned)
    secret_in: Field,
    nullifier_in: Field,
    position_liquidity: u128,  // Total liquidity in the position

    // Private inputs - Output commitment (tokens withdrawn)
    secret_out: Field,
    nullifier_out: Field,
    amount0: u128,  // Token0 amount withdrawn
    amount1: u128,  // Token1 amount withdrawn

    // Merkle proof for input commitment
    path_elements: [Field; 20],
    path_indices: [Field; 20]
) {
    // ============================================
    // Step 1: Verify input commitment membership
    // ============================================

    // The input commitment represents the LP position
    // commitment = Poseidon(Poseidon(secret, nullifier), position_liquidity)
    let leaf_hash_in = bn254::hash_2([secret_in, nullifier_in]);
    let computed_input_commitment = bn254::hash_2([leaf_hash_in, position_liquidity as Field]);

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

    // The new commitment represents the tokens received
    // commitment = Poseidon(Poseidon(secret, nullifier), Poseidon(amount0, amount1))
    let leaf_hash_out = bn254::hash_2([secret_out, nullifier_out]);
    let amounts_hash = bn254::hash_2([amount0 as Field, amount1 as Field]);
    let computed_output_commitment = bn254::hash_2([leaf_hash_out, amounts_hash]);

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
    // Step 5: Validate liquidity amounts
    // ============================================

    // Liquidity delta must be positive
    assert(liquidity_delta > 0, "Liquidity delta must be positive");

    // Cannot remove more liquidity than exists in position
    assert(
        liquidity_delta <= position_liquidity,
        "Cannot remove more liquidity than position has"
    );

    // At least one amount must be received
    assert(
        (amount0 > 0) | (amount1 > 0),
        "At least one amount must be positive"
    );

    // Price must be positive
    assert(sqrt_price_current > 0, "Current price must be positive");

    // ============================================
    // Step 6: Validate protocol fee deduction
    // ============================================

    // TODO: Implement protocol fee verification
    // The Cairo implementation uses a withdrawal fee on liquidity burns
    // The actual amounts received should be less than the theoretical amounts
    // due to protocol fees being deducted
    //
    // Expected flow:
    // 1. Calculate theoretical amounts from liquidity_delta and tick range
    // 2. Apply protocol fee percentage
    // 3. Verify amount0 and amount1 match the post-fee amounts

    // ============================================
    // Step 7: Simplified liquidity burn check
    // ============================================

    // TODO: Implement precise liquidity-to-amounts calculation
    // The amounts received should match the liquidity being burned:
    //
    // If current price is below range (price < tick_lower):
    //   amount0 = L * (sqrt_price_upper - sqrt_price_lower) / (sqrt_price_upper * sqrt_price_lower)
    //   amount1 = 0
    //
    // If current price is above range (price > tick_upper):
    //   amount0 = 0
    //   amount1 = L * (sqrt_price_upper - sqrt_price_lower)
    //
    // If current price is in range:
    //   amount0 = L * (sqrt_price - sqrt_price_lower) / (sqrt_price * sqrt_price_lower)
    //   amount1 = L * (sqrt_price_upper - sqrt_price)
    //
    // For now, we verify basic invariants:

    if (amount0 > 0) & (amount1 == 0) {
        // Receiving only token0
        // Valid when current price is below the range
        // TODO: Verify sqrt_price_current < sqrt_price_at_tick_lower
    }

    if (amount0 == 0) & (amount1 > 0) {
        // Receiving only token1
        // Valid when current price is above the range
        // TODO: Verify sqrt_price_current > sqrt_price_at_tick_upper
    }

    if (amount0 > 0) & (amount1 > 0) {
        // Receiving both tokens
        // Valid when current price is within the range
        // TODO: Verify tick_lower < current_tick < tick_upper
    }

    // TODO: Verify exact amount calculations with:
    // - Tick to sqrt_price conversion
    // - Q96 fixed-point arithmetic
    // - Protocol fee accounting
    // - Matching Cairo's get_liquidity_for_amounts function
}

// Test module
#[test]
fn test_lp_burn_valid_proof() {
    // Test values
    let secret_in: Field = 54321;
    let nullifier_in: Field = 98760;
    let position_liquidity: u128 = 100000;

    let secret_out: Field = 12345;
    let nullifier_out: Field = 67890;
    let amount0: u128 = 500;
    let amount1: u128 = 500;

    // Compute input commitment (LP position)
    let leaf_hash_in = bn254::hash_2([secret_in, nullifier_in]);
    let old_commitment = bn254::hash_2([leaf_hash_in, position_liquidity as Field]);

    // LP burn parameters
    let tick_lower: i32 = -60;
    let tick_upper: i32 = 60;
    let liquidity_delta: u128 = 50000;  // Removing half the liquidity
    let sqrt_price_current: u128 = 1000000;

    // Compute output commitment (tokens received)
    let leaf_hash_out = bn254::hash_2([secret_out, nullifier_out]);
    let amounts_hash = bn254::hash_2([amount0 as Field, amount1 as Field]);
    let new_commitment = bn254::hash_2([leaf_hash_out, amounts_hash]);

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
        position_liquidity,
        secret_out,
        nullifier_out,
        amount0,
        amount1,
        path_elements,
        path_indices
    );
}

#[test]
fn test_lp_burn_excessive_liquidity() {
    // Test that removing more liquidity than exists fails

    let secret_in: Field = 54321;
    let nullifier_in: Field = 98760;
    let position_liquidity: u128 = 100000;

    let secret_out: Field = 12345;
    let nullifier_out: Field = 67890;
    let amount0: u128 = 500;
    let amount1: u128 = 500;

    let leaf_hash_in = bn254::hash_2([secret_in, nullifier_in]);
    let old_commitment = bn254::hash_2([leaf_hash_in, position_liquidity as Field]);

    let tick_lower: i32 = -60;
    let tick_upper: i32 = 60;
    let liquidity_delta: u128 = 150000;  // MORE than position_liquidity!
    let sqrt_price_current: u128 = 1000000;

    let leaf_hash_out = bn254::hash_2([secret_out, nullifier_out]);
    let amounts_hash = bn254::hash_2([amount0 as Field, amount1 as Field]);
    let new_commitment = bn254::hash_2([leaf_hash_out, amounts_hash]);

    let mut current = old_commitment;
    for _i in 0..20 {
        current = bn254::hash_2([current, 0]);
    }
    let merkle_root = current;

    let path_elements: [Field; 20] = [0; 20];
    let path_indices: [Field; 20] = [0; 20];

    // This should fail with "Cannot remove more liquidity than position has"
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
        position_liquidity,
        secret_out,
        nullifier_out,
        amount0,
        amount1,
        path_elements,
        path_indices
    );
}
