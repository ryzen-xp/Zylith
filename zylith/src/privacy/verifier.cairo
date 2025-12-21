// Interface of ZK Verifier !

// #[starknet::interface]
// pub trait IZKVerifier<TContractState> {
//     fn verify_membership_proof(
//         ref self: TContractState, full_proof_with_hints: Span<felt252>,
//     ) -> bool;

//     fn verify_swap_proof(ref self: TContractState, full_proof_with_hints: Span<felt252>) -> bool;

//     fn verify_withdraw_proof(
//         ref self: TContractState, full_proof_with_hints: Span<felt252>,
//     ) -> bool;
// }

// #[starknet::contract]
// pub mod ZKVerifier {
//     use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
//     use starknet::{ContractAddress, get_caller_address};
//     use crate::privacy::verifiers::membership::groth16_verifier::{
//         IMembershipGroth16VerifierBN254Dispatcher,
//         IMembershipGroth16VerifierBN254DispatcherTrait,
//     };
//     use crate::privacy::verifiers::swap::groth16_verifier::{
//         ISwapGroth16VerifierBN254Dispatcher as ISwapVerifier,
//         ISwapGroth16VerifierBN254DispatcherTrait as ISwapVerifierTrait,
//     };
//     use crate::privacy::verifiers::withdraw::groth16_verifier::{
//         IWithdrawGroth16VerifierBN254Dispatcher as IWithdrawVerifier,
//         IWithdrawGroth16VerifierBN254DispatcherTrait as IWithdrawVerifierTrait,
//     };

//     #[storage]
//     struct Storage {
//         membership_verifier: ContractAddress,
//         swap_verifier: ContractAddress,
//         withdraw_verifier: ContractAddress,
//     }

//     #[event]
//     #[derive(Drop, starknet::Event)]
//     pub enum Event {
//         ProofVerified: ProofVerified,
//         ProofRejected: ProofRejected,
//         VerifierUpdated: VerifierUpdated,
//     }

//     #[derive(Drop, starknet::Event)]
//     pub struct ProofVerified {
//         pub proof_type: felt252,
//         pub caller: ContractAddress,
//         pub timestamp: u64,
//     }

//     #[derive(Drop, starknet::Event)]
//     pub struct ProofRejected {
//         pub proof_type: felt252,
//         pub caller: ContractAddress,
//         pub error: felt252,
//     }

//     #[derive(Drop, starknet::Event)]
//     pub struct VerifierUpdated {
//         pub proof_type: felt252,
//         pub new_address: ContractAddress,
//     }

//     #[constructor]
//     fn constructor(
//         ref self: ContractState,
//         membership_verifier: ContractAddress,
//         swap_verifier: ContractAddress,
//         withdraw_verifier: ContractAddress,
//     ) {
//         self.membership_verifier.write(membership_verifier);
//         self.swap_verifier.write(swap_verifier);
//         self.withdraw_verifier.write(withdraw_verifier);
//     }

//     #[abi(embed_v0)]
//     impl ZKVerifierImpl of super::IZKVerifier<ContractState> {
//         fn verify_membership_proof(
//             ref self: ContractState, full_proof_with_hints: Span<felt252>,
//         ) -> bool {
//             let verifier_address = self.membership_verifier.read();
//             let verifier = IMembershipGroth16VerifierBN254Dispatcher { contract_address:
//             verifier_address };

//             // calling verifier
//             let result = verifier.verify_groth16_proof_bn254(full_proof_with_hints);

//             match result {
//                 Result::Ok(_public_inputs) => {
//                     // if proof is valid !!

//                     self
//                         .emit(
//                             ProofVerified {
//                                 proof_type: 'membership',
//                                 caller: get_caller_address(),
//                                 timestamp: starknet::get_block_timestamp(),
//                             },
//                         );

//                     true
//                 },
//                 Result::Err(error) => {
//                     // if Proof is invalid !
//                     self
//                         .emit(
//                             ProofRejected {
//                                 proof_type: 'membership',
//                                 caller: get_caller_address(),
//                                 error: error,
//                             },
//                         );

//                     false
//                 },
//             }
//         }

//         fn verify_swap_proof(
//             ref self: ContractState, full_proof_with_hints: Span<felt252>,
//         ) -> bool {
//             let verifier_address = self.swap_verifier.read();
//             let verifier = ISwapVerifier { contract_address: verifier_address };

//             let result = verifier.verify_groth16_proof_bn254(full_proof_with_hints);

//             match result {
//                 Result::Ok(_public_inputs) => {
//                     self
//                         .emit(
//                             ProofVerified {
//                                 proof_type: 'swap',
//                                 caller: get_caller_address(),
//                                 timestamp: starknet::get_block_timestamp(),
//                             },
//                         );

//                     true
//                 },
//                 Result::Err(error) => {
//                     self
//                         .emit(
//                             ProofRejected {
//                                 proof_type: 'swap', caller: get_caller_address(), error: error,
//                             },
//                         );

//                     false
//                 },
//             }
//         }

//         fn verify_withdraw_proof(
//             ref self: ContractState, full_proof_with_hints: Span<felt252>,
//         ) -> bool {
//             let verifier_address = self.withdraw_verifier.read();
//             let verifier = IWithdrawVerifier { contract_address: verifier_address };

//             let result = verifier.verify_groth16_proof_bn254(full_proof_with_hints);

//             match result {
//                 Result::Ok(_public_inputs) => {
//                     self
//                         .emit(
//                             ProofVerified {
//                                 proof_type: 'withdraw',
//                                 caller: get_caller_address(),
//                                 timestamp: starknet::get_block_timestamp(),
//                             },
//                         );

//                     true
//                 },
//                 Result::Err(error) => {
//                     self
//                         .emit(
//                             ProofRejected {
//                                 proof_type: 'withdraw', caller: get_caller_address(), error:
//                                 error,
//                             },
//                         );

//                     false
//                 },
//             }
//         }
//     }
// }
