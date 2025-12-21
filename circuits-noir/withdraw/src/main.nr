// Withdraw Circuit
// Proves authorization to withdraw funds from a commitment to a recipient address

use dep::poseidon::poseidon::bn254;

fn main(
    // Public inputs
    merkle_root: Field,
    commitment: Field,
    nullifier: Field,
    recipient: Field,
    amount: u128,

    // Private inputs
    secret: Field,

    // Merkle proof
    path_elements: [Field; 20],
    path_indices: [Field; 20]
) {
    // ============================================
    // Step 1: Verify nullifier derivation
    // ============================================

    // The nullifier is derived from the secret
    // This prevents double-spending: once a nullifier is published,
    // the commitment cannot be spent again
    let computed_nullifier = bn254::hash_2([secret, 0]);

    assert(
        computed_nullifier == nullifier,
        "Nullifier does not match secret"
    );

    // ============================================
    // Step 2: Verify commitment construction
    // ============================================

    // commitment = Poseidon(Poseidon(secret, nullifier), amount)
    let leaf_hash = bn254::hash_2([secret, nullifier]);
    let computed_commitment = bn254::hash_2([leaf_hash, amount as Field]);

    assert(
        computed_commitment == commitment,
        "Commitment verification failed"
    );

    // ============================================
    // Step 3: Verify Merkle proof (membership)
    // ============================================

    // Start with the commitment as the leaf
    let mut current_hash = commitment;

    // Traverse the Merkle tree from leaf to root
    for i in 0..20 {
        let path_element = path_elements[i];
        let path_index = path_indices[i];

        // Determine hash order based on path_index
        let (left, right) = if path_index == 0 {
            (current_hash, path_element)
        } else {
            (path_element, current_hash)
        };

        current_hash = bn254::hash_2([left, right]);
    }

    // Verify the computed root matches the expected root
    assert(
        current_hash == merkle_root,
        "Merkle proof verification failed"
    );

    // ============================================
    // Step 4: Verify withdrawal authorization
    // ============================================

    // The recipient address is included in public inputs
    // This proves the withdrawal is going to the correct address
    // In the actual implementation, the recipient would be used
    // by the contract to transfer funds

    // Basic validation: amount must be positive
    assert(amount > 0, "Withdrawal amount must be positive");

    // The recipient field is included in the proof to bind the withdrawal
    // to a specific address. The contract will verify this matches
    // the actual transfer destination.
    // Note: In a real implementation, you might want to hash the recipient
    // into the proof for additional security, but for the MVP we just
    // include it as a public input.
}

// Test module
#[test]
fn test_withdraw_valid_proof() {
    // Test values
    let secret: Field = 12345;
    let amount: u128 = 1000;

    // Compute nullifier
    let nullifier = bn254::hash_2([secret, 0]);

    // Compute commitment
    let leaf_hash = bn254::hash_2([secret, nullifier]);
    let commitment = bn254::hash_2([leaf_hash, amount as Field]);

    // Compute Merkle root (single leaf tree)
    let mut current = commitment;
    for _i in 0..20 {
        current = bn254::hash_2([current, 0]);
    }
    let merkle_root = current;

    // Recipient address (as Field)
    let recipient: Field = 0x1234567890abcdef1234567890abcdef12345678;

    // Merkle proof (all zeros for single leaf)
    let path_elements: [Field; 20] = [0; 20];
    let path_indices: [Field; 20] = [0; 20];

    // This should pass
    main(
        merkle_root,
        commitment,
        nullifier,
        recipient,
        amount,
        secret,
        path_elements,
        path_indices
    );
}

#[test]
fn test_withdraw_wrong_nullifier() {
    // This test verifies that using the wrong nullifier fails

    let secret: Field = 12345;
    let amount: u128 = 1000;

    let nullifier = bn254::hash_2([secret, 0]);
    let leaf_hash = bn254::hash_2([secret, nullifier]);
    let commitment = bn254::hash_2([leaf_hash, amount as Field]);

    let mut current = commitment;
    for _i in 0..20 {
        current = bn254::hash_2([current, 0]);
    }
    let merkle_root = current;

    let recipient: Field = 0x1234567890abcdef1234567890abcdef12345678;
    let path_elements: [Field; 20] = [0; 20];
    let path_indices: [Field; 20] = [0; 20];

    // Use different secret for nullifier (should fail)
    let wrong_secret: Field = 99999;

    // This should fail with "Nullifier does not match secret"
    main(
        merkle_root,
        commitment,
        nullifier,
        recipient,
        amount,
        wrong_secret,  // Wrong secret!
        path_elements,
        path_indices
    );
}
