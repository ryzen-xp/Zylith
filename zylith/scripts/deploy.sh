#!/bin/bash

# Zylith Deployment Script
# Deploys Zylith and all verifier contracts to Starknet
#
# Usage:
#   ./scripts/deploy.sh [profile]
#
# Profiles:
#   devnet  - Local devnet (default)
#   sepolia - Starknet Sepolia testnet
#
# Prerequisites:
#   1. scarb installed and in PATH
#   2. sncast installed and in PATH
#   3. Account configured in snfoundry.toml
#   4. Account funded with ETH for gas

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROFILE="${1:-devnet}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_FILE="$PROJECT_DIR/deployment_${PROFILE}_$(date +%Y%m%d_%H%M%S).json"

echo -e "${BLUE}=== Zylith Deployment ===${NC}"
echo -e "Profile: ${YELLOW}$PROFILE${NC}"
echo -e "Project: $PROJECT_DIR"
echo ""

# Function to log with timestamp
log() {
    echo -e "[$(date +%H:%M:%S)] $1"
}

# Function to extract class hash from declare output (macOS compatible)
extract_class_hash() {
    echo "$1" | sed -n 's/.*class_hash: \(0x[a-fA-F0-9]\+\).*/\1/p' | head -1 || \
    echo "$1" | sed -n 's/.*"class_hash": "\(0x[a-fA-F0-9]\+\)".*/\1/p' | head -1 || \
    echo ""
}

# Function to extract contract address from deploy output (macOS compatible)
extract_address() {
    echo "$1" | sed -n 's/.*contract_address: \(0x[a-fA-F0-9]\+\).*/\1/p' | head -1 || \
    echo "$1" | sed -n 's/.*"contract_address": "\(0x[a-fA-F0-9]\+\)".*/\1/p' | head -1 || \
    echo ""
}

# Step 1: Build contracts
log "${BLUE}Step 1: Building contracts...${NC}"
cd "$PROJECT_DIR"
scarb build
log "${GREEN}✓ Build complete${NC}"

# Step 2: Declare contracts
log "${BLUE}Step 2: Declaring contracts...${NC}"

# Declare MembershipVerifier (Garaga-generated)
log "  Declaring MembershipVerifier..."
MEMBERSHIP_DECLARE=$(sncast --profile "$PROFILE" declare --contract-name "MembershipGroth16VerifierBN254" --package zylith 2>&1 || true)
MEMBERSHIP_HASH=$(extract_class_hash "$MEMBERSHIP_DECLARE")
if [ -z "$MEMBERSHIP_HASH" ]; then
    log "${YELLOW}  MembershipVerifier may already be declared or failed${NC}"
    MEMBERSHIP_HASH="0x0"  # Will need manual input
fi
log "  MembershipVerifier class_hash: $MEMBERSHIP_HASH"

# Declare SwapVerifier (Garaga-generated)
log "  Declaring SwapVerifier..."
SWAP_DECLARE=$(sncast --profile "$PROFILE" declare --contract-name "SwapGroth16VerifierBN254" --package zylith 2>&1 || true)
SWAP_HASH=$(extract_class_hash "$SWAP_DECLARE")
if [ -z "$SWAP_HASH" ]; then
    log "${YELLOW}  SwapVerifier may already be declared or failed${NC}"
    SWAP_HASH="0x0"
fi
log "  SwapVerifier class_hash: $SWAP_HASH"

# Declare WithdrawVerifier (Garaga-generated)
log "  Declaring WithdrawVerifier..."
WITHDRAW_DECLARE=$(sncast --profile "$PROFILE" declare --contract-name "WithdrawGroth16VerifierBN254" --package zylith 2>&1 || true)
WITHDRAW_HASH=$(extract_class_hash "$WITHDRAW_DECLARE")
if [ -z "$WITHDRAW_HASH" ]; then
    log "${YELLOW}  WithdrawVerifier may already be declared or failed${NC}"
    WITHDRAW_HASH="0x0"
fi
log "  WithdrawVerifier class_hash: $WITHDRAW_HASH"

# Declare LPVerifier (Garaga-generated)
log "  Declaring LPVerifier..."
LP_DECLARE=$(sncast --profile "$PROFILE" declare --contract-name "LPGroth16VerifierBN254" --package zylith 2>&1 || true)
LP_HASH=$(extract_class_hash "$LP_DECLARE")
if [ -z "$LP_HASH" ]; then
    log "${YELLOW}  LPVerifier may already be declared or failed${NC}"
    LP_HASH="0x0"
fi
log "  LPVerifier class_hash: $LP_HASH"

# Declare Zylith main contract
log "  Declaring Zylith..."
ZYLITH_DECLARE=$(sncast --profile "$PROFILE" declare --contract-name "Zylith" 2>&1 || true)
ZYLITH_HASH=$(extract_class_hash "$ZYLITH_DECLARE")
if [ -z "$ZYLITH_HASH" ]; then
    log "${YELLOW}  Zylith may already be declared or failed${NC}"
    ZYLITH_HASH="0x0"
fi
log "  Zylith class_hash: $ZYLITH_HASH"

log "${GREEN}✓ Declarations complete${NC}"

