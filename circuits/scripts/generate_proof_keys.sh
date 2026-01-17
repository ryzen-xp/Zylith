#!/bin/bash
set -e

# Powers of Tau file
# Using Hermez POT15 (pre-generated, trusted setup ceremony)
# POT15 supports up to 2^15 = 32,768 constraints
# Our circuits have ~20,946 constraints, so POT15 is sufficient
# Use prepared POT file for groth16 setup (required for phase2)
PTAU_PREPARED="pot15_prepared.ptau"
PTAU_FINAL="pot15_final.ptau"
PTAU_URL="https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_15.ptau"

# Check if prepared POT exists, if not prepare it
if [ ! -f "$PTAU_PREPARED" ]; then
    # First ensure we have the final POT file
    if [ ! -f "$PTAU_FINAL" ]; then
        echo "Downloading Powers of Tau (POT15)..."
        curl -L -o "$PTAU_FINAL" "$PTAU_URL"
        echo "POT15 downloaded successfully!"
    fi
    
    # Prepare POT for phase2 (required for groth16)
    echo "Preparing POT file for phase2 (this may take a few minutes)..."
    ./node_modules/.bin/snarkjs powersoftau prepare phase2 $PTAU_FINAL $PTAU_PREPARED
    echo "POT prepared successfully!"
else
    echo "Prepared POT file already exists, using it..."
fi

# Use prepared POT file for groth16 setup
PTAU_TO_USE="$PTAU_PREPARED"

# Key Generation for each circuit
CIRCUITS=("membership" "withdraw" "lp" "swap")

for CIRCUIT in "${CIRCUITS[@]}"; do
    echo "Generating keys for $CIRCUIT..."
    
    # Remove old keys if they exist (they're invalid after circuit changes)
    rm -f out/${CIRCUIT}_0000.zkey out/${CIRCUIT}_final.zkey out/${CIRCUIT}_vk.json
    
    # Setup - use prepared POT file
    ./node_modules/.bin/snarkjs groth16 setup out/$CIRCUIT.r1cs $PTAU_TO_USE out/${CIRCUIT}_0000.zkey
    
    # Contribute (dummy randomness)
    ./node_modules/.bin/snarkjs zkey contribute out/${CIRCUIT}_0000.zkey out/${CIRCUIT}_final.zkey --name="Zylith" -e="random entropy $CIRCUIT"
    
    # Export Verification Key
    ./node_modules/.bin/snarkjs zkey export verificationkey out/${CIRCUIT}_final.zkey out/${CIRCUIT}_vk.json
    
    echo "$CIRCUIT keys generated!"
done

echo "All keys generated successfully."
