# Zylith Frontend

Frontend application for Zylith - Private AMM on Starknet.

## Overview

This is a Next.js 14 application built with TypeScript, Tailwind CSS, and Framer Motion. It provides a professional interface for interacting with the Zylith private AMM protocol.

## Features

- **Private Swaps**: Execute trades with zero-knowledge proofs
- **Liquidity Management**: Add/remove liquidity privately
- **Portfolio Tracking**: View private balances and transaction history
- **Interactive Demo**: Explore how privacy features work
- **StarkWare-inspired Design**: Modern, professional UI

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui + Radix UI
- **Animations**: Framer Motion
- **State Management**: Zustand
- **Web3**: @starknet-react/core
- **Data Fetching**: React Query (@tanstack/react-query)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
cd frontend
npm install
```

### Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_ZYLITH_CONTRACT=0x04b6a594dc9747caf1bd3d8933621366bbb7fbaefa1522174432611b577ae94d
NEXT_PUBLIC_ASP_URL=http://localhost:3000
NEXT_PUBLIC_RPC_URL=https://starknet-sepolia.public.blastapi.io/rpc/v0_7
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

## Project Structure

```
frontend/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # React components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utilities and services
│   ├── stores/           # Zustand state stores
│   └── types/            # TypeScript types
├── public/               # Static assets
└── package.json
```

## Key Components

### Pages

- `/` - Landing page
- `/swap` - Private swap interface
- `/liquidity` - Liquidity management
- `/portfolio` - Portfolio view
- `/demo` - Interactive demo
- `/features` - Features showcase
- `/docs` - Documentation hub

### Services

- **ASP Client**: Communicates with Association Set Provider server
- **Starknet Client**: Handles contract interactions
- **Proof Service**: Generates ZK proofs via backend API
- **Commitment Lib**: Generates commitments and notes

## Testing

```bash
npm test
```

## Deployment

The app can be deployed to Vercel, Netlify, or any platform supporting Next.js.

### Vercel

1. Connect your repository
2. Set environment variables
3. Deploy

## Configuration

See `src/lib/config.ts` for contract addresses and service URLs.

## License

See main project LICENSE file.
