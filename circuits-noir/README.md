# Noir Zero-Knowledge Circuits for Zylith

This directory contains Noir-based zero-knowledge circuits as an alternative to Circom/Groth16.

## Overview

Noir offers several advantages over Circom:
- **No Trusted Setup**: Uses PLONK/UltraHonk backend (no toxic waste)
- **Better Developer Experience**: Rust-like syntax, strong type system
- **Standard Library**: Rich stdlib for cryptographic operations
- **Compact Proofs**: UltraHonk proofs are efficient
- **Active Development**: Maintained by Aztec team

## Phase 1: Setup and Proof of Concept ✅

Phase 1 has been completed with:
- [x] Noir toolchain installed (Nargo v1.0.0-beta.17)
- [x] Barretenberg backend installed (v3.0.0-nightly)
- [x] Membership circuit implemented
- [x] First proof generated and verified successfully
- [x] Documentation complete

## Directory Structure

```
circuits-noir/
├── membership/          # Membership proof circuit (Phase 1 - Complete)
│   ├── src/
│   │   └── main.nr     # Circuit implementation
│   ├── target/         # Compiled artifacts, proofs, verification keys
│   ├── Nargo.toml      # Package configuration
│   └── Prover.toml     # Input values for proof generation
├── compute_values/     # Helper circuit for computing test values
└── README.md           # This file
```

## Prerequisites

### 1. Install Noir (Nargo)

```bash
# Install noirup (Noir version manager)
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash

# Install Noir
noirup

# Verify installation
nargo --version
```

### 2. Install Barretenberg

```bash
# Install bbup (Barretenberg installer)
curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/refs/heads/next/barretenberg/bbup/install | bash

# Install Barretenberg
bbup

# Verify installation
bb --version
```

## Membership Circuit

The membership circuit proves that a commitment exists in a Merkle tree without revealing the secret or nullifier.

### Circuit Logic

1. **Commitment Verification**: Verifies that the commitment is correctly constructed:
   ```
   commitment = Poseidon(Poseidon(secret, nullifier), amount)
   ```

2. **Merkle Proof Verification**: Verifies the commitment exists in the Merkle tree by:
   - Starting with the commitment as a leaf
   - Hashing up the tree using path elements and indices
   - Comparing the computed root with the expected root

### Inputs

**Public Inputs** (visible to verifier):
- `root`: Merkle tree root (Field)
- `commitment`: The commitment being proven (Field)

**Private Inputs** (hidden from verifier):
- `secret`: Secret value (Field)
- `nullifier`: Nullifier to prevent double-spending (Field)
- `amount`: Amount associated with the commitment (Field)
- `path_elements`: Merkle path siblings [Field; 20]
- `path_indices`: Path direction indicators [Field; 20]

### Hash Function

Uses **Poseidon BN254** for compatibility with:
- Starknet/Cairo (for on-chain verification)
- Circom circuits (for cross-implementation compatibility)
- Privacy Pools pattern (standard in ZK applications)

## Building and Testing

### Compile the Circuit

```bash
cd circuits-noir/membership
nargo compile
```

This generates `target/membership.json` (circuit bytecode).

### Run Unit Tests

```bash
nargo test
```

The test verifies:
- Correct commitment construction
- Valid Merkle proof verification
- Edge case: single leaf tree with all-zero path

### Execute with Prover Inputs

```bash
nargo execute
```

This generates:
- `target/membership.json` (circuit)
- `target/membership.gz` (witness)

## Proof Generation and Verification

### 1. Generate Proof

```bash
cd circuits-noir/membership
bb prove -b ./target/membership.json -w ./target/membership.gz --write_vk -o target
```

This creates:
- `target/proof` - The zero-knowledge proof
- `target/vk` - Verification key
- `target/vk_hash` - Hash of verification key
- `target/public_inputs` - Public inputs for the proof

### 2. Verify Proof

```bash
bb verify -p ./target/proof -k ./target/vk
```

Expected output: `Proof verified successfully`

## Computing Test Values

To generate valid test inputs for `Prover.toml`:

```bash
cd circuits-noir/compute_values
nargo execute
```

This outputs the commitment and root values computed from:
- secret = 12345
- nullifier = 67890
- amount = 1000

The circuit output format is: `(commitment, root)`

## Current Test Values

The `Prover.toml` uses these computed values:

```toml
root = "0x0a4e8209b16e914337bdb4f01b7182fcde7f1e28516247a3ae3182b58d71a322"
commitment = "0x19fe51a1a8d0878644bffd5482afd3c69687bf6b46bb6f265d436c5aadea902f"
secret = "12345"
nullifier = "67890"
amount = "1000"
```

## Dependencies

The circuit uses the official Noir Poseidon library:

```toml
[dependencies]
poseidon = { tag = "v0.2.0", git = "https://github.com/noir-lang/poseidon" }
```

### Why Poseidon BN254?

- **Cairo Compatibility**: Matches the field used in Starknet contracts
- **Circom Compatible**: Same hash function as existing Circom circuits
- **Efficient**: Optimized for zero-knowledge proof systems
- **Standardized**: Part of the Privacy Pools pattern

## Proof System: UltraHonk

Barretenberg uses the **UltraHonk** proving system (PLONK variant):

**Advantages**:
- No trusted setup required
- Transparent and secure
- Universal setup (reusable across circuits)
- Relatively small proof size

**Performance** (membership circuit):
- Proving time: ~21ms
- Proof size: ~2-3 KB
- Verification time: <10ms

## Next Steps (Phase 2+)

- [ ] Implement swap circuit (Phase 2)
- [ ] Implement withdraw circuit (Phase 2)
- [ ] Implement LP mint circuit (Phase 3)
- [ ] Implement LP burn circuit (Phase 3)
- [ ] Research PLONK verification on Starknet (Phase 4)
- [ ] Integrate with Cairo contracts (Phase 4)
- [ ] Performance benchmarking (Phase 5)

## Troubleshooting

### Compilation Errors

**Problem**: `Could not resolve 'poseidon'`
**Solution**: Ensure Poseidon dependency is in `Nargo.toml`:
```toml
poseidon = { tag = "v0.2.0", git = "https://github.com/noir-lang/poseidon" }
```

**Problem**: `Assertion failed` during execution
**Solution**: Verify `Prover.toml` has correct values. Use `compute_values` circuit to generate valid inputs.

### Proof Generation Issues

**Problem**: `bb: command not found`
**Solution**: Install Barretenberg using `bbup` installer

**Problem**: Proof verification fails
**Solution**: Ensure you're using the same proof and vk files. Re-generate both if needed.

## Resources

- [Noir Documentation](https://noir-lang.org/docs)
- [Barretenberg Documentation](https://barretenberg.aztec.network/docs)
- [Poseidon Hash Library](https://github.com/noir-lang/poseidon)
- [Issue #4 - Noir Implementation Plan](https://github.com/your-repo/issues/4)

## Contributing

When adding new circuits:
1. Create a new directory under `circuits-noir/`
2. Add circuit implementation in `src/main.nr`
3. Configure `Nargo.toml` and `Prover.toml`
4. Write unit tests in the circuit file
5. Document inputs, outputs, and usage
6. Update this README with the new circuit

## License

This project uses the same license as the Zylith CLMM implementation.
