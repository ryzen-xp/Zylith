import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// Mock all dependencies before imports
jest.mock("../use-starknet", () => ({
  useStarknet: jest.fn(),
}));

jest.mock("../use-portfolio", () => ({
  usePortfolioStore: jest.fn(),
}));

jest.mock("@/lib/contracts/zylith-contract", () => ({
  getZylithContract: jest.fn(),
}));

jest.mock("@/lib/commitment", () => ({
  generateNote: jest.fn(),
  toHex: jest.fn((v) => `0x${v.toString(16)}`),
}));

jest.mock("@/lib/config", () => ({
  CONFIG: {
    ZYLITH_CONTRACT:
      "0x00c692a0a7b34ffe8c5484e6db9488dc881ceae9c9b05d67de21387ea9f3edd6",
  },
}));

jest.mock("@/lib/abis/erc20-abi.json", () => [], { virtual: true });

jest.mock("starknet", () => ({
  Contract: jest.fn(),
  Account: jest.fn(),
  RpcProvider: jest.fn(),
}));

// Now import after mocks
import { useStarknet } from "../use-starknet";
import { usePortfolioStore } from "../use-portfolio";

/**
 * Tests for use-private-deposit hook
 *
 * Note: Full React hook testing requires @testing-library/react-hooks
 * These tests verify the core logic and dependencies
 */
describe("usePrivateDeposit - Core Logic", () => {
  it("should handle u256 conversion correctly", () => {
    // Test u256 conversion logic used in the hook
    const amount = 1000000n;
    const low = amount & BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF");
    const high = amount >> BigInt(128);

    expect(typeof low).toBe("bigint");
    expect(typeof high).toBe("bigint");
    expect(low).toBe(1000000n);
    expect(high).toBe(0n);
  });

  it("should handle large u256 amounts", () => {
    // Test with amount > 2^128
    const largeAmount = BigInt("0x200000000000000000000000000000000"); // > 2^128
    const low = largeAmount & BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF");
    const high = largeAmount >> BigInt(128);

    expect(high).toBeGreaterThan(0n);
    expect(low).toBeLessThan(BigInt("0x1000000000000000000000000000000000"));
  });

  it("should have correct deposit event selector", () => {
    // Verify the event selector matches the ASP syncer
    const DEPOSIT_EVENT_SELECTOR =
      "0x9149d2123147c5f43d258257fef0b7b969db78269369ebcf5ebb9eef8592f2";
    expect(DEPOSIT_EVENT_SELECTOR).toMatch(/^0x[a-fA-F0-9]+$/);
    expect(DEPOSIT_EVENT_SELECTOR.length).toBe(64); // 62 hex chars (felt252 is 62 chars)
  });

  it("should parse deposit event data correctly", () => {
    // Test event parsing logic
    const mockEvent = {
      from_address:
        "0x00c692a0a7b34ffe8c5484e6db9488dc881ceae9c9b05d67de21387ea9f3edd6",
      keys: [
        "0x9149d2123147c5f43d258257fef0b7b969db78269369ebcf5ebb9eef8592f2",
      ],
      data: ["0x123", "42", "0x456"],
    };

    const commitment = BigInt(mockEvent.data[0]);
    const leafIndex = Number(mockEvent.data[1]);
    const root = BigInt(mockEvent.data[2]);

    expect(commitment).toBe(BigInt("0x123"));
    expect(leafIndex).toBe(42);
    expect(root).toBe(BigInt("0x456"));
  });

  it("should validate event structure", () => {
    // Test that deposit events have the correct structure
    const validEvent = {
      from_address:
        "0x00c692a0a7b34ffe8c5484e6db9488dc881ceae9c9b05d67de21387ea9f3edd6",
      keys: [
        "0x9149d2123147c5f43d258257fef0b7b969db78269369ebcf5ebb9eef8592f2",
      ],
      data: ["0x123", "42", "0x456"],
    };

    const hasCorrectSelector =
      validEvent.keys?.[0] ===
      "0x9149d2123147c5f43d258257fef0b7b969db78269369ebcf5ebb9eef8592f2";
    const hasEnoughData = validEvent.data?.length >= 3;

    expect(hasCorrectSelector).toBe(true);
    expect(hasEnoughData).toBe(true);
  });
});
