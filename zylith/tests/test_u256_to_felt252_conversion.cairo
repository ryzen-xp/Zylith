use core::array::ArrayTrait;
use core::integer::u256;
use core::traits::{TryInto, Into};
use snforge_std::{declare, ContractClassTrait, DeclareResultTrait};
use zylith::privacy::mock_verifier::{IMockVerifier, IMockVerifierDispatcher, IMockVerifierDispatcherTrait};

#[test]
fn test_u256_to_felt252_conversion_with_large_values() {
    // Test values that are >= 2^128 (will have high != 0 when converted to u256)
    // These are the actual values from the ASP logs
    let nullifier_felt: felt252 = 894940142951511083072332372919666219214904477692021021291916532133654151109;
    let root_felt: felt252 = 1445485933812220050582740933073874602742611239214198775761002192043579171491;
    let commitment_felt: felt252 = 636394865011415153173528073558227851187564541861267689293481092409846177785;
    
    // Convert to u256 (simulating what the verifier does)
    let nullifier_u256: u256 = nullifier_felt.into();
    let root_u256: u256 = root_felt.into();
    let commitment_u256: u256 = commitment_felt.into();
    
    // Verify they have high != 0
    assert(nullifier_u256.high != 0, 'nullifier_high');
    assert(root_u256.high != 0, 'root_high');
    assert(commitment_u256.high != 0, 'commitment_high');
    
    // Reconstruct using our logic: high * 2^128 + low
    let q128: u256 = 340282366920938463463374607431768211456; // 2^128
    
    // Reconstruct nullifier
    let nullifier_high_u256: u256 = nullifier_u256.high.into();
    let nullifier_low_u256: u256 = nullifier_u256.low.into();
    let nullifier_reconstructed: u256 = nullifier_high_u256 * q128 + nullifier_low_u256;
    let nullifier_recovered: felt252 = nullifier_reconstructed.try_into().unwrap();
    
    // Reconstruct root
    let root_high_u256: u256 = root_u256.high.into();
    let root_low_u256: u256 = root_u256.low.into();
    let root_reconstructed: u256 = root_high_u256 * q128 + root_low_u256;
    let root_recovered: felt252 = root_reconstructed.try_into().unwrap();
    
    // Reconstruct commitment
    let commitment_high_u256: u256 = commitment_u256.high.into();
    let commitment_low_u256: u256 = commitment_u256.low.into();
    let commitment_reconstructed: u256 = commitment_high_u256 * q128 + commitment_low_u256;
    let commitment_recovered: felt252 = commitment_reconstructed.try_into().unwrap();
    
    // Verify reconstruction matches original
    assert(nullifier_recovered == nullifier_felt, 'nullifier_recon');
    assert(root_recovered == root_felt, 'root_recon');
    assert(commitment_recovered == commitment_felt, 'commitment_recon');
}

#[test]
fn test_u256_to_felt252_conversion_with_small_values() {
    // Test values that are < 2^128 (will have high == 0 when converted to u256)
    let small_felt: felt252 = 123456789;
    let small_u256: u256 = small_felt.into();
    
    // Verify it has high == 0
    assert(small_u256.high == 0, 'small_high');
    
    // Reconstruct using our logic (should just use .low)
    let small_recovered: felt252 = if small_u256.high == 0 {
        small_u256.low.try_into().unwrap()
    } else {
        let q128: u256 = 340282366920938463463374607431768211456; // 2^128
        let high_u256: u256 = small_u256.high.into();
        let low_u256: u256 = small_u256.low.into();
        let reconstructed: u256 = high_u256 * q128 + low_u256;
        reconstructed.try_into().unwrap()
    };
    
    // Verify reconstruction matches original
    assert(small_recovered == small_felt, 'small_recon');
}

#[test]
fn test_u256_to_felt252_conversion_edge_cases() {
    // Test value exactly at 2^128
    let q128_felt: felt252 = 340282366920938463463374607431768211456; // 2^128
    let q128_u256: u256 = q128_felt.into();
    
    // Should have high == 1 and low == 0
    assert(q128_u256.high == 1, 'q128_high');
    assert(q128_u256.low == 0, 'q128_low');
    
    // Reconstruct
    let q128_high_u256: u256 = q128_u256.high.into();
    let q128_low_u256: u256 = q128_u256.low.into();
    let q128_reconstructed: u256 = q128_high_u256 * 340282366920938463463374607431768211456 + q128_low_u256;
    let q128_recovered: felt252 = q128_reconstructed.try_into().unwrap();
    
    // Verify reconstruction matches original
    assert(q128_recovered == q128_felt, 'q128_recon');
    
    // Test value just below 2^128
    let below_q128_felt: felt252 = 340282366920938463463374607431768211455; // 2^128 - 1
    let below_q128_u256: u256 = below_q128_felt.into();
    
    // Should have high == 0
    assert(below_q128_u256.high == 0, 'below_q128_high');
    
    // Reconstruct (should just use .low)
    let below_q128_recovered: felt252 = below_q128_u256.low.try_into().unwrap();
    
    // Verify reconstruction matches original
    assert(below_q128_recovered == below_q128_felt, 'below_q128_recon');
}

