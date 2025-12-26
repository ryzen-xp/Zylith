import { Contract, Account, RpcProvider } from "starknet";
import { CONFIG } from "../config";
import zylithAbi from "../abis/zylith-abi.json";

// Import CONFIG for contract address

/**
 * Zylith Contract Client
 * Provides helper functions to interact with the Zylith Cairo contract
 */
export class ZylithContractClient {
  private contract: Contract;
  private provider: RpcProvider;

  constructor(provider?: RpcProvider) {
    this.provider = provider || new RpcProvider({ nodeUrl: CONFIG.STARKNET_RPC });
    this.contract = new Contract(zylithAbi, CONFIG.ZYLITH_CONTRACT, this.provider);
  }

  /**
   * Get the contract instance
   * @param account Optional account for write operations
   * @returns Contract instance
   */
  getContract(account?: Account): Contract {
    if (account) {
      return new Contract(zylithAbi, CONFIG.ZYLITH_CONTRACT, account);
    }
    return this.contract;
  }

  /**
   * Initialize a new pool
   * @param account Account to execute the transaction
   * @param token0 First token address
   * @param token1 Second token address
   * @param fee Fee tier (e.g., 3000 = 0.3%)
   * @param tickSpacing Tick spacing (e.g., 60)
   * @param sqrtPriceX128 Initial price in Q128.128 format
   * @returns Transaction result
   */
  async initializePool(
    account: Account,
    token0: string,
    token1: string,
    fee: bigint,
    tickSpacing: number,
    sqrtPriceX128: { low: bigint; high: bigint }
  ) {
    const contract = this.getContract(account);
    return await contract.initialize(
      token0,
      token1,
      fee,
      tickSpacing,
      sqrtPriceX128
    );
  }

  /**
   * Get current Merkle root from the contract
   * @returns Merkle root as felt252
   */
  async getMerkleRoot(): Promise<bigint> {
    const result = await this.contract.get_merkle_root();
    return BigInt(result.toString());
  }

  /**
   * Check if a nullifier has been spent
   * @param nullifier Nullifier to check
   * @returns True if nullifier is spent, false otherwise
   */
  async isNullifierSpent(nullifier: bigint): Promise<boolean> {
    const result = await this.contract.is_nullifier_spent(nullifier);
    // Cairo bool is returned as 0 or 1
    return result === BigInt(1) || result === true;
  }

  /**
   * Check if a Merkle root is known (historical root)
   * @param root Merkle root to check
   * @returns True if root is known, false otherwise
   */
  async isRootKnown(root: bigint): Promise<boolean> {
    const result = await this.contract.is_root_known(root);
    // Cairo bool is returned as 0 or 1
    return result === BigInt(1) || result === true;
  }

  /**
   * Get the count of known historical roots
   * @returns Number of known roots
   */
  async getKnownRootsCount(): Promise<number> {
    const result = await this.contract.get_known_roots_count();
    return Number(result);
  }

  /**
   * Execute a private swap
   * @param account Account to execute the transaction
   * @param proof ZK proof array
   * @param publicInputs Public inputs array
   * @param zeroForOne Swap direction (true = token0 -> token1)
   * @param amountSpecified Amount to swap
   * @param sqrtPriceLimitX128 Price limit in Q128.128 format
   * @param newCommitment Output note commitment
   * @returns Transaction result
   */
  async privateSwap(
    account: Account,
    proof: string[],
    publicInputs: string[],
    zeroForOne: boolean,
    amountSpecified: bigint,
    sqrtPriceLimitX128: { low: bigint; high: bigint },
    newCommitment: bigint
  ) {
    const contract = this.getContract(account);
    
    // Log the actual calldata that will be sent to Starknet
    // Build calldata manually to see what will be sent
    try {
      // The calldata format for private_swap is:
      // [proof_len, ...proof, public_inputs_len, ...public_inputs, zeroForOne, amountSpecified, sqrtPriceLimitX128.low, sqrtPriceLimitX128.high, newCommitment]
      const calldata = [
        proof.length.toString(),
        ...proof,
        publicInputs.length.toString(),
        ...publicInputs,
        zeroForOne ? "1" : "0",
        amountSpecified.toString(),
        sqrtPriceLimitX128.low.toString(),
        sqrtPriceLimitX128.high.toString(),
        newCommitment.toString()
      ];
      
      console.log(`[Contract] 📋 ACTUAL CALLDATA TO BE SENT:`);
      console.log(`[Contract] 📋 Contract Address:`, CONFIG.ZYLITH_CONTRACT);
      console.log(`[Contract] 📋 Entrypoint: private_swap`);
      console.log(`[Contract] 📋 Calldata (${calldata.length} elements):`, JSON.stringify(calldata, null, 2));
      
      // Check each calldata value for overflow
      const STARKNET_FELT_MAX = BigInt("3618502788666131106986593281521497120414687020801267626233049500247285301248");
      let hasOverflow = false;
      calldata.forEach((val: string, idx: number) => {
        try {
          const bigVal = BigInt(val);
          if (bigVal >= STARKNET_FELT_MAX) {
            console.error(`[Contract] ❌ Calldata[${idx}] OVERFLOW: ${val} (>= ${STARKNET_FELT_MAX.toString()})`);
            hasOverflow = true;
          }
        } catch (e) {
          console.warn(`[Contract] ⚠️  Calldata[${idx}] could not be checked: ${val}`);
        }
      });
      
      if (hasOverflow) {
        console.error(`[Contract] ❌ OVERFLOW DETECTED IN CALLDATA! Transaction will fail.`);
      } else {
        console.log(`[Contract] ✅ No overflow detected in calldata.`);
      }
    } catch (logError) {
      console.warn(`[Contract] ⚠️  Could not build calldata for logging:`, logError);
    }
    
    return await contract.private_swap(
      proof,
      publicInputs,
      zeroForOne,
      amountSpecified,
      sqrtPriceLimitX128,
      newCommitment
    );
  }

