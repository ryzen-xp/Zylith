#!/bin/bash
set -e

# Powers of Tau file
# Using Hermez POT15 (pre-generated, trusted setup ceremony)
# POT15 supports up to 2^15 = 32,768 constraints
# Our circuits have ~20,946 constraints, so POT15 is sufficient
PTAU_FILE="pot15_final.ptau"
PTAU_URL="https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_15.ptau"

# Download POT file if not exists
if [ ! -f "$PTAU_FILE" ]; then
    echo "Downloading Powers of Tau (POT15)..."
    curl -L -o "$PTAU_FILE" "$PTAU_URL"
    echo "POT15 downloaded successfully!"
else
    echo "POT15 already exists, skipping download..."
fi

# Key Generation for each circuit
CIRCUITS=("membership" "withdraw" "lp" "swap")

for CIRCUIT in "${CIRCUITS[@]}"; do
    echo "Generating keys for $CIRCUIT..."
    
    # Setup
    ./node_modules/.bin/snarkjs groth16 setup out/$CIRCUIT.r1cs $PTAU_FILE out/${CIRCUIT}_0000.zkey
    
    # Contribute (dummy randomness)
    ./node_modules/.bin/snarkjs zkey contribute out/${CIRCUIT}_0000.zkey out/${CIRCUIT}_final.zkey --name="Zylith" -e="random entropy $CIRCUIT"
    
    # Export Verification Key
    ./node_modules/.bin/snarkjs zkey export verificationkey out/${CIRCUIT}_final.zkey out/${CIRCUIT}_vk.json
    
    echo "$CIRCUIT keys generated!"
done

echo "All keys generated successfully."
