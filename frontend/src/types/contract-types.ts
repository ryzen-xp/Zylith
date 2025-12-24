// Contract ABI types would go here
// For now, using any type for flexibility
export type ContractABI = any

export interface ContractCall {
  contractAddress: string
  entrypoint: string
  calldata: any[]
}

