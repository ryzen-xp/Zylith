#!/bin/bash
set -e

# This script assumes pot16_prepared.ptau exists

CIRCUITS=("membership" "withdraw" "lp" "swap")

for CIRCUIT in "${CIRCUITS[@]}"; do
    echo "Generating keys for $CIRCUIT..."
    
    # Setup
    ./node_modules/.bin/snarkjs groth16 setup out/$CIRCUIT.r1cs pot15_prepared.ptau out/${CIRCUIT}_0000.zkey
    
    # Contribute (dummy randomness)
    ./node_modules/.bin/snarkjs zkey contribute out/${CIRCUIT}_0000.zkey out/${CIRCUIT}_final.zkey --name="Relayer" -v -e="random entropy"
    
    # Export Verification Key
    ./node_modules/.bin/snarkjs zkey export verificationkey out/${CIRCUIT}_final.zkey out/${CIRCUIT}_vk.json
    
    echo "Generating Cairo Verifier for $CIRCUIT..."
    source venv/bin/activate
    export PATH="$(pwd)/mock_bin:$PATH"
    # Garaga generation
    # Output path structure: zylith/src/privacy/verifiers/<circuit>/groth16_verifier.cairo
    # We might need to move them manually if garaga doesn't support custom output paths perfectly or if we want specific naming
    
    garaga gen --system groth16 --vk out/${CIRCUIT}_vk.json --project-name $CIRCUIT
    
    # Move generated files to correct location in zylith project
    mkdir -p ../zylith/src/privacy/verifiers/$CIRCUIT
    # Garaga generates a project structure. We need to extract the relevant contract.
    # Usually: <project_name>/src/groth16_verifier.cairo
    cp $CIRCUIT/src/groth16_verifier.cairo ../zylith/src/privacy/verifiers/$CIRCUIT/groth16_verifier.cairo
    cp $CIRCUIT/src/groth16_verifier_constants.cairo ../zylith/src/privacy/verifiers/$CIRCUIT/groth16_verifier_constants.cairo
    
    # Cleanup generated project
    rm -rf $CIRCUIT
    
    echo "$CIRCUIT done!"
done

echo "All verifiers generated and moved."
