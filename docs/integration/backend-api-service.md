# Backend API Service: Zylith Integration

This document describes how to build a backend API service that bridges the frontend with Zylith's Cairo contracts, Circom circuits, and ASP server.

## Overview

The backend API service handles:
- ZK proof generation (Circom circuits)
- Proof formatting for Garaga verifiers
- Merkle proof caching
- Transaction preparation
- Error handling and retries

## Architecture

```
Frontend → Backend API → ┌─ Starknet RPC → Zylith Contract
                         ├─ ASP Server → Merkle Proofs
                         └─ Circom → ZK Proof Generation
```

## API Endpoints

### POST /api/proof/swap

Generate a swap proof.

**Request**:
```json
{
  "secret": "0x1234...",
  "nullifier": "0xabcd...",
  "amount": "1000000",
  "leaf_index": 5,
  "zero_for_one": true,
  "amount_specified": "1000000",
  "sqrt_price_limit_x128": "79228162514264337593543950336",
  "new_secret": "0x5678...",
  "new_nullifier": "0xef01...",
  "new_amount": "950000"
}
```

**Response**:
```json
{
  "proof": {
    "full_proof_with_hints": ["0x...", "0x...", ...],
    "public_inputs": ["0x...", "0x...", ...]
  },
  "merkle_proof": {
    "leaf": "0x...",
    "path": ["0x...", "0x..."],
    "path_indices": [0, 1, ...],
    "root": "0x..."
  }
}
```

### POST /api/proof/withdraw

Generate a withdrawal proof.

### POST /api/proof/lp-mint

Generate an LP mint proof.

### POST /api/proof/lp-burn

Generate an LP burn proof.

## Implementation Example (Node.js/Express)

```typescript
import express from 'express';
import { ASPClient } from './aspClient';
import { ProofService } from './proofService';
import { StarknetClient } from './starknetClient';

const app = express();
app.use(express.json());

const aspClient = new ASPClient(process.env.ASP_URL);
const proofService = new ProofService(process.env.CIRCUITS_PATH);
const starknetClient = new StarknetClient(process.env.RPC_URL);

// Generate swap proof
app.post('/api/proof/swap', async (req, res) => {
  try {
    const {
      secret,
      nullifier,
      leaf_index,
      zero_for_one,
      amount_specified,
      sqrt_price_limit_x128,
      new_secret,
      new_nullifier,
      new_amount,
    } = req.body;

    // 1. Get Merkle proof from ASP
    const merkleProof = await aspClient.getMerkleProof(leaf_index);

    // 2. Verify root on-chain
    const onChainRoot = await starknetClient.getMerkleRoot();
    if (onChainRoot !== merkleProof.root) {
      return res.status(400).json({ error: 'Root mismatch' });
    }

    // 3. Generate ZK proof
    const zkProof = await proofService.generateSwapProof({
      secret,
      nullifier,
      amount: amount_specified,
      merkle_path: merkleProof.path,
      merkle_path_indices: merkleProof.path_indices,
      root: merkleProof.root,
      zero_for_one,
      amount_specified,
      sqrt_price_limit_x128,
      new_secret,
      new_nullifier,
      new_amount,
    });

    // 4. Format for Garaga
    const formattedProof = formatProofForGaraga(zkProof);

    res.json({
      proof: formattedProof,
      merkle_proof: merkleProof,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3001, () => {
  console.log('Backend API running on port 3001');
});
```

---

## Complete Integration Stack

```
┌──────────────┐
│   Frontend   │ (React/Next.js)
│              │
│  - UI/UX     │
│  - State Mgmt│
└──────┬───────┘
       │ HTTP/REST
       ▼
┌──────────────┐
│ Backend API  │ (Node.js/Express)
│              │
│  - Proof Gen │
│  - Caching   │
│  - Validation│
└──┬───────┬───┘
   │       │
   │       ├──► ASP Server ──► Merkle Proofs
   │       │
   │       └──► Circom ───────► ZK Proofs
   │
   └──► Starknet RPC ──► Zylith Contract
```

---

**See Also**:
- [Frontend Integration Guide](./frontend-integration-guide.md)
- [ASP Server Setup](../../asp/README.md)
- [Circuit Documentation](../../circuits/README.md)

