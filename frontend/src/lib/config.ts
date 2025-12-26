export const CONFIG = {
  // Contract addresses from Zylith deployment
  ZYLITH_CONTRACT:
    process.env.NEXT_PUBLIC_ZYLITH_CONTRACT ||
    "0x002c6ced7ef107e71fb10b6b04b301d52116ab1803b19a0b88b35874d207db1d",

  // Verifier contracts
  VERIFIERS: {
    MEMBERSHIP:
      process.env.NEXT_PUBLIC_VERIFIER_MEMBERSHIP ||
      "0x011c0deb3618f2358dcba0dda14f43ef47f40b7be681d6708f554ce3d0ad5432",
    SWAP:
      process.env.NEXT_PUBLIC_VERIFIER_SWAP ||
      "0x04e7dc3190830a31c626e88182630b1eb71f8f6c6f9562adb358697f4754093b",
    WITHDRAW:
      process.env.NEXT_PUBLIC_VERIFIER_WITHDRAW ||
      "0x04ade28020ebb5676a8a55219bba7f4ef175ae8f8f8189491193b1153e991330",
    LP:
      process.env.NEXT_PUBLIC_VERIFIER_LP ||
      "0x0202fa77f1158fce60dbb3d62b503dba0ce9f360003507f459d21cbed52c87d6",
  },

  // Services
  ASP_SERVER_URL: process.env.NEXT_PUBLIC_ASP_URL || "http://localhost:3000",
  // Using alternative RPC endpoint as BlastAPI may require auth or have rate limits
  STARKNET_RPC:
    process.env.NEXT_PUBLIC_RPC_URL ||
    "https://starknet-sepolia-rpc.publicnode.com",

  // Backend API
  API_URL: "/api",

  // App settings
  APP_NAME: "Zylith",
  APP_DESCRIPTION: "Private AMM on Starknet",
  NETWORK: "sepolia",
};

export const TOKENS = [
  {
    symbol: "ETH",
    name: "Ether",
    address:
      "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7", // Sepolia ETH
    decimals: 18,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address:
      "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8", // Sepolia USDC
    decimals: 6,
  },
];