# Step 3: Deploy verifiers
log "${BLUE}Step 3: Deploying verifier contracts...${NC}"

# Deploy MembershipVerifier
log "  Deploying MembershipVerifier..."
MEMBERSHIP_DEPLOY=$(sncast --profile "$PROFILE" deploy --class-hash "$MEMBERSHIP_HASH" 2>&1 || true)
MEMBERSHIP_ADDR=$(extract_address "$MEMBERSHIP_DEPLOY")
log "  MembershipVerifier address: $MEMBERSHIP_ADDR"

# Deploy SwapVerifier
log "  Deploying SwapVerifier..."
SWAP_DEPLOY=$(sncast --profile "$PROFILE" deploy --class-hash "$SWAP_HASH" 2>&1 || true)
SWAP_ADDR=$(extract_address "$SWAP_DEPLOY")
log "  SwapVerifier address: $SWAP_ADDR"

# Deploy WithdrawVerifier
log "  Deploying WithdrawVerifier..."
WITHDRAW_DEPLOY=$(sncast --profile "$PROFILE" deploy --class-hash "$WITHDRAW_HASH" 2>&1 || true)
WITHDRAW_ADDR=$(extract_address "$WITHDRAW_DEPLOY")
log "  WithdrawVerifier address: $WITHDRAW_ADDR"

# Deploy LPVerifier
log "  Deploying LPVerifier..."
LP_DEPLOY=$(sncast --profile "$PROFILE" deploy --class-hash "$LP_HASH" 2>&1 || true)
LP_ADDR=$(extract_address "$LP_DEPLOY")
log "  LPVerifier address: $LP_ADDR"

log "${GREEN}✓ Verifiers deployed${NC}"

# Step 4: Deploy Zylith
log "${BLUE}Step 4: Deploying Zylith main contract...${NC}"

# Get owner address from account config
if [ "$PROFILE" = "devnet" ]; then
    OWNER_ADDR="0x127fd5f1fe78a71f8bcd1fec63e3fe2f0486b6ecd5c86a0466c3a21fa5cfcec"
elif [ "$PROFILE" = "sepolia" ]; then
    OWNER_ADDR="0x066EE9d5F6791270d7cD1314ddB9fc8f7EdCb59E2847e2b13D57A06e7c988D63"
else
    OWNER_ADDR="0x0"
fi

# Construct constructor calldata
# Constructor: (owner, membership_verifier, swap_verifier, withdraw_verifier, lp_verifier)
CONSTRUCTOR_ARGS="$OWNER_ADDR $MEMBERSHIP_ADDR $SWAP_ADDR $WITHDRAW_ADDR $LP_ADDR"

log "  Deploying Zylith with constructor args..."
log "    Owner: $OWNER_ADDR"
log "    MembershipVerifier: $MEMBERSHIP_ADDR"
log "    SwapVerifier: $SWAP_ADDR"
log "    WithdrawVerifier: $WITHDRAW_ADDR"
log "    LPVerifier: $LP_ADDR"

ZYLITH_DEPLOY=$(sncast --profile "$PROFILE" deploy --class-hash "$ZYLITH_HASH" --constructor-calldata "$CONSTRUCTOR_ARGS" 2>&1 || true)
ZYLITH_ADDR=$(extract_address "$ZYLITH_DEPLOY")
log "  Zylith address: $ZYLITH_ADDR"

log "${GREEN}✓ Zylith deployed${NC}"

# Step 5: Save deployment info
log "${BLUE}Step 5: Saving deployment info...${NC}"

cat > "$OUTPUT_FILE" << EOF
{
    "profile": "$PROFILE",
    "timestamp": "$(date -Iseconds)",
    "contracts": {
        "zylith": {
            "class_hash": "$ZYLITH_HASH",
            "address": "$ZYLITH_ADDR"
        },
        "membership_verifier": {
            "class_hash": "$MEMBERSHIP_HASH",
            "address": "$MEMBERSHIP_ADDR"
        },
        "swap_verifier": {
            "class_hash": "$SWAP_HASH",
            "address": "$SWAP_ADDR"
        },
        "withdraw_verifier": {
            "class_hash": "$WITHDRAW_HASH",
            "address": "$WITHDRAW_ADDR"
        },
        "lp_verifier": {
            "class_hash": "$LP_HASH",
            "address": "$LP_ADDR"
        }
    }
}
EOF

log "${GREEN}✓ Deployment info saved to: $OUTPUT_FILE${NC}"

# Summary
echo ""
echo -e "${GREEN}=== Deployment Summary ===${NC}"
echo "Profile: $PROFILE"
echo ""
echo "Contract Addresses:"
echo "  Zylith:             $ZYLITH_ADDR"
echo "  MembershipVerifier: $MEMBERSHIP_ADDR"
echo "  SwapVerifier:       $SWAP_ADDR"
echo "  WithdrawVerifier:   $WITHDRAW_ADDR"
echo "  LPVerifier:         $LP_ADDR"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Initialize a pool: zylith.initialize(token0, token1, fee, tick_spacing, sqrt_price)"
echo "2. Test private_deposit with commitment"
echo "3. Connect ASP server to sync events"
echo ""
echo -e "${GREEN}Deployment complete!${NC}"

