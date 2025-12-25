#!/bin/bash

# Script para iniciar el ASP Server de Zylith

set -e

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Parse arguments
BUILD_MODE="${BUILD_MODE:-release}"  # release or dev
FORCE_REBUILD="${FORCE_REBUILD:-false}"

# Check for --rebuild flag
if [[ "$1" == "--rebuild" ]] || [[ "$1" == "-r" ]]; then
    FORCE_REBUILD="true"
    shift
fi

# Check for --dev flag
if [[ "$1" == "--dev" ]] || [[ "$1" == "-d" ]]; then
    BUILD_MODE="dev"
    shift
fi

echo -e "${BLUE}=== Zylith ASP Server ===${NC}"

# Configurar variables de entorno
export RPC_URL="${RPC_URL:-https://api.cartridge.gg/x/starknet/sepolia}"
export CONTRACT_ADDRESS="${CONTRACT_ADDRESS:-0x04b6a594dc9747caf1bd3d8933621366bbb7fbaefa1522174432611b577ae94d}"
export PORT="${PORT:-3000}"

echo -e "${YELLOW}Configuración:${NC}"
echo "  RPC_URL: $RPC_URL"
echo "  CONTRACT_ADDRESS: $CONTRACT_ADDRESS"
echo "  PORT: $PORT"
echo "  BUILD_MODE: $BUILD_MODE"
echo ""

# Determinar binario y flags de compilación
if [ "$BUILD_MODE" = "dev" ]; then
    BINARY="target/debug/zylith-asp"
    BUILD_FLAGS=""
    echo -e "${YELLOW}Modo: Desarrollo${NC}"
else
    BINARY="target/release/zylith-asp"
    BUILD_FLAGS="--release"
    echo -e "${YELLOW}Modo: Producción${NC}"
fi

# Verificar si necesita compilar
NEEDS_BUILD=false

if [ "$FORCE_REBUILD" = "true" ]; then
    echo -e "${YELLOW}Forzando recompilación...${NC}"
    NEEDS_BUILD=true
elif [ ! -f "$BINARY" ]; then
    echo -e "${YELLOW}Binario no encontrado, compilando...${NC}"
    NEEDS_BUILD=true
else
    # Verificar si el código fuente es más reciente que el binario
    SRC_NEWER=$(find src -name "*.rs" -newer "$BINARY" 2>/dev/null | head -1)
    if [ -n "$SRC_NEWER" ]; then
        echo -e "${YELLOW}Código fuente modificado, recompilando...${NC}"
        NEEDS_BUILD=true
    fi
fi

# Compilar si es necesario
if [ "$NEEDS_BUILD" = "true" ]; then
    echo -e "${YELLOW}Compilando...${NC}"
    cargo build $BUILD_FLAGS
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Error: Compilación falló${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Compilación exitosa${NC}"
    echo ""
fi

# Verificar que el binario existe
if [ ! -f "$BINARY" ]; then
    echo -e "${RED}Error: Binario no encontrado en $BINARY${NC}"
    exit 1
fi

echo -e "${GREEN}Iniciando ASP Server...${NC}"
echo -e "${BLUE}El servidor estará disponible en: http://localhost:$PORT${NC}"
echo ""
echo -e "${YELLOW}Endpoints disponibles:${NC}"
echo "  GET  /health                          - Health check"
echo "  GET  /api/pool/root                   - Merkle root on-chain"
echo "  GET  /api/pool/info                   - Pool info"
echo "  GET  /api/nullifier/:nullifier        - Check nullifier"
echo "  GET  /api/token/:address/balance/:owner - Token balance"
echo "  POST /api/deposit/prepare             - Prepare deposit transaction"
echo "  POST /api/swap/prepare                - Prepare swap transaction"
echo "  POST /api/withdraw/prepare            - Prepare withdraw transaction"
echo "  POST /api/liquidity/mint/prepare      - Prepare mint liquidity"
echo "  POST /api/liquidity/burn/prepare      - Prepare burn liquidity"
echo ""

# Ejecutar el servidor
exec "$BINARY"

