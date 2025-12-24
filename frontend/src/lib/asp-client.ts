import { CONFIG } from "@/lib/config";

export interface MerkleProof {
  leaf: string;
  path: string[];
  path_indices: number[];
  root: string;
}

export interface TreeInfo {
  root: string;
  leaf_count: number;
  depth: number;
}

export class ASPClient {
  private baseUrl: string;

  // Use the local API proxy by default to avoid CORS and enable caching
  constructor(baseUrl: string = "/api/merkle") {
    this.baseUrl = baseUrl;
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    // Remove leading slash from endpoint if baseUrl ends with it, or handle cleanly
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`ASP API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    return response.json();
  }

  async getMerkleProof(index: number): Promise<MerkleProof> {
    return this.fetch<MerkleProof>(`/deposit/proof/${index}`);
  }

  async getCurrentRoot(): Promise<string> {
    return this.fetch<string>(`/deposit/root`);
  }

  async getTreeInfo(): Promise<TreeInfo> {
    return this.fetch<TreeInfo>(`/deposit/info`);
  }

  async getHealth(): Promise<{ status: string }> {
    return this.fetch<{ status: string }>(`/health`);
  }
}

export const aspClient = new ASPClient();