#[test]
fn test_u256_to_felt252_conversion_with_mock_verifier() {
    // Deploy mock verifier
    let mock_verifier_class = declare("MockVerifier").unwrap().contract_class();
    let (mock_verifier_address, _) = mock_verifier_class.deploy(@array![]).unwrap();
    
    // Create test values >= 2^128
    let nullifier_felt: felt252 = 894940142951511083072332372919666219214904477692021021291916532133654151109;
    let root_felt: felt252 = 1445485933812220050582740933073874602742611239214198775761002192043579171491;
    let commitment_felt: felt252 = 636394865011415153173528073558227851187564541861267689293481092409846177785;
    
    // MockVerifier converts felt252 to u256 by doing val.into()
    // This simulates what the real Garaga verifier does
    let proof: Array<felt252> = array![1, 2, 3, 4, 5, 6, 7, 8];
    let public_inputs: Array<felt252> = array![
        nullifier_felt,
        root_felt,
        commitment_felt,
        100000000000000,
        1,
        340282366920938463463374507431768211456,
        0,
        340248338684246369617028269971025034634,
        0
    ];
    
    // Call mock verifier (it returns u256 values)
    let mock_verifier_dispatcher = IMockVerifierDispatcher { contract_address: mock_verifier_address };
    let mut full_proof_with_hints = proof;
    let mut i = 0;
    while i < public_inputs.len() {
        full_proof_with_hints.append(*public_inputs.at(i));
        i += 1;
    }
    
    let result = mock_verifier_dispatcher.verify_groth16_proof_bn254(full_proof_with_hints.span());
    let verified_inputs_span = match result {
        Result::Ok(v) => v,
        Result::Err(_) => {
            panic!("mock_failed");
        },
    };
    
    // Convert Span to Array for easier access
    // Note: MockVerifier returns ALL values (proof + public_inputs), so we need to skip the proof
    // Proof has 8 elements, so public inputs start at index 8
    let mut verified_inputs = ArrayTrait::new();
    let mut i = 0;
    while i < verified_inputs_span.len() {
        verified_inputs.append(*verified_inputs_span.at(i));
        i += 1;
    }
    
    // Extract and reconstruct values (using our conversion logic)
    // Public inputs start after the proof (8 elements)
    let proof_len = 8;
    let q128: u256 = 340282366920938463463374607431768211456; // 2^128
    
    let nullifier_u256 = *verified_inputs.at(proof_len + 0);
    let nullifier_recovered: felt252 = if nullifier_u256.high == 0 {
        nullifier_u256.low.try_into().unwrap()
    } else {
        let high_u256: u256 = nullifier_u256.high.into();
        let low_u256: u256 = nullifier_u256.low.into();
        let reconstructed: u256 = high_u256 * q128 + low_u256;
        reconstructed.try_into().unwrap()
    };
    
    let root_u256 = *verified_inputs.at(proof_len + 1);
    let root_recovered: felt252 = if root_u256.high == 0 {
        root_u256.low.try_into().unwrap()
    } else {
        let high_u256: u256 = root_u256.high.into();
        let low_u256: u256 = root_u256.low.into();
        let reconstructed: u256 = high_u256 * q128 + low_u256;
        reconstructed.try_into().unwrap()
    };
    
    let commitment_u256 = *verified_inputs.at(proof_len + 2);
    let commitment_recovered: felt252 = if commitment_u256.high == 0 {
        commitment_u256.low.try_into().unwrap()
    } else {
        let high_u256: u256 = commitment_u256.high.into();
        let low_u256: u256 = commitment_u256.low.into();
        let reconstructed: u256 = high_u256 * q128 + low_u256;
        reconstructed.try_into().unwrap()
    };
    
    // Verify reconstruction matches original
    assert(nullifier_recovered == nullifier_felt, 'nullifier_mock');
    assert(root_recovered == root_felt, 'root_mock');
    assert(commitment_recovered == commitment_felt, 'commitment_mock');
}

