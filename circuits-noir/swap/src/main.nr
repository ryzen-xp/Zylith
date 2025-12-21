// Swap Circuit
// Proves a valid private swap in the CLMM with commitment updates

use dep::poseidon::poseidon::bn254;

fn main(
    // Public inputs
    merkle_root: Field,
    old_commitment: Field,
    new_commitment: Field,
    sqrt_price_before: u128,
    sqrt_price_after: u128,
    liquidity: u128,
    zero_for_one: bool,

    // Private inputs - Input commitment (token being swapped in)
    secret_in: Field,
    nullifier_in: Field,
    amount_in: u128,

    // Private inputs - Output commitment (token received from swap)
    secret_out: Field,
    nullifier_out: Field,
    amount_out: u128,

    // Merkle proof for input commitment
    path_elements: [Field; 20],
    path_indices: [Field; 20]
) {
    // ============================================
    // Step 1: Verify input commitment membership
    // ============================================

    // Compute the input commitment
    let leaf_hash_in = bn254::hash_2([secret_in, nullifier_in]);
    let computed_input_commitment = bn254::hash_2([leaf_hash_in, amount_in as Field]);

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

    // The old commitment should match the input commitment
    assert(
        computed_input_commitment == old_commitment,
        "Old commitment does not match input commitment"
    );

    // ============================================
    // Step 3: Verify new commitment construction
    // ============================================

    // Compute the output commitment
    let leaf_hash_out = bn254::hash_2([secret_out, nullifier_out]);
    let computed_output_commitment = bn254::hash_2([leaf_hash_out, amount_out as Field]);

    // Verify the new commitment is correctly constructed
    assert(
        computed_output_commitment == new_commitment,
        "New commitment does not match computed output commitment"
    );

    // ============================================
    // Step 4: Verify CLMM swap math
    // ============================================

    // TODO: Implement full CLMM math verification
    // This requires:
    // 1. Q96 fixed-point arithmetic for sqrt_price
    // 2. Constant product formula: liquidity = sqrt_price * sqrt(token0 * token1)
    // 3. Price impact calculation based on amount_in
    // 4. Fee calculation (typically 0.3% or configurable)
    // 5. Slippage bounds verification
    //
    // For Phase 2 MVP, we implement simplified checks:

    // Basic sanity checks
    assert(amount_in > 0, "Amount in must be positive");
    assert(amount_out > 0, "Amount out must be positive");
    assert(liquidity > 0, "Liquidity must be positive");

    // Verify price moved in correct direction
    if zero_for_one {
        // Swapping token0 for token1, price should decrease
        assert(
            sqrt_price_after < sqrt_price_before,
            "Price should decrease for zero_for_one swap"
        );
    } else {
        // Swapping token1 for token0, price should increase
        assert(
            sqrt_price_after > sqrt_price_before,
            "Price should increase for one_for_zero swap"
        );
    }

    // Basic conservation check (simplified)
    // In reality, amount_out = f(amount_in, liquidity, price_change, fees)
    // For now, just verify output is less than input (due to fees and price impact)
    assert(
        amount_out < amount_in,
        "Output amount should be less than input (fees + slippage)"
    );

    // ============================================
    // Step 5: Verify price transition
    // ============================================

    // TODO: Implement precise price transition verification
    // The price change should match the CLMM formula:
    // delta(sqrt_price) = delta_y / liquidity (for zero_for_one)
    // delta(sqrt_price) = liquidity / delta_x (for one_for_zero)
    //
    // This requires implementing:
    // - Q96 fixed-point division and multiplication
    // - Overflow protection using larger integer types
    // - Matching Cairo implementation exactly

    // For Phase 2 MVP, we verify the price change is reasonable
    let price_change = if sqrt_price_before > sqrt_price_after {
        sqrt_price_before - sqrt_price_after
    } else {
        sqrt_price_after - sqrt_price_before
    };

    // Price change should be non-zero for a real swap
    assert(price_change > 0, "Price must change during swap");

    // Price change should not be extreme (basic bounds check)
    // In a real implementation, this would be based on the amount and liquidity
    let max_reasonable_change = sqrt_price_before / 2; // Max 50% price impact
    assert(
        price_change < max_reasonable_change,
        "Price change too extreme"
    );
}

// Test module
#[test]
fn test_swap_valid_proof() {
    // Test values
    let secret_in: Field = 12345;
    let nullifier_in: Field = 67890;
    let amount_in: u128 = 1000;

    let secret_out: Field = 54321;
    let nullifier_out: Field = 98760;
    let amount_out: u128 = 900; // After fees

    // Compute commitments
    let leaf_hash_in = bn254::hash_2([secret_in, nullifier_in]);
    let old_commitment = bn254::hash_2([leaf_hash_in, amount_in as Field]);

    let leaf_hash_out = bn254::hash_2([secret_out, nullifier_out]);
    let new_commitment = bn254::hash_2([leaf_hash_out, amount_out as Field]);

    // Compute Merkle root (single leaf tree)
    let mut current = old_commitment;
    for _i in 0..20 {
        current = bn254::hash_2([current, 0]);
    }
    let merkle_root = current;

    // CLMM parameters (example values)
    let sqrt_price_before: u128 = 1000000; // Q96 format
    let sqrt_price_after: u128 = 950000;   // Price decreased (zero_for_one)
    let liquidity: u128 = 500000;
    let zero_for_one = true;

    // Merkle proof (all zeros for single leaf)
    let path_elements: [Field; 20] = [0; 20];
    let path_indices: [Field; 20] = [0; 20];

    // This should pass
    main(
        merkle_root,
        old_commitment,
        new_commitment,
        sqrt_price_before,
        sqrt_price_after,
        liquidity,
        zero_for_one,
        secret_in,
        nullifier_in,
        amount_in,
        secret_out,
        nullifier_out,
        amount_out,
        path_elements,
        path_indices
    );
}

#[test]
fn test_swap_wrong_price_direction() {
    // This test should fail because price moves in wrong direction

    let secret_in: Field = 12345;
    let nullifier_in: Field = 67890;
    let amount_in: u128 = 1000;

    let secret_out: Field = 54321;
    let nullifier_out: Field = 98760;
    let amount_out: u128 = 900;

    let leaf_hash_in = bn254::hash_2([secret_in, nullifier_in]);
    let old_commitment = bn254::hash_2([leaf_hash_in, amount_in as Field]);

    let leaf_hash_out = bn254::hash_2([secret_out, nullifier_out]);
    let new_commitment = bn254::hash_2([leaf_hash_out, amount_out as Field]);

    let mut current = old_commitment;
    for _i in 0..20 {
        current = bn254::hash_2([current, 0]);
    }
    let merkle_root = current;

    // Wrong: price increases for zero_for_one (should decrease)
    let sqrt_price_before: u128 = 1000000;
    let sqrt_price_after: u128 = 1050000; // WRONG direction
    let liquidity: u128 = 500000;
    let zero_for_one = true;

    let path_elements: [Field; 20] = [0; 20];
    let path_indices: [Field; 20] = [0; 20];

    // This should fail with "Price should decrease for zero_for_one swap"
    main(
        merkle_root,
        old_commitment,
        new_commitment,
        sqrt_price_before,
        sqrt_price_after,
        liquidity,
        zero_for_one,
        secret_in,
        nullifier_in,
        amount_in,
        secret_out,
        nullifier_out,
        amount_out,
        path_elements,
        path_indices
    );
}
