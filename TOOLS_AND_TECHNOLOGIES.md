# Tools and Technologies Reference

This document provides a comprehensive overview of the key tools, frameworks, and technologies used in the Zylith Protocol, with important points and references for each.

---

## Table of Contents

1. [Cairo & Starknet](#cairo--starknet)
2. [Garaga - ZK Proof Verification](#garaga---zk-proof-verification)
3. [Circom - Circuit Language](#circom---circuit-language)
4. [Noir - Alternative Circuit Language](#noir---alternative-circuit-language)
5. [Supporting Tools](#supporting-tools)
6. [Development Environment](#development-environment)

---

## Cairo & Starknet

### Overview
Cairo is a programming language for writing provable programs and smart contracts on Starknet, a Layer 2 scaling solution for Ethereum using STARK proofs.

### Key Resources
- **Cairo Book:** https://www.starknet.io/cairo-book/title-page.html
- **Starknet Documentation:** https://docs.starknet.io/
- **Scarb (Package Manager):** https://docs.swmansion.com/scarb/

### Important Concepts

#### 1. Cairo Language Features
**Felt252 (Field Element)**
- Base type in Cairo representing elements in a finite field
- 252-bit integers
- All arithmetic is modulo prime: 2^251 + 17 * 2^192 + 1
- Used for hashes, addresses, and numeric values

**Memory Model**
- Immutable memory by default
- No loops (use recursion)
- References instead of pointers
- Provable execution

**Ownership and Borrowing**
- Similar to Rust's ownership model
- `ref` keyword for mutable references
- `@` for snapshots (immutable borrows)
- Move semantics for value types

#### 2. Smart Contract Development

**Contract Structure**
```cairo
#[starknet::contract]
mod MyContract {
    #[storage]
    struct Storage {
        // State variables
    }

    #[constructor]
    fn constructor(ref self: ContractState) {
        // Initialization
    }

    #[external(v0)]
    impl MyContractImpl of IMyContract<ContractState> {
        // Public functions
    }
}
```

**Key Patterns**
- Use `#[starknet::interface]` for trait definitions
- Implement interfaces with `#[abi(embed_v0)]`
- Events with `#[event]` and `#[derive(Drop, starknet::Event)]`
- Storage access via `self.storage_var.read()` and `.write()`

#### 3. Fixed-Point Arithmetic

**Q Notation**
- Q96: 96 fractional bits (2^96 scale factor)
- Q128: 128 fractional bits (2^128 scale factor)
- Used for prices and fee growth in CLMM

**Overflow Protection**
- Use `u256` for intermediate calculations
- Check bounds before conversions
- Use checked arithmetic for critical operations

#### 4. Testing with Starknet Foundry

**Commands**
```bash
scarb build           # Compile contracts
scarb test            # Run all tests
snforge test          # Alternative test runner
snforge test <name>   # Run specific test
```

**Test Structure**
```cairo
#[cfg(test)]
mod tests {
    use super::MyContract;

    #[test]
    fn test_function() {
        // Test implementation
    }

    #[test]
    #[should_panic]
    fn test_failure() {
        // Expected to panic
    }
}
```

### Important for Zylith

**Version Used:** Cairo 2024_07 edition, Starknet 2.11.4
- Fixed-point arithmetic for CLMM price calculations
- Storage optimization for sparse tick data
- Event emission for ASP synchronization
- Interface compatibility with ERC20 tokens

---

## Garaga - ZK Proof Verification

### Overview
Garaga is a Cairo library for verifying Groth16 zero-knowledge proofs on Starknet. It enables efficient on-chain verification of proofs generated off-chain.

### Key Resources
- **Documentation:** https://garaga.gitbook.io/garaga
- **Installation Guide:** https://garaga.gitbook.io/garaga/installation/cairo-library
- **GitHub:** https://github.com/keep-starknet-strange/garaga

### Important Concepts

#### 1. Groth16 Proof System

**Characteristics**
- Succinct proofs: Constant size (~200 bytes)
- Fast verification: O(1) regardless of circuit complexity
- Requires trusted setup per circuit
- Most widely used ZK-SNARK system

**Proof Structure**
- 3 group elements: (A, B, C)
- Public inputs: array of field elements
- Verification equation: e(A, B) = e(α, β) · e(C, δ) · e(public_inputs, γ)

#### 2. Installation and Setup

**Prerequisites**
```bash
# Python 3.10+
python3 --version

# Install Garaga
pip install garaga

# Verify installation
garaga --version
```

**Add to Cairo Project**
```toml
# Scarb.toml
[dependencies]
garaga = "0.18.2"  # Check for latest version
```

#### 3. Generating Verifier Contracts

**Process**
1. Compile Circom circuit to R1CS
2. Run trusted setup (powers of tau)
3. Generate verification key (VK)
4. Generate Cairo verifier from VK

**Commands**
```bash
# Generate verifier from verification key
garaga gen groth16 verification_key.json --output verifier.cairo

# Options
--curve bn254        # Use BN254 curve (default)
--output <file>      # Output file path
--name <name>        # Contract name
```

**Generated Code Structure**
```cairo
// Generated verifier function
fn verify(
    proof: Array<felt252>,
    public_inputs: Array<felt252>
) -> bool {
    // Pairing check implementation
    // Returns true if proof is valid
}
```

#### 4. Verifier Integration

**In Zylith Contract**
```cairo
use zylith::privacy::verifier::verify;

fn private_swap(...) {
    // Verify ZK proof
    let is_valid = verify(proof, public_inputs);
    assert(is_valid, 'Invalid ZK proof');

    // Proceed with swap
}
```

**Public Inputs Format**
- Must match circuit's public input order
- Field elements (felt252)
- Typically: root, commitment, nullifier, amounts

#### 5. Poseidon Hash for Cairo

**BN254 Compatibility**
```cairo
// Garaga provides Poseidon BN254
use garaga::poseidon::bn254::hash_2;

let hash = hash_2([input1, input2]);
```

**Important Notes**
- Cairo's native Poseidon uses different curve
- Must use Garaga's Poseidon BN254 for Circom compatibility
- Hash parameters must match circuit exactly

#### 6. Gas Optimization

**Verification Costs**
- Groth16 verification: ~1-2M gas
- Depends on number of public inputs
- Consider proof batching for efficiency

**Optimization Strategies**
- Minimize public inputs
- Batch multiple proofs
- Use recursive proofs (advanced)
- Cache verification keys

### Important for Zylith

**Use Cases**
1. **Membership Proofs:** Verify commitment in Merkle tree
2. **Swap Proofs:** Verify private swap correctness
3. **Withdrawal Proofs:** Verify withdrawal authorization
4. **LP Proofs:** Verify liquidity operations

**Critical Requirements**
- Poseidon BN254 must match Circom exactly
- Verification key must be generated from compiled circuit
- Public inputs must be in correct order
- Proof format must match Garaga expectations

---

## Circom - Circuit Language

### Overview
Circom is a domain-specific language for writing arithmetic circuits used in zero-knowledge proofs. Combined with snarkjs, it enables complete ZK proof generation and verification.

### Key Resources
- **Documentation:** https://docs.circom.io
- **GitHub:** https://github.com/iden3/circom
- **circomlib:** https://github.com/iden3/circomlib (standard library)
- **snarkjs:** https://github.com/iden3/snarkjs (proof generation)

### Important Concepts

#### 1. Circuit Basics

**Circuit Structure**
```circom
pragma circom 2.1.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

template MyCircuit(n) {
    // Inputs
    signal input public_input;
    signal input private_input;

    // Outputs
    signal output result;

    // Intermediate signals
    signal intermediate;

    // Constraints
    intermediate <== private_input * private_input;
    result <== intermediate + public_input;
}

component main {public [public_input]} = MyCircuit(10);
```

**Key Elements**
- `signal`: Circuit variables (immutable)
- `<--` or `-->`: Assignment (no constraint)
- `<==` or `==>`: Assignment with constraint
- `===`: Constraint only
- `component`: Subcircuit instantiation

#### 2. Signal Types

**Public vs Private**
```circom
signal input public_value;         // Public input
signal input private_value;        // Private (witness)
signal output result;              // Output (public by default)

// Declare public signals in main component
component main {public [public_value]} = Circuit();
```

**Important Rules**
- All signals are field elements
- Signals are immutable
- Cannot use if-else with signals (use selectors)
- All operations must create constraints

#### 3. Constraint System

**Creating Constraints**
```circom
// Equality constraint
a === b;

// Assignment with constraint (preferred)
c <== a * b;

// Multiple operations
d <== (a + b) * (c - d);
```

**Quadratic Constraints**
- Circom allows: A * B = C
- More complex expressions decompose automatically
- Each constraint increases circuit size

#### 4. Common Components (circomlib)

**Poseidon Hash**
```circom
include "circomlib/circuits/poseidon.circom";

component hasher = Poseidon(2);  // 2 inputs
hasher.inputs[0] <== value1;
hasher.inputs[1] <== value2;
signal output hash <== hasher.out;
```

**Merkle Tree Verification**
```circom
include "circomlib/circuits/merkle-tree-proof.circom";

component merkle = MerkleTreeProof(20);  // 20 levels
merkle.leaf <== commitment;
for (var i = 0; i < 20; i++) {
    merkle.pathElements[i] <== path[i];
    merkle.pathIndices[i] <== indices[i];
}
merkle.root === expected_root;
```

**Comparators**
```circom
include "circomlib/circuits/comparators.circom";

component lessThan = LessThan(252);
lessThan.in[0] <== a;
lessThan.in[1] <== b;
// lessThan.out = 1 if a < b, else 0
```

#### 5. Circuit Compilation

**Installation**
```bash
# Install Circom
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
git clone https://github.com/iden3/circom.git
cd circom
cargo build --release
cargo install --path circom

# Install snarkjs
npm install -g snarkjs
```

**Compilation Process**
```bash
# Compile circuit to R1CS
circom circuit.circom --r1cs --wasm --sym

# Output files:
# - circuit.r1cs   (constraint system)
# - circuit.wasm   (witness generator)
# - circuit.sym    (symbol map)
```

#### 6. Proof Generation (snarkjs)

**Setup Phase**
```bash
# Powers of tau ceremony (one-time per max size)
snarkjs powersoftau new bn128 14 pot14_0000.ptau
snarkjs powersoftau contribute pot14_0000.ptau pot14_0001.ptau

# Circuit-specific setup
snarkjs powersoftau prepare phase2 pot14_0001.ptau pot14_final.ptau
snarkjs groth16 setup circuit.r1cs pot14_final.ptau circuit_0000.zkey

# Contribute to circuit
snarkjs zkey contribute circuit_0000.zkey circuit_final.zkey

# Export verification key
snarkjs zkey export verificationkey circuit_final.zkey verification_key.json
```

**Proof Generation**
```bash
# Create input file (input.json)
{
  "public_input": "123",
  "private_input": "456"
}

# Generate witness
node circuit_js/generate_witness.js circuit_js/circuit.wasm input.json witness.wtns

# Generate proof
snarkjs groth16 prove circuit_final.zkey witness.wtns proof.json public.json

# Verify proof (off-chain)
snarkjs groth16 verify verification_key.json public.json proof.json
```

#### 7. Best Practices

**Circuit Design**
- Minimize constraints (each costs gas)
- Reuse components from circomlib
- Test thoroughly with various inputs
- Document public input order

**Constraint Optimization**
- Avoid unnecessary multiplications
- Use lookup tables for complex operations
- Batch similar computations
- Profile constraint count

**Security Considerations**
- Validate all range constraints
- Check for underflows in subtraction
- Ensure division safety
- Test edge cases (zero, max values)

### Important for Zylith

**Circuit Requirements**
1. **Membership Circuit:** 20-level Merkle tree
2. **Swap Circuit:** CLMM math + membership
3. **Withdraw Circuit:** Nullifier verification
4. **LP Circuits:** Position management

**Critical Details**
- Use Poseidon BN254 (matches Garaga)
- Tree depth: 20 (configurable)
- Q96 fixed-point for prices
- Test vectors from Cairo implementation

---

## Noir - Alternative Circuit Language

### Overview
Noir is a domain-specific language for writing zero-knowledge circuits with a focus on developer experience. It uses PLONK backend, eliminating the need for trusted setup.

### Key Resources
- **Documentation:** https://noir-lang.org/docs/
- **GitHub:** https://github.com/noir-lang/noir
- **Awesome Noir:** https://github.com/noir-lang/awesome-noir

### Important Concepts

#### 1. Language Features

**Rust-like Syntax**
```noir
fn main(
    public_input: Field,
    private_input: Field
) -> pub Field {
    let intermediate = private_input * private_input;
    let result = intermediate + public_input;

    assert(result > 0);

    result
}
```

**Key Features**
- Strong type system
- Explicit public/private
- Compile-time checks
- Standard library
- No trusted setup (PLONK)

#### 2. Type System

**Primitive Types**
```noir
Field           // Field element (default)
u8, u16, u32    // Unsigned integers
i8, i16, i32    // Signed integers
bool            // Boolean
[Field; N]      // Fixed-size array
```

**Public vs Private**
```noir
fn main(
    public_value: pub Field,    // Public input
    private_value: Field        // Private witness
) -> pub Field {                // Public output
    // ...
}
```

#### 3. Standard Library

**Hashing**
```noir
use std::hash::poseidon;

fn hash_values(a: Field, b: Field) -> Field {
    poseidon::bn254::hash_2([a, b])
}
```

**Merkle Trees**
```noir
use std::merkle::compute_merkle_root;

fn verify_membership(
    leaf: Field,
    path: [Field; 20],
    indices: [u1; 20],
    root: Field
) {
    let computed_root = compute_merkle_root(leaf, path, indices);
    assert(computed_root == root);
}
```

**Cryptographic Primitives**
```noir
use std::ecdsa::secp256k1;
use std::schnorr;
use std::eddsa;
```

#### 4. Control Flow

**Conditionals**
```noir
fn conditional_logic(condition: bool, a: Field, b: Field) -> Field {
    if condition {
        a
    } else {
        b
    }
}
```

**Loops**
```noir
fn sum_array(arr: [Field; 10]) -> Field {
    let mut sum = 0;
    for i in 0..10 {
        sum += arr[i];
    }
    sum
}
```

#### 5. Installation and Setup

**Install Noir**
```bash
# Install noirup (Noir version manager)
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash

# Install Noir
noirup

# Verify installation
nargo --version
```

**Create Project**
```bash
# Create new Noir project
nargo new my_circuit
cd my_circuit

# Project structure:
# ├── src/
# │   └── main.nr
# ├── Nargo.toml
# └── Prover.toml
```

#### 6. Build and Prove

**Compilation**
```bash
# Compile circuit
nargo compile

# Check constraints
nargo info

# Run tests
nargo test
```

**Proof Generation**
```bash
# Create Prover.toml with inputs
public_input = "123"
private_input = "456"

# Generate proof
nargo prove

# Verify proof
nargo verify

# Output: proof.json
```

#### 7. Circuit Testing

**Unit Tests**
```noir
#[test]
fn test_circuit() {
    let result = main(10, 5);
    assert(result == 35);
}

#[test]
fn test_constraint() {
    // Test with edge cases
    let result = main(0, 0);
    assert(result == 0);
}
```

**Test Execution**
```bash
# Run all tests
nargo test

# Run specific test
nargo test test_circuit

# Verbose output
nargo test --show-output
```

#### 8. Integration with Starknet

**Verifier Generation**
```bash
# Generate verification key
nargo codegen-verifier

# May need adapter for Starknet
# Research: Noir -> Cairo verifier path
```

**Considerations**
- PLONK verification more expensive than Groth16
- But no trusted setup
- Investigate Garaga PLONK support
- May need custom Cairo verifier

### Advantages Over Circom

**Developer Experience**
- Intuitive Rust-like syntax
- Type safety catches errors early
- Better error messages
- Standard library
- Easier debugging

**Security**
- No trusted setup required
- PLONK backend
- Less ceremony management
- Simpler multi-party computation

**Proof System**
- UltraPlonk (more efficient than standard PLONK)
- Custom gates
- Lookup arguments
- Smaller proof size for some circuits

### Disadvantages

**Maturity**
- Less mature than Circom
- Smaller ecosystem
- Fewer examples
- Less tooling

**Integration**
- Garaga primarily for Groth16
- May need custom verifier
- Less documented for Starknet

### Important for Zylith

**Evaluation Criteria**
1. **Gas Cost:** Compare PLONK vs Groth16 verification
2. **Developer Experience:** Faster development with Noir?
3. **Verification Path:** Can we verify on Starknet efficiently?
4. **Proof Generation:** Performance comparison

**Implementation Strategy**
- Parallel implementation to Circom
- Compare both approaches
- Choose based on metrics
- May use Noir for production if superior

---

## Supporting Tools

### Scarb - Cairo Package Manager

**Documentation:** https://docs.swmansion.com/scarb/

**Key Commands**
```bash
scarb new <name>      # Create new project
scarb build           # Compile project
scarb test            # Run tests
scarb add <package>   # Add dependency
scarb clean           # Clean build artifacts
```

**Configuration (Scarb.toml)**
```toml
[package]
name = "zylith"
version = "0.1.0"
edition = "2024_07"

[dependencies]
starknet = "2.11.4"
alexandria_math = "0.2.0"

[dev-dependencies]
snforge_std = "0.50.0"
```

### Starknet Foundry

**Documentation:** https://foundry-rs.github.io/starknet-foundry/

**Key Commands**
```bash
snforge test                    # Run all tests
snforge test <name>             # Run specific test
snforge test --max-n-steps 1M   # Increase step limit
```

**Configuration**
```toml
[tool.snforge]
max_n_steps = 10000000  # For complex operations
```

### snarkjs

**Documentation:** https://github.com/iden3/snarkjs

**Key Operations**
```bash
# Setup
snarkjs powersoftau new bn128 <power> <output>
snarkjs groth16 setup <r1cs> <ptau> <zkey>

# Proof generation
snarkjs groth16 prove <zkey> <witness> <proof> <public>

# Verification
snarkjs groth16 verify <vkey> <public> <proof>

# Export verifier
snarkjs zkey export verificationkey <zkey> <vkey.json>
```

---

## Development Environment

### Recommended Setup

**IDE and Extensions**
- **VSCode** with Cairo extension
- **IntelliJ** with Cairo plugin
- Syntax highlighting for Circom
- Rust tooling for Noir

**Version Control**
```bash
# Git hooks for testing
.git/hooks/pre-commit:
#!/bin/bash
cd zylith && scarb test
```

**Environment Variables**
```bash
# .env file
STARKNET_RPC_URL=https://starknet-mainnet.infura.io/v3/YOUR-KEY
STARKNET_NETWORK=mainnet
```

### Testing Strategy

**Unit Tests**
- Cairo: `#[test]` functions
- Circom: Test with various inputs
- Noir: `#[test]` attribute

**Integration Tests**
- Full flow: deposit → swap → withdraw
- Cross-component interactions
- Gas profiling

**Security Tests**
- Fuzzing inputs
- Edge case testing
- Invariant checking

### Continuous Integration

**GitHub Actions**
```yaml
name: Tests
on: [push, pull_request]
jobs:
  cairo-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Scarb
        run: curl -L https://docs.swmansion.com/scarb/install.sh | bash
      - name: Run tests
        run: cd zylith && scarb test
```

---

## Learning Resources

### Recommended Learning Path

**Week 1: Cairo Basics**
1. Read Cairo Book chapters 1-5
2. Complete basic Cairo examples
3. Understand ownership and references
4. Practice with simple contracts

**Week 2: Starknet Smart Contracts**
1. Study contract structure
2. Learn storage patterns
3. Understand interfaces
4. Practice with test contracts

**Week 3: Zero-Knowledge Basics**
1. Understand ZK proof concepts
2. Learn Groth16 basics
3. Study arithmetic circuits
4. Explore Poseidon hashing

**Week 4: Circuit Development**
1. Learn Circom syntax
2. Study circomlib components
3. Practice simple circuits
4. Understand constraints

**Week 5: Integration**
1. Garaga verifier integration
2. End-to-end proof flow
3. Optimization techniques
4. Security considerations

### Community Resources

**Cairo & Starknet**
- Starknet Discord
- Cairo Telegram
- Starknet Twitter
- Community Forum

**Zero-Knowledge**
- ZK Podcast
- ZKProof community
- PSE Discord
- Research papers

**Circuit Development**
- Circom Discord
- Noir Discord
- Awesome ZK lists
- Tutorial repositories

---

## Troubleshooting

### Common Issues

**Cairo Compilation Errors**
```
Error: Type mismatch
Solution: Check felt252 vs u128 conversions
```

**Garaga Integration**
```
Error: Verification key format
Solution: Ensure VK exported with correct curve (bn254)
```

**Circuit Constraint Errors**
```
Error: Under-constrained
Solution: Add missing constraints, use <== not <--
```

**Proof Generation Failures**
```
Error: Witness generation failed
Solution: Check input format matches circuit
```

### Debug Tools

**Cairo**
```bash
# Print debug info
scarb build --verbose

# Check contract interface
scarb cairo-run --available-gas 100000000
```

**Circom**
```bash
# Debug circuit
circom circuit.circom --O0 --verbose

# Inspect constraints
snarkjs r1cs print circuit.r1cs
```

**Noir**
```bash
# Debug mode
nargo execute --show-output

# Constraint info
nargo info --show-ssa
```

---

## Version Compatibility Matrix

| Tool | Version Used | Compatibility |
|------|-------------|---------------|
| Cairo | 2024_07 | Starknet 2.11.4 |
| Scarb | Latest | Cairo 2024_07 |
| Starknet Foundry | 0.50.0 | Cairo 2024_07 |
| Garaga | 0.18.2+ | Cairo 2.x |
| Circom | 2.1.0+ | snarkjs 0.7+ |
| snarkjs | 0.7.0+ | Circom 2.x |
| Noir | Latest | Nargo 0.x |

---

## Quick Reference Commands

```bash
# Cairo Development
scarb build                    # Compile
scarb test                     # Test
snforge test                   # Alternative test

# Circuit Development (Circom)
circom circuit.circom --r1cs   # Compile
snarkjs groth16 prove ...      # Generate proof

# Circuit Development (Noir)
nargo compile                  # Compile
nargo prove                    # Generate proof
nargo verify                   # Verify proof

# Garaga
garaga gen groth16 vk.json     # Generate verifier

# Git
git status                     # Check status
git add .                      # Stage changes
git commit -m "message"        # Commit
git push                       # Push changes
```

---

## Additional Resources

**Official Documentation**
- Cairo: https://www.starknet.io/cairo-book/
- Garaga: https://garaga.gitbook.io/garaga
- Circom: https://docs.circom.io
- Noir: https://noir-lang.org/docs/

**Community**
- Starknet Ecosystem: https://www.starknet.io/ecosystem
- ZK Learning Resources: https://zkp.science
- Awesome Starknet: https://github.com/gakonst/awesome-starknet
- Awesome ZK: https://github.com/matter-labs/awesome-zero-knowledge-proofs

**Research Papers**
- Groth16: "On the Size of Pairing-Based Non-interactive Arguments"
- PLONK: "PLONK: Permutations over Lagrange-bases for Oecumenical Noninteractive arguments of Knowledge"
- Poseidon: "Poseidon: A New Hash Function for Zero-Knowledge Proof Systems"

---

*Last Updated: December 2024*
*Maintained by: Zylith Protocol Team*
