import { Contract, RpcProvider } from "starknet";
import { CONFIG } from "./config";
import { getZylithContract } from "./contracts/zylith-contract";

export class StarknetClient {
  private provider: RpcProvider;

  constructor() {
    this.provider = new RpcProvider({ nodeUrl: CONFIG.STARKNET_RPC });
  }

  getProvider() {
    return this.provider;
  }

  async getContract(address: string, abi: any) {
    return new Contract(abi, address, this.provider);
  }

  /**
   * Get Zylith contract instance
   * @param account Optional account for write operations
   * @returns Zylith contract instance
   */
  getZylithContract(account?: any) {
    return getZylithContract(account);
  }
}

export const starknetClient = new StarknetClient();

