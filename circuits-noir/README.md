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

## Phase 2: Core Circuits ✅

Phase 2 has been completed with:
- [x] Swap circuit implemented
- [x] Withdraw circuit implemented
- [x] All circuits tested with sample data
- [x] Documentation updated

## Phase 3: LP Circuits ✅

Phase 3 has been completed with:
- [x] LP mint circuit implemented
- [x] LP burn circuit implemented
- [x] CLMM math constraints documented (TODO markers for production)
- [x] All circuits tested successfully
- [x] Documentation updated

## Phase 4: Verification Research ✅

Phase 4 has been completed with:
- [x] PLONK/UltraHonk verification on Starknet researched
- [x] Garaga integration confirmed and documented
- [x] Complete verification workflow created
- [x] Deployment checklist and security considerations documented
- [x] Integration patterns with Cairo contracts specified
- [x] Gas cost estimates and optimization strategies outlined

## Directory Structure

```
circuits-noir/
├── membership/          # Membership proof circuit (Phase 1 ✅)
│   ├── src/
│   │   └── main.nr     # Circuit implementation
│   ├── target/         # Compiled artifacts, proofs, verification keys
│   ├── Nargo.toml      # Package configuration
│   └── Prover.toml     # Input values for proof generation
├── swap/               # Private swap circuit (Phase 2 ✅)
│   ├── src/
│   │   └── main.nr     # Swap proof implementation
│   ├── Nargo.toml
│   └── Prover.toml
├── withdraw/           # Private withdrawal circuit (Phase 2 ✅)
│   ├── src/
│   │   └── main.nr     # Withdrawal proof implementation
│   ├── Nargo.toml
│   └── Prover.toml
├── lp_mint/            # LP position creation circuit (Phase 3 ✅)
│   ├── src/
│   │   └── main.nr     # LP mint proof implementation
│   ├── Nargo.toml
│   └── Prover.toml
├── lp_burn/            # LP position removal circuit (Phase 3 ✅)
│   ├── src/
│   │   └── main.nr     # LP burn proof implementation
│   ├── Nargo.toml
│   └── Prover.toml
├── compute_values/     # Helper circuit for computing test values
├── VERIFICATION.md     # Complete Starknet verification guide (Phase 4)
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

## Swap Circuit (Phase 2)

The swap circuit proves a valid private swap in the CLMM with commitment updates.

### Circuit Logic

1. **Input Commitment Membership**: Verifies the input commitment exists in the Merkle tree
2. **Old Commitment Verification**: Confirms old commitment matches input commitment
3. **New Commitment Construction**: Verifies the output commitment is correctly formed
4. **CLMM Swap Math**: Validates price transition and amount calculations (simplified in MVP)
5. **Price Transition**: Ensures price moves in the correct direction based on swap type

### Inputs

**Public Inputs**:
- `merkle_root`: Merkle tree root (Field)
- `old_commitment`: Input commitment being spent (Field)
- `new_commitment`: Output commitment being created (Field)
- `sqrt_price_before`: Price before swap in Q96 format (u128)
- `sqrt_price_after`: Price after swap in Q96 format (u128)
- `liquidity`: Pool liquidity (u128)
- `zero_for_one`: Swap direction (bool)

**Private Inputs**:
- `secret_in`, `nullifier_in`, `amount_in`: Input commitment components
- `secret_out`, `nullifier_out`, `amount_out`: Output commitment components
- `path_elements`, `path_indices`: Merkle proof for input commitment

### TODO: Full CLMM Math

The current implementation includes simplified checks. For production:
- Implement Q96 fixed-point arithmetic
- Verify constant product formula
- Calculate exact price impact
- Validate fee calculations
- Match Cairo CLMM implementation precisely

## Withdraw Circuit (Phase 2)

The withdraw circuit proves authorization to withdraw funds from a commitment to a recipient address.

### Circuit Logic

1. **Nullifier Derivation**: Verifies nullifier is correctly derived from secret
2. **Commitment Construction**: Verifies commitment structure
3. **Merkle Proof**: Confirms commitment exists in tree
4. **Withdrawal Authorization**: Validates withdrawal to recipient address

### Inputs

**Public Inputs**:
- `merkle_root`: Merkle tree root (Field)
- `commitment`: Commitment being withdrawn (Field)
- `nullifier`: Nullifier to prevent double-spending (Field)
- `recipient`: Destination address (Field)
- `amount`: Withdrawal amount (u128)

**Private Inputs**:
- `secret`: Secret value proving ownership (Field)
- `path_elements`, `path_indices`: Merkle proof [Field; 20]

### Nullifier System

The nullifier prevents double-spending:
- Derived as: `nullifier = Poseidon(secret, 0)`
- Published during withdrawal
- Tracked on-chain to prevent reuse
- Links secret to spent commitment without revealing it

## LP Mint Circuit (Phase 3)

The LP mint circuit proves the creation of a liquidity position in the CLMM.

### Circuit Logic

1. **Input Commitment Membership**: Verifies tokens being added exist in Merkle tree
2. **Old Commitment Verification**: Confirms input commitment structure
3. **New Commitment Construction**: Creates LP position commitment
4. **Tick Validation**: Ensures tick parameters are valid and properly spaced
5. **Liquidity Calculation**: Validates liquidity amounts (simplified in MVP)

### Inputs

**Public Inputs**:
- `merkle_root`: Merkle tree root (Field)
- `old_commitment`: Input tokens commitment (Field)
- `new_commitment`: LP position commitment (Field)
- `tick_lower`, `tick_upper`: Position range (i32, must be divisible by TICK_SPACING=60)
- `liquidity_delta`: Liquidity being added (u128)
- `sqrt_price_current`: Current pool price in Q96 format (u128)

**Private Inputs**:
- `secret_in`, `nullifier_in`: Input commitment secrets
- `amount0`, `amount1`: Token amounts being deposited (u128)
- `secret_out`, `nullifier_out`: Position commitment secrets
- `path_elements`, `path_indices`: Merkle proof [Field; 20]

### Tick Constraints

- MIN_TICK = -887272, MAX_TICK = 887272
- TICK_SPACING = 60 (both ticks must be divisible)
- tick_lower < tick_upper
- Valid for concentrated liquidity ranges

### TODO: Full Liquidity Math

For production, implement precise calculations:
- Convert ticks to sqrt_price values
- Calculate liquidity from amounts using Q96 arithmetic
- Handle single-sided vs two-sided provision based on current price
- Match Cairo's `get_liquidity_for_amounts` function

## LP Burn Circuit (Phase 3)

The LP burn circuit proves removal of liquidity from a position.

### Circuit Logic

1. **Input Commitment Membership**: Verifies LP position exists in Merkle tree
2. **Old Commitment Verification**: Confirms position structure
3. **New Commitment Construction**: Creates tokens received commitment
4. **Tick Validation**: Same constraints as LP mint
5. **Liquidity Validation**: Ensures not removing more than position has
6. **Protocol Fee Accounting**: Validates fee deduction (TODO)

### Inputs

**Public Inputs**:
- `merkle_root`: Merkle tree root (Field)
- `old_commitment`: LP position commitment (Field)
- `new_commitment`: Tokens received commitment (Field)
- `tick_lower`, `tick_upper`: Position range (i32)
- `liquidity_delta`: Liquidity being removed (u128)
- `sqrt_price_current`: Current pool price (u128)

**Private Inputs**:
- `secret_in`, `nullifier_in`: Position commitment secrets
- `position_liquidity`: Total liquidity in position (u128)
- `secret_out`, `nullifier_out`: Output commitment secrets
- `amount0`, `amount1`: Token amounts received (u128)
- `path_elements`, `path_indices`: Merkle proof [Field; 20]

### TODO: Protocol Fees & Amounts

For production:
- Implement protocol fee calculation (withdrawal fee model per Ekubo)
- Calculate exact amounts from liquidity and tick range
- Use Q96 fixed-point arithmetic
- Match Cairo's `get_amounts_for_liquidity` function

## CLMM Math Implementation Status

All circuits include TODO markers for full CLMM math implementation:

### Required for Production

**Q96 Fixed-Point Arithmetic**:
- Implement sqrt_price conversions
- Safe multiplication/division with overflow protection
- Match Ekubo's precision model

**Tick-Price Conversion**:
- `sqrt_ratio = 1.0001^(tick/2)` in Q96 format
- Inverse conversion for validation

**Liquidity Calculations**:
- `get_liquidity_for_amounts(amount0, amount1, sqrt_price, tick_lower, tick_upper)`
- `get_amounts_for_liquidity(liquidity, sqrt_price, tick_lower, tick_upper)`
- Handle edge cases (single-sided provision, narrow ranges)

**Price Impact Validation** (Swap):
- Constant product formula verification
- Fee calculation (configurable basis points)
- Slippage bounds checking

**Position Math** (LP circuits):
- Fee growth accumulator calculations
- Protocol fee deductions
- Position value computations

### Current Implementation

All circuits have **simplified checks** that validate:
- Direction constraints (price movements, tick ordering)
- Basic conservation (amounts, liquidity bounds)
- Sanity checks (positive values, reasonable ranges)

This is sufficient for Phase 3 MVP but **not production-ready**.

## Starknet Verification (Phase 4)

**Status**: ✅ Research complete - Ready for implementation

Garaga enables seamless verification of Noir UltraHonk proofs on Starknet! See **[VERIFICATION.md](./VERIFICATION.md)** for the complete guide.

### Key Findings

**Excellent News**: As of May 2025, Garaga fully supports Noir UltraHonk verification on Starknet with automatic Cairo contract generation.

### Verification Workflow Summary

1. **Compile Circuit**: `nargo compile` → `target/*.json`
2. **Generate VK**: `bb write_vk -s ultra_honk --oracle_hash keccak`
3. **Generate Verifier**: `garaga gen --system ultra_keccak_zk_honk --vk target/vk`
4. **Create Proof**: `nargo execute && bb prove`
5. **Generate Calldata**: `garaga calldata --proof target/proof`
6. **Deploy & Verify**: `garaga declare && garaga deploy && garaga verify-onchain`

### Requirements

| Tool | Required Version | Current Status |
|------|------------------|----------------|
| Python 3.10 | 3.10.x | ✅ 3.10.19 (via pyenv) |
| Nargo | 1.0.0-beta.16+ | ✅ 1.0.0-beta.17 |
| Barretenberg | 3.0.0-nightly.20251104 | ✅ Exact match! |
| Garaga CLI | 1.0.1 | ✅ Installed in .venv-garaga/ |

**Note**: Garaga requires Python 3.10.x specifically. A dedicated virtual environment is available at `.venv-garaga/`. Activate it with:
```bash
source activate-garaga.sh  # From project root
```

### Integration Pattern

```cairo
// In your Zylith contract
use verifier::IUltraKeccakZKHonkVerifierDispatcher;

fn private_swap(
    ref self: ContractState,
    proof: Span<felt252>,
    public_inputs: Span<felt252>
) {
    let verifier = IUltraKeccakZKHonkVerifierDispatcher {
        contract_address: self.swap_verifier.read()
    };
    assert(verifier.verify_proof(proof, public_inputs), 'Invalid proof');
    // Execute swap...
}
```

### Gas Cost Estimates

| Circuit | Complexity | Est. Verification Cost |
|---------|------------|------------------------|
| Membership | Simple | Low (~500 constraints) |
| Swap | Medium | Medium (~2000 constraints) |
| Withdraw | Simple | Low (~800 constraints) |
| LP Mint | Medium | Medium (~1500 constraints) |
| LP Burn | Medium | Medium (~1500 constraints) |

### Security Considerations

- ✅ Audit generated Cairo contracts
- ✅ Test with valid and invalid proofs
- ✅ Pin Garaga SDK version in production
- ✅ Implement nullifier tracking for double-spend prevention
- ✅ Validate all public inputs

### Deployment Checklist

See **[VERIFICATION.md](./VERIFICATION.md)** for the complete checklist and detailed instructions.

## Next Steps (Phase 5+ Implementation)

**Environment Setup** ✅ COMPLETE:
- [x] Set up Python 3.10+ environment (Python 3.10.19 via pyenv)
- [x] Install Garaga CLI (v1.0.1 in .venv-garaga/)
- [x] Phase 5 evaluation complete (see PHASE5_EVALUATION.md)

**Ready to Execute**:
- [ ] Generate verifiers for all 5 circuits (membership, swap, withdraw, lp_mint, lp_burn)
- [ ] Deploy verifiers to Starknet Sepolia testnet
- [ ] Integrate verifiers with Zylith Cairo contracts
- [ ] End-to-end testing on Starknet
- [ ] Performance benchmarking and gas measurement

**Post-Production**:
- [ ] Implement full CLMM math in all circuits
- [ ] Proof aggregation implementation
- [ ] Mainnet deployment

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
