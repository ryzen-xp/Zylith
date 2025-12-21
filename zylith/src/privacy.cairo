// Privacy module - declares submodules
pub mod commitment;
pub mod deposit;
pub mod merkle_tree;
pub mod mock_verifier;
// pub mod verifier;

pub mod verifiers {
    pub mod membership {
        pub mod groth16_verifier;
    }

    pub mod swap {
        pub mod groth16_verifier;
    }

    pub mod withdraw {
        pub mod groth16_verifier;
    }

    pub mod lp {
        pub mod groth16_verifier;
    }
}
// pub use verifier::{IZKVerifier, IZKVerifierDispatcher, IZKVerifierDispatcherTrait};

