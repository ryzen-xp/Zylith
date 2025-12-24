import { Contract, RpcProvider } from "starknet";
import { CONFIG } from "./config";

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

  async getZylithContract() {
    // ABI would be imported here or fetched
    // For now returning basic contract wrapper
    // We'll need the ABI for Zylith
    return new Contract([], CONFIG.ZYLITH_CONTRACT, this.provider);
  }
}

export const starknetClient = new StarknetClient();

