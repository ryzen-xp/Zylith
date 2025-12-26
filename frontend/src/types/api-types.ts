// Contract types
export interface ZylithContract {
  address: string
  abi: any
}

export interface VerifierContract {
  membership: string
  swap: string
  withdraw: string
  lp: string
}

// Note types
export interface Note {
  secret: bigint
  nullifier: bigint
  amount: bigint
  commitment: bigint
  tokenAddress?: string
  index?: number
}

// API types
export interface MerkleProof {
  leaf: string
  path: string[]
  path_indices: number[]
  root: string
}

export interface TreeInfo {
  root: string
  leaf_count: number
  depth: number
}

export interface ProofRequest {
  secret: string
  nullifier: string
  amount: string
  merkle_path?: string[]
  merkle_path_indices?: number[]
  root?: string
  [key: string]: any
}

export interface ProofResponse {
  full_proof_with_hints: string[]
  public_inputs: string[]
  merkle_proof?: MerkleProof
}

// ASP Transaction Preparation Types
export interface PreparedTransaction {
  contract_address: string
  entry_point: string
  calldata: string[]
}

export interface NoteData {
  secret: string
  nullifier: string
  amount: string
}

export interface DepositPrepareResponse {
  transactions: PreparedTransaction[]
  commitment: string
  note_data: NoteData
}

export interface SwapPrepareResponse {
  merkle_proof: MerkleProof
  new_commitment: string
  output_note_data: NoteData
}

export interface WithdrawPrepareResponse {
  transactions: PreparedTransaction[]
}

export interface LiquidityPrepareResponse {
  transactions: PreparedTransaction[]
  new_commitment: string
  output_note_data: NoteData
}

export interface InitializePrepareResponse {
  transactions: PreparedTransaction[]
  token0: string
  token1: string
  fee: number
  tick_spacing: number
  sqrt_price_x128: {
    low: string
    high: string
  }
}

