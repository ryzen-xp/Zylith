"use client"

import { useQuery } from "@tanstack/react-query"
import { aspClient } from "@/lib/asp-client"

export function useASP() {
  const healthQuery = useQuery({
    queryKey: ["asp", "health"],
    queryFn: () => aspClient.getHealth(),
    refetchInterval: 60000, // Check every minute
  })

  const treeInfoQuery = useQuery({
    queryKey: ["asp", "treeInfo"],
    queryFn: () => aspClient.getTreeInfo(),
    refetchInterval: 10000, // Update every 10s
  })

  const useMerkleProof = (index?: number) => {
    return useQuery({
      queryKey: ["asp", "proof", index],
      queryFn: () => aspClient.getMerkleProof(index!),
      enabled: index !== undefined && index >= 0,
      staleTime: Infinity, // Merkle proofs for a specific index shouldn't change once finalized
    })
  }

  return {
    health: healthQuery,
    treeInfo: treeInfoQuery,
    useMerkleProof,
    client: aspClient
  }
}