  /**
   * Execute a private withdraw
   * @param account Account to execute the transaction
   * @param proof ZK proof array
   * @param publicInputs Public inputs array
   * @param token Token contract address
   * @param recipient Address to receive withdrawn tokens
   * @param amount Amount to withdraw
   * @returns Transaction result
   */
  async privateWithdraw(
    account: Account,
    proof: string[],
    publicInputs: string[],
    token: string,
    recipient: string,
    amount: bigint
  ) {
    const contract = this.getContract(account);
    return await contract.private_withdraw(
      proof,
      publicInputs,
      token,
      recipient,
      amount
    );
  }

  /**
   * Execute private mint liquidity
   * @param account Account to execute the transaction
   * @param proof ZK proof array
   * @param publicInputs Public inputs array
   * @param tickLower Lower tick of the position
   * @param tickUpper Upper tick of the position
   * @param liquidity Amount of liquidity to mint
   * @param newCommitment Output note commitment
   * @returns Transaction result
   */
  async privateMintLiquidity(
    account: Account,
    proof: string[],
    publicInputs: string[],
    tickLower: number,
    tickUpper: number,
    liquidity: bigint,
    newCommitment: bigint
  ) {
    const contract = this.getContract(account);
    return await contract.private_mint_liquidity(
      proof,
      publicInputs,
      tickLower,
      tickUpper,
      liquidity,
      newCommitment
    );
  }

  /**
   * Execute private burn liquidity
   * @param account Account to execute the transaction
   * @param proof ZK proof array
   * @param publicInputs Public inputs array
   * @param tickLower Lower tick of the position
   * @param tickUpper Upper tick of the position
   * @param liquidity Amount of liquidity to burn
   * @param newCommitment Output note commitment
   * @returns Transaction result
   */
  async privateBurnLiquidity(
    account: Account,
    proof: string[],
    publicInputs: string[],
    tickLower: number,
    tickUpper: number,
    liquidity: bigint,
    newCommitment: bigint
  ) {
    const contract = this.getContract(account);
    return await contract.private_burn_liquidity(
      proof,
      publicInputs,
      tickLower,
      tickUpper,
      liquidity,
      newCommitment
    );
  }

  /**
   * Execute private collect (collect fees from a position)
   * @param account Account to execute the transaction
   * @param proof ZK proof array
   * @param publicInputs Public inputs array
   * @param tickLower Lower tick of the position
   * @param tickUpper Upper tick of the position
   * @param newCommitment Output note commitment
   * @returns Transaction result
   */
  async privateCollect(
    account: Account,
    proof: string[],
    publicInputs: string[],
    tickLower: number,
    tickUpper: number,
    newCommitment: bigint
  ) {
    const contract = this.getContract(account);
    return await contract.private_collect(
      proof,
      publicInputs,
      tickLower,
      tickUpper,
      newCommitment
    );
  }
}

/**
 * Singleton instance of Zylith contract client
 */
export const zylithContract = new ZylithContractClient();

/**
 * Helper function to get Zylith contract instance
 * @param account Optional account for write operations
 * @returns Contract instance
 */
export function getZylithContract(account?: Account): Contract {
  return zylithContract.getContract(account);
}

