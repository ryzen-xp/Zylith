# Testing Guide

This document describes the testing structure and conventions for the Zylith frontend.

## Test Structure

Tests are organized following the same directory structure as the source code:

```
src/
├── lib/
│   ├── __tests__/
│   │   ├── commitment.test.ts
│   │   └── config.test.ts
│   ├── contracts/
│   │   ├── __tests__/
│   │   │   └── zylith-contract.test.ts
│   └── ...
├── hooks/
│   └── __tests__/
│       └── (hook tests)
└── components/
    └── __tests__/
        └── (component tests)
```

## Test Naming Convention

- Test files: `*.test.ts` or `*.test.tsx`
- Test files location: `__tests__/` directory next to the source file
- Test descriptions: Use `describe` blocks to group related tests

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- src/lib/contracts/__tests__/zylith-contract.test.ts

# Run tests with coverage
npm test -- --coverage
```

## Writing Tests

### Example: Testing a Contract Client

```typescript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ZylithContractClient } from '../zylith-contract';

// Mock external dependencies
jest.mock('starknet', () => ({
  Contract: jest.fn().mockImplementation(() => ({
    get_merkle_root: jest.fn(),
    // ... other methods
  })),
}));

describe('ZylithContractClient', () => {
  let client: ZylithContractClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new ZylithContractClient();
  });

  it('should get Merkle root', async () => {
    // Test implementation
  });
});
```

## Test Coverage Goals

As we progress through integration TODOs, we aim for:

- **Unit tests**: All utility functions and client classes
- **Integration tests**: Contract interactions and API calls
- **Component tests**: UI components with user interactions

## Current Test Coverage

### Completed
- ✅ `lib/commitment.test.ts` - Commitment generation
- ✅ `lib/config.test.ts` - Configuration validation
- ✅ `lib/contracts/zylith-contract.test.ts` - Zylith contract client
- ✅ `lib/proof-service.test.ts` - Proof service and Garaga formatting
- ✅ `hooks/use-private-deposit.test.ts` - Private deposit core logic
- ✅ `hooks/use-private-swap.test.ts` - Private swap core logic
- ✅ `hooks/use-private-withdraw.test.ts` - Private withdraw core logic
- ✅ `hooks/use-liquidity.test.ts` - Private liquidity operations core logic
- ✅ `components/swap/SwapInterface.test.tsx` - Swap interface core logic
- ✅ `components/liquidity/LiquidityManager.test.tsx` - Liquidity manager core logic
- ✅ `components/portfolio/NotesList.test.tsx` - Notes list filtering, withdraw logic, and note management (TODO 4.4)
- ✅ `lib/error-messages.test.ts` - User-friendly error message conversion
- ✅ `__tests__/integration/flows.test.ts` - End-to-end flow integration tests (TODO 5.1)

### Pending (as we implement features)
- ⏳ `hooks/use-private-swap.test.ts`
- ⏳ `hooks/use-private-withdraw.test.ts`
- ⏳ `hooks/use-liquidity.test.ts`
- ⏳ `lib/asp-client.test.ts`
- ⏳ `lib/proof-service.test.ts`

## Best Practices

1. **Mock external dependencies**: Always mock blockchain calls, API requests, and external libraries
2. **Test edge cases**: Include tests for error conditions, boundary values, and null/undefined cases
3. **Keep tests isolated**: Each test should be independent and not rely on other tests
4. **Use descriptive names**: Test names should clearly describe what is being tested
5. **Follow AAA pattern**: Arrange, Act, Assert structure for clarity

## Mocking Guidelines

### Mocking Starknet Contracts

```typescript
jest.mock('starknet', () => ({
  Contract: jest.fn().mockImplementation(() => ({
    method_name: jest.fn().mockResolvedValue(mockValue),
  })),
}));
```

### Mocking API Calls

```typescript
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => mockData,
});
```

### Mocking React Hooks

```typescript
jest.mock('@starknet-react/core', () => ({
  useAccount: () => ({ account: mockAccount }),
}));
```

## Adding Tests for New Features

When implementing a new TODO:

1. Create test file in `__tests__/` directory
2. Write tests for the main functionality
3. Include error handling tests
4. Run tests to ensure they pass
5. Update this README with test coverage status

---

**Last Updated**: January 2025

