#!/bin/bash
# Script to compute test values for Prover.toml

echo "Computing test values for membership circuit..."
echo ""
echo "Using:"
echo "  secret = 12345"
echo "  nullifier = 67890"
echo "  amount = 1000"
echo ""
echo "The commitment and root need to be computed using Poseidon BN254 hash."
echo "Run the Noir test to verify the circuit logic works correctly."
echo ""
echo "To generate a proof, you need to:"
echo "1. Compute commitment = Poseidon(Poseidon(secret, nullifier), amount)"
echo "2. Compute root by hashing commitment with 0 twenty times"
echo "3. Update Prover.toml with these hex values"
echo "4. Run: nargo execute && bb prove -b ./target/membership.json -w ./target/membership.gz -o ./target/proof"
