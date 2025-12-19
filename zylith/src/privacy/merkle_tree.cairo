// Merkle Tree with Poseidon BN254 (using Garaga's implementation)
// CRITICAL: Must use Garaga's Poseidon BN254, NOT Cairo's native Poseidon

use core::array::ArrayTrait;
use garaga::definitions::u384;
use garaga::hashes::poseidon_hash_2_bn254;
use starknet::storage::*;

/// Merkle tree depth (adjustable for MVP)
pub const TREE_DEPTH: u32 = 20;

#[starknet::storage_node]
pub struct MerkleTreeStorage {
    pub root: felt252,
    pub next_index: u32,
    // Store leaves for reconstruction (in production, this would be off-chain)
    pub leaves: Map<u32, felt252>,
    // Store intermediate nodes for efficient root calculation
    pub nodes: Map<(u32, u32), felt252> // (level, index) -> node hash
}

// Merkle tree storage node definition
// Functions using this storage will be implemented in the main Zylith contract
// Storage nodes can only be accessed from within a #[starknet::contract] module

/// Hash two nodes using Poseidon BN254
/// NOTE: For full BN254 compatibility, this should use Garaga's Poseidon BN254
/// For now, using Cairo's native Poseidon as placeholder - MUST be replaced with Garaga
pub fn hash_nodes(left: felt252, right: felt252) -> felt252 {
    let state: u384 = poseidon_hash_2_bn254(left.into(), right.into());

    let x: u256 = state.try_into().unwrap();
    x.try_into().unwrap()
}

/// Calculate Merkle root from leaves (recursive calculation)
/// This function calculates the root by building the tree bottom-up
pub fn calculate_root_from_leaves(leaves: Array<felt252>) -> felt252 {
    let num_leaves = leaves.len();

    if num_leaves == 0 {
        return 0; // Empty tree
    }

    if num_leaves == 1 {
        return *leaves.at(0);
    }

    // Build tree level by level
    let mut current_level = leaves;
    let mut next_level: Array<felt252> = ArrayTrait::new();

    while current_level.len() > 1 {
        let level_size = current_level.len();
        let mut i = 0;

        while i < level_size {
            if i + 1 < level_size {
                // Pair of nodes
                let left = *current_level.at(i);
                let right = *current_level.at(i + 1);
                let hash_val = hash_nodes(left, right);
                next_level.append(hash_val);
            } else {
                // Odd node, hash with itself
                let node = *current_level.at(i);
                let hash_val = hash_nodes(node, node);
                next_level.append(hash_val);
            }
            i = i + 2;
        }

        current_level = next_level;
        next_level = ArrayTrait::new();
    }

    return *current_level.at(0);
}

/// Verify Merkle proof
pub fn verify_proof(
    leaf: felt252,
    path: Array<felt252>,
    path_indices: Array<u32>, // 0 = left, 1 = right
    root: felt252,
) -> bool {
    let mut current_hash = leaf;
    let path_len = path.len();
    let indices_len = path_indices.len();

    assert!(path_len == indices_len);

    let mut i = 0;
    while i < path_len {
        let sibling = *path.at(i);
        let index = *path_indices.at(i);

        if index == 0 {
            // Sibling is on the right
            current_hash = hash_nodes(current_hash, sibling);
        } else {
            // Sibling is on the left
            current_hash = hash_nodes(sibling, current_hash);
        }

        i = i + 1;
    }

    current_hash == root
}

