export const CONFIG = {
  // Contract addresses from Zylith deployment
  ZYLITH_CONTRACT: process.env.NEXT_PUBLIC_ZYLITH_CONTRACT || '0x04b6a594dc9747caf1bd3d8933621366bbb7fbaefa1522174432611b577ae94d',
  
  // Verifier contracts
  VERIFIERS: {
    MEMBERSHIP: process.env.NEXT_PUBLIC_VERIFIER_MEMBERSHIP || '0x066448de8e457554d16155f215386dc9c8052a5d99212586840494142aedc165',
    SWAP: process.env.NEXT_PUBLIC_VERIFIER_SWAP || '0x0432a5184b4e187cf68a7c476c653528b7da14f6851de8c8e1ce76b1e1bb9e36',
    WITHDRAW: process.env.NEXT_PUBLIC_VERIFIER_WITHDRAW || '0x037f7a9fed4daa5ec5ff69e5a101ccf40c219f6cb3c0cb081c64d34ac4a26ad0',
    LP: process.env.NEXT_PUBLIC_VERIFIER_LP || '0x0745acde8db05d4b4a49dc1f2cd313a3a8960e812d41d0b71ff90457f8ebbe7e',
  },

  // Services
  ASP_SERVER_URL: process.env.NEXT_PUBLIC_ASP_URL || 'http://localhost:3000',
  STARKNET_RPC: process.env.NEXT_PUBLIC_RPC_URL || 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7',
  
  // Backend API
  API_URL: '/api',

  // App settings
  APP_NAME: 'Zylith',
  APP_DESCRIPTION: 'Private AMM on Starknet',
  NETWORK: 'sepolia',
};

export const TOKENS = [
  {
    symbol: 'ETH',
    name: 'Ether',
    address: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7', // Sepolia ETH
    decimals: 18,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8', // Sepolia USDC
    decimals: 6,
  }
];
