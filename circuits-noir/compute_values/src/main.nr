use dep::poseidon::poseidon::bn254;

fn main(secret: Field, nullifier: Field, amount: Field) -> pub (Field, Field) {
    // Compute commitment
    let leaf_hash = bn254::hash_2([secret, nullifier]);
    let commitment = bn254::hash_2([leaf_hash, amount]);

    // Compute root by hashing up the tree (20 levels)
    let mut current = commitment;
    for _i in 0..20 {
        current = bn254::hash_2([current, 0]);
    }
    let root = current;

    (commitment, root)
}
