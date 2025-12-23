# Frontend Integration Guide: Zylith Private Pool System

This guide explains how to integrate Zylith's private pool system into a frontend application, covering the complete flow from contract interactions to ZK proof generation and submission.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [System Components](#system-components)
3. [Integration Flow](#integration-flow)
4. [API Reference](#api-reference)
5. [Code Examples](#code-examples)
6. [Error Handling](#error-handling)
7. [Best Practices](#best-practices)

---

## Architecture Overview

Zylith's private pool system consists of four main components that work together:

```
┌─────────────┐
│   Frontend  │
│  (React/JS) │
└──────┬──────┘
       │
       ├───► Starknet RPC ────► Zylith Contract (Cairo)
       │
       ├───► ASP Server ──────► Merkle Path Provider (Rust)
       │
       └───► Circom Circuits ──► ZK Proof Generator (Node.js)
```

### Component Responsibilities

- **Frontend**: User interface, proof generation orchestration, transaction submission
- **Zylith Contract**: On-chain state management, proof verification, pool operations
- **ASP Server**: Merkle tree synchronization, path generation for proofs
- **Circom Circuits**: ZK proof generation for private operations

---

## System Components

### 1. Zylith Cairo Contract

**Address (Sepolia)**: `0x04b6a594dc9747caf1bd3d8933621366bbb7fbaefa1522174432611b577ae94d`

**Key Functions**:
- `initialize()` - Initialize a new pool
- `private_deposit()` - Deposit tokens privately
- `private_swap()` - Execute private swap with ZK proof
- `private_withdraw()` - Withdraw tokens privately
- `private_mint_liquidity()` - Add liquidity privately
- `private_burn_liquidity()` - Remove liquidity privately

### 2. ASP Server (Association Set Provider)

**Default Port**: `3000`

**Endpoints**:
- `GET /deposit/proof/:index` - Get Merkle proof for commitment
- `GET /deposit/root` - Get current Merkle root
- `GET /deposit/info` - Get tree information
- `GET /health` - Health check

### 3. Circom Circuits

**Location**: `../circuits/`

**Available Circuits**:
- `membership.circom` - Merkle membership proof
- `swap.circom` - Private swap proof
- `withdraw.circom` - Private withdrawal proof
- `lp.circom` - Private LP operations proof

### 4. Verifier Contracts

All verifiers are deployed on Sepolia:

- **Membership Verifier**: `0x066448de8e457554d16155f215386dc9c8052a5d99212586840494142aedc165`
- **Swap Verifier**: `0x0432a5184b4e187cf68a7c476c653528b7da14f6851de8c8e1ce76b1e1bb9e36`
- **Withdraw Verifier**: `0x037f7a9fed4daa5ec5ff69e5a101ccf40c219f6cb3c0cb081c64d34ac4a26ad0`
- **LP Verifier**: `0x0745acde8db05d4b4a49dc1f2cd313a3a8960e812d41d0b71ff90457f8ebbe7e`

---

## Integration Flow

### Complete User Journey

```
1. User deposits tokens
   ↓
2. Generate commitment (secret, nullifier, amount)
   ↓
3. Call private_deposit() on contract
   ↓
4. Contract emits Deposit event
   ↓
5. ASP syncs event and updates Merkle tree
   ↓
6. User wants to swap/withdraw
   ↓
7. Frontend requests Merkle proof from ASP
   ↓
8. Generate ZK proof using Circom circuit
   ↓
9. Submit proof + transaction to contract
   ↓
10. Contract verifies proof and executes operation
```

---

## API Reference

### ASP Server API

#### Get Merkle Proof

```http
GET /deposit/proof/:index
```

**Response**:
```json
{
  "leaf": "0x1234...",
  "path": ["0xabcd...", "0xef01..."],
  "path_indices": [0, 1, 0, ...],
  "root": "0x5678..."
}
```

#### Get Current Root

```http
GET /deposit/root
```

**Response**:
```json
"0x5678..."
```

#### Get Tree Info

```http
GET /deposit/info
```

**Response**:
```json
{
  "root": "0x5678...",
  "leaf_count": 42,
  "depth": 25
}
```

### Starknet Contract Interface

#### Initialize Pool

```typescript
const zylithContract = new Contract(ABI, CONTRACT_ADDRESS, provider);

await zylithContract.initialize(
  token0Address,
  token1Address,
  fee,           // e.g., 3000 (0.3%)
  tickSpacing,   // e.g., 60
  sqrtPriceX128  // Initial price in Q128.128 format
);
```

#### Private Deposit

```typescript
// 1. Generate commitment off-chain
const commitment = generateCommitment(secret, nullifier, amount);

// 2. Approve tokens
await tokenContract.approve(CONTRACT_ADDRESS, amount);

// 3. Deposit
await zylithContract.private_deposit(
  tokenAddress,
  amount,
  commitment
);
```

#### Private Swap

```typescript
// 1. Get Merkle proof from ASP
const proof = await fetch(`http://asp-server:3000/deposit/proof/${leafIndex}`)
  .then(r => r.json());

// 2. Generate ZK proof using Circom
const zkProof = await generateSwapProof({
  secret,
  nullifier,
  amount,
  merklePath: proof.path,
  merklePathIndices: proof.path_indices,
  root: proof.root,
  // ... swap parameters
});

// 3. Format proof for Garaga verifier
const fullProof = formatProofForGaraga(zkProof);

// 4. Execute swap
await zylithContract.private_swap(
  fullProof,
  publicInputs,
  zeroForOne,
  amountSpecified,
  sqrtPriceLimitX128,
  newCommitment
);
```

---

## Code Examples

### Frontend Integration (TypeScript/React)

#### 1. Setup and Configuration

```typescript
// config.ts
export const CONFIG = {
  // Contract addresses
  ZYLITH_CONTRACT: '0x04b6a594dc9747caf1bd3d8933621366bbb7fbaefa1522174432611b577ae94d',
  
  // ASP Server
  ASP_SERVER_URL: process.env.REACT_APP_ASP_URL || 'http://localhost:3000',
  
  // RPC
  STARKNET_RPC: process.env.REACT_APP_RPC_URL || 'https://api.cartridge.gg/x/starknet/sepolia',
  
  // Circuit paths (for Node.js backend)
  CIRCUITS_PATH: '../circuits',
};

// Initialize Starknet provider
import { Provider, Contract, Account } from 'starknet';

const provider = new Provider({ rpc: { nodeUrl: CONFIG.STARKNET_RPC } });
const account = new Account(provider, accountAddress, privateKey);
```

#### 2. Commitment Generation

```typescript
// commitment.ts
import { poseidonHashMany } from 'micro-starknet';

/**
 * Generate a commitment: Poseidon(Poseidon(secret, nullifier), amount)
 */
export function generateCommitment(
  secret: bigint,
  nullifier: bigint,
  amount: bigint
): bigint {
  // First hash: Poseidon(secret, nullifier)
  const intermediate = poseidonHashMany([secret, nullifier]);
  
  // Second hash: Poseidon(intermediate, amount)
  const commitment = poseidonHashMany([intermediate, amount]);
  
  return commitment;
}

/**
 * Generate random secret and nullifier
 */
export function generateNote(): { secret: bigint; nullifier: bigint } {
  const secret = BigInt('0x' + crypto.getRandomValues(new Uint8Array(32))
    .reduce((s, b) => s + b.toString(16).padStart(2, '0'), ''));
  
  const nullifier = BigInt('0x' + crypto.getRandomValues(new Uint8Array(32))
    .reduce((s, b) => s + b.toString(16).padStart(2, '0'), ''));
  
  return { secret, nullifier };
}
```

#### 3. ASP Client

```typescript
// aspClient.ts
export class ASPClient {
  constructor(private baseUrl: string) {}

  async getMerkleProof(leafIndex: number): Promise<MerkleProof> {
    const response = await fetch(`${this.baseUrl}/deposit/proof/${leafIndex}`);
    if (!response.ok) {
      throw new Error(`Failed to get Merkle proof: ${response.statusText}`);
    }
    return response.json();
  }

  async getCurrentRoot(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/deposit/root`);
    return response.text();
  }

  async getTreeInfo(): Promise<TreeInfo> {
    const response = await fetch(`${this.baseUrl}/deposit/info`);
    return response.json();
  }
}

interface MerkleProof {
  leaf: string;
  path: string[];
  path_indices: number[];
  root: string;
}

interface TreeInfo {
  root: string;
  leaf_count: number;
  depth: number;
}
```

#### 4. ZK Proof Generation (Backend Service)

```typescript
// proofService.ts
// This should run in a Node.js backend, not in the browser

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export class ProofService {
  constructor(private circuitsPath: string) {}

  /**
   * Generate a swap proof using Circom circuit
   */
  async generateSwapProof(inputs: SwapProofInputs): Promise<SwapProof> {
    // 1. Create input file
    const inputFile = path.join(this.circuitsPath, 'swap_input.json');
    await fs.promises.writeFile(
      inputFile,
      JSON.stringify(inputs, null, 2)
    );

    // 2. Generate witness
    await execAsync(
      `node ${this.circuitsPath}/out/swap_js/generate_witness.js ` +
      `${this.circuitsPath}/out/swap_js/swap.wasm ` +
      `${inputFile} ${this.circuitsPath}/swap_witness.wtns`,
      { cwd: this.circuitsPath }
    );

    // 3. Generate proof
    await execAsync(
      `snarkjs groth16 prove ` +
      `${this.circuitsPath}/out/swap_final.zkey ` +
      `${this.circuitsPath}/swap_witness.wtns ` +
      `${this.circuitsPath}/swap_proof.json ` +
      `${this.circuitsPath}/swap_public.json`,
      { cwd: this.circuitsPath }
    );

    // 4. Read proof
    const proof = JSON.parse(
      await fs.promises.readFile(
        path.join(this.circuitsPath, 'swap_proof.json'),
        'utf-8'
      )
    );

    const publicInputs = JSON.parse(
      await fs.promises.readFile(
        path.join(this.circuitsPath, 'swap_public.json'),
        'utf-8'
      )
    );

    // 5. Format for Garaga
    return this.formatProofForGaraga(proof, publicInputs);
  }

  /**
   * Format proof for Garaga verifier (full_proof_with_hints format)
   */
  private formatProofForGaraga(proof: any, publicInputs: any): SwapProof {
    // Garaga expects: [A_x, A_y, B_x0, B_x1, B_y0, B_y1, C_x, C_y, ...public_inputs, ...hints]
    return {
      full_proof_with_hints: [
        // A (G1 point)
        proof.pi_a[0],
        proof.pi_a[1],
        // B (G2 point)
        proof.pi_b[0][0],
        proof.pi_b[0][1],
        proof.pi_b[1][0],
        proof.pi_b[1][1],
        // C (G1 point)
        proof.pi_c[0],
        proof.pi_c[1],
        // Public inputs
        ...publicInputs,
        // Hints (if any)
      ],
    };
  }
}

interface SwapProofInputs {
  secret: string;
  nullifier: string;
  amount: string;
  merkle_path: string[];
  merkle_path_indices: number[];
  root: string;
  // ... swap-specific inputs
}

interface SwapProof {
  full_proof_with_hints: string[];
}
```

#### 5. Complete Private Swap Flow

```typescript
// swapService.ts
import { Contract, Account } from 'starknet';
import { ASPClient } from './aspClient';
import { ProofService } from './proofService';

export class PrivateSwapService {
  constructor(
    private contract: Contract,
    private account: Account,
    private aspClient: ASPClient,
    private proofService: ProofService
  ) {}

  async executePrivateSwap(params: {
    secret: bigint;
    nullifier: bigint;
    leafIndex: number;
    zeroForOne: boolean;
    amountSpecified: bigint;
    sqrtPriceLimitX128: bigint;
    newSecret: bigint;
    newNullifier: bigint;
    newAmount: bigint;
  }) {
    // 1. Get Merkle proof from ASP
    const merkleProof = await this.aspClient.getMerkleProof(params.leafIndex);

    // 2. Verify root matches on-chain
    const onChainRoot = await this.contract.get_merkle_root();
    if (onChainRoot.toString() !== merkleProof.root) {
      throw new Error('Merkle root mismatch');
    }

    // 3. Generate ZK proof (backend call)
    const zkProof = await this.proofService.generateSwapProof({
      secret: params.secret.toString(),
      nullifier: params.nullifier.toString(),
      amount: params.amountSpecified.toString(),
      merkle_path: merkleProof.path,
      merkle_path_indices: merkleProof.path_indices,
      root: merkleProof.root,
      // ... additional swap parameters
    });

    // 4. Generate new commitment
    const newCommitment = generateCommitment(
      params.newSecret,
      params.newNullifier,
      params.newAmount
    );

    // 5. Execute swap on-chain
    const result = await this.contract.private_swap(
      zkProof.full_proof_with_hints,
      zkProof.public_inputs,
      params.zeroForOne,
      params.amountSpecified,
      params.sqrtPriceLimitX128,
      newCommitment
    );

    return result;
  }
}
```

#### 6. React Hook Example

```typescript
// usePrivateSwap.ts
import { useState } from 'react';
import { useAccount, useContract } from './starknetHooks';
import { PrivateSwapService } from './swapService';

export function usePrivateSwap() {
  const { account } = useAccount();
  const contract = useContract();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeSwap = async (params: SwapParams) => {
    setLoading(true);
    setError(null);

    try {
      const service = new PrivateSwapService(
        contract,
        account,
        aspClient,
        proofService
      );

      const result = await service.executePrivateSwap(params);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { executeSwap, loading, error };
}
```

---

## Error Handling

### Common Errors and Solutions

#### 1. Merkle Root Mismatch

```typescript
// Error: Root from ASP doesn't match on-chain root
// Solution: Wait for ASP to sync, or use historical root
const historicalRoots = await contract.get_known_roots();
if (historicalRoots.includes(merkleProof.root)) {
  // Use historical root
}
```

#### 2. Proof Verification Failed

```typescript
// Error: Invalid ZK proof
// Solution: Verify proof generation inputs match exactly
// - Check commitment calculation
// - Verify Merkle path indices
// - Ensure public inputs match circuit expectations
```

#### 3. Nullifier Already Spent

```typescript
// Error: Nullifier has been spent
// Solution: Generate new nullifier for each operation
const isSpent = await contract.is_nullifier_spent(nullifier);
if (isSpent) {
  throw new Error('Note already spent');
}
```

#### 4. ASP Server Unavailable

```typescript
// Error: Cannot connect to ASP server
// Solution: Implement retry logic and fallback
async function getMerkleProofWithRetry(index: number, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await aspClient.getMerkleProof(index);
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

---

## Best Practices

### 1. Security

- **Never expose secrets/nullifiers**: Keep them in secure storage (encrypted)
- **Validate all inputs**: Verify Merkle proofs and commitments before submission
- **Use HTTPS**: Always use encrypted connections for ASP server
- **Implement rate limiting**: Prevent proof generation abuse

### 2. Performance

- **Cache Merkle roots**: Don't fetch root on every operation
- **Batch proof generation**: Generate multiple proofs in parallel when possible
- **Use Web Workers**: Move proof generation to background threads
- **Optimize circuit paths**: Pre-compile circuits and cache results

### 3. User Experience

- **Show progress**: Display proof generation progress to users
- **Handle long operations**: Proof generation can take 5-30 seconds
- **Provide clear errors**: Translate contract errors to user-friendly messages
- **Implement retries**: Automatically retry failed transactions

### 4. Development

- **Use TypeScript**: Strong typing prevents many errors
- **Mock ASP server**: Use mock server for local development
- **Test with devnet**: Test all flows on local devnet first
- **Monitor gas costs**: Track and optimize transaction costs

---

## Complete Example: Private Deposit Flow

```typescript
// Complete example: Private deposit
async function privateDeposit(
  tokenAddress: string,
  amount: bigint,
  account: Account
) {
  // 1. Generate note (secret, nullifier)
  const { secret, nullifier } = generateNote();

  // 2. Generate commitment
  const commitment = generateCommitment(secret, nullifier, amount);

  // 3. Approve tokens
  const tokenContract = new Contract(ERC20_ABI, tokenAddress, account);
  await tokenContract.approve(ZYLITH_ADDRESS, amount);

  // 4. Deposit
  const zylithContract = new Contract(ZYLITH_ABI, ZYLITH_ADDRESS, account);
  const tx = await zylithContract.private_deposit(
    tokenAddress,
    amount,
    commitment
  );

  // 5. Wait for transaction
  await account.waitForTransaction(tx.transaction_hash);

  // 6. Get leaf index from event
  const receipt = await account.getTransactionReceipt(tx.transaction_hash);
  const depositEvent = receipt.events.find(e => e.name === 'Deposit');
  const leafIndex = depositEvent.data.leaf_index;

  // 7. Store note securely (encrypted)
  const note = {
    secret: secret.toString(),
    nullifier: nullifier.toString(),
    amount: amount.toString(),
    commitment: commitment.toString(),
    leafIndex,
    tokenAddress,
  };
  
  await storeNoteSecurely(note);

  return { note, txHash: tx.transaction_hash };
}
```

---

## Next Steps

1. **Set up ASP server**: Deploy and configure the ASP server
2. **Install dependencies**: Set up Circom and proof generation tools
3. **Create API wrapper**: Build a backend service for proof generation
4. **Implement UI**: Create React components for private operations
5. **Test thoroughly**: Test all flows on testnet before mainnet

---

## Additional Resources

- [Zylith Contract ABI](../api/api-reference.md)
- [ASP Server Documentation](../../asp/README.md)
- [Circom Circuit Documentation](../../circuits/README.md)
- [Starknet.js Documentation](https://www.starknetjs.com/)

---

**Last Updated**: January 2025
**Version**: 1.0

