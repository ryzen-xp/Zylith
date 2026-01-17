// Test using exact values from frontend logs to verify conversion works
use core::array::ArrayTrait;
use core::integer::u256;
use core::traits::{TryInto, Into};
use snforge_std::{ContractClassTrait, DeclareResultTrait, declare};
use zylith::privacy::mock_verifier::{IMockVerifierDispatcher, IMockVerifierDispatcherTrait};

#[test]
fn test_conversion_with_exact_frontend_values() {
    // Exact values from frontend logs
    let nullifier_felt: felt252 = 894940142951511083072332372919666219214904477692021021291916532133654151109;
    let root_felt: felt252 = 1445485933812220050582740933073874602742611239214198775761002192043579171491;
    let commitment_felt: felt252 = 636394865011415153173528073558227851187564541861267689293481092409846177785;
    
    // Convert to u256 (simulating verifier)
    let nullifier_u256: u256 = nullifier_felt.into();
    let root_u256: u256 = root_felt.into();
    let commitment_u256: u256 = commitment_felt.into();
    
    // Verify they have high != 0
    assert(nullifier_u256.high != 0, 'nullifier_high');
    assert(root_u256.high != 0, 'root_high');
    assert(commitment_u256.high != 0, 'commitment_high');
    
    // Reconstruct using our logic
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
fn test_swap_with_exact_frontend_proof() {
    // Deploy mock verifier
    let mock_verifier_class = declare("MockVerifier").unwrap().contract_class();
    let (mock_verifier_address, _) = mock_verifier_class.deploy(@array![]).unwrap();
    
    // Exact proof and public inputs from frontend logs
    let proof: Array<felt252> = array![
        1430159704942985777216622577551178868440597003130765797738551356118883074705,
        81742047586323999318931207511366371181970869972035932129998506342288490503,
        993745449409164736630697804106985933368031751058911590282129654307075942986,
        155206830546838247448779871632832518837969315319125905277646299838707738474,
        2236133210132487615800620048452480011797669486105914803083736100796449032623,
        36278736386655749647897485970462688885510084702447115493493179674094019310,
        2860594001776430190229239897219641026914330771715304653326364121982436981027,
        1037208766545784302787426271092775884414930713801101343977321444460621510241
    ];
    
    // Exact public inputs from frontend
    let public_inputs: Array<felt252> = array![
        894940142951511083072332372919666219214904477692021021291916532133654151109,  // nullifier
        1445485933812220050582740933073874602742611239214198775761002192043579171491, // root
        636394865011415153173528073558227851187564541861267689293481092409846177785,  // new_commitment
        100000000000000,                                                              // amount_specified
        1,                                                                            // zero_for_one
        340282366920938463463374507431768211456,                                      // amount0_delta
        0,                                                                            // amount1_delta
        340248338684246369617028269971025034634,                                      // new_sqrt_price_x128
        0                                                                             // new_tick
    ];
    
    // Call mock verifier
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
    
    // Convert Span to Array
    let mut verified_inputs = ArrayTrait::new();
    let mut i = 0;
    while i < verified_inputs_span.len() {
        verified_inputs.append(*verified_inputs_span.at(i));
        i += 1;
    }
    
    // Extract and reconstruct using our conversion logic
    let q128: u256 = 340282366920938463463374607431768211456; // 2^128
    let proof_len = 8;
    
    // Reconstruct nullifier (index 8 after proof)
    let nullifier_u256 = *verified_inputs.at(proof_len + 0);
    let nullifier_recovered: felt252 = if nullifier_u256.high == 0 {
        nullifier_u256.low.try_into().unwrap()
    } else {
        let high_u256: u256 = nullifier_u256.high.into();
        let low_u256: u256 = nullifier_u256.low.into();
        let reconstructed: u256 = high_u256 * q128 + low_u256;
        reconstructed.try_into().unwrap()
    };
    
    // Reconstruct root (index 9)
    let root_u256 = *verified_inputs.at(proof_len + 1);
    let root_recovered: felt252 = if root_u256.high == 0 {
        root_u256.low.try_into().unwrap()
    } else {
        let high_u256: u256 = root_u256.high.into();
        let low_u256: u256 = root_u256.low.into();
        let reconstructed: u256 = high_u256 * q128 + low_u256;
        reconstructed.try_into().unwrap()
    };
    
    // Reconstruct commitment (index 10)
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
    assert(nullifier_recovered == *public_inputs.at(0), 'nullifier_mock');
    assert(root_recovered == *public_inputs.at(1), 'root_mock');
    assert(commitment_recovered == *public_inputs.at(2), 'commitment_mock');
}

