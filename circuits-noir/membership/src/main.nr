// Membership Circuit
// Proves that a commitment exists in the Merkle tree

use dep::poseidon::poseidon::bn254;

fn main(
    // Public inputs
    root: Field,
    commitment: Field,

    // Private inputs
    secret: Field,
    nullifier: Field,
    amount: Field,
    path_elements: [Field; 20],
    path_indices: [Field; 20]
) {
    // Step 1: Verify commitment construction
    // commitment = Poseidon(Poseidon(secret, nullifier), amount)
    let leaf_hash = bn254::hash_2([secret, nullifier]);
    let computed_commitment = bn254::hash_2([leaf_hash, amount]);

    assert(
        computed_commitment == commitment,
        "Commitment verification failed: computed commitment does not match provided commitment"
    );

    // Step 2: Verify Merkle proof
    // Start with the commitment as the current hash
    let mut current_hash = commitment;

    // Traverse the Merkle tree from leaf to root
    for i in 0..20 {
        let path_element = path_elements[i];
        let path_index = path_indices[i];

        // Determine the order of hashing based on path_index
        // If path_index == 0, current_hash is on the left
        // If path_index == 1, current_hash is on the right
        let (left, right) = if path_index == 0 {
            (current_hash, path_element)
        } else {
            (path_element, current_hash)
        };

        // Hash the pair to get the parent node
        current_hash = bn254::hash_2([left, right]);
    }

    // Step 3: Verify the computed root matches the expected root
    assert(
        current_hash == root,
        "Merkle proof verification failed: computed root does not match expected root"
    );
}

// Test module
#[test]
fn test_membership_valid_proof() {
    // This is a placeholder test - actual test data should come from
    // the Cairo implementation to ensure consistency

    // Test values (these should match Cairo implementation)
    let secret: Field = 12345;
    let nullifier: Field = 67890;
    let amount: Field = 1000;

    // Compute commitment
    let leaf_hash = bn254::hash_2([secret, nullifier]);
    let commitment = bn254::hash_2([leaf_hash, amount]);

    // For a tree with only one leaf at index 0, the path elements are all zeros
    let path_elements: [Field; 20] = [0; 20];
    let path_indices: [Field; 20] = [0; 20];

    // Compute the root by hashing up the tree
    let mut current = commitment;
    for i in 0..20 {
        // Since path_index is 0, current goes on the left
        current = bn254::hash_2([current, 0]);
    }
    let root = current;

    // This should pass
    main(root, commitment, secret, nullifier, amount, path_elements, path_indices);
}
