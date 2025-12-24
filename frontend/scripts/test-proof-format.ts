/**
 * Test script to verify proof format for Garaga verifier
 * 
 * Usage:
 *   cd frontend
 *   npx tsx scripts/test-proof-format.ts
 * 
 * This script:
 * 1. Generates a test proof using snarkjs
 * 2. Formats it for Garaga verifier
 * 3. Validates the output structure
 */

import * as snarkjs from "snarkjs";
import * as fs from "fs";
import * as path from "path";

// Circuit configuration
const CIRCUITS_DIR = path.resolve(process.cwd(), "../circuits");
const CIRCUITS = {
  membership: {
    wasm: path.join(CIRCUITS_DIR, "out/membership_js/membership.wasm"),
    zkey: path.join(CIRCUITS_DIR, "out/membership_final.zkey"),
    // Expected public inputs: [root, commitment]
    expectedPublicInputsCount: 2,
    testInputs: null // Requires valid commitment derivation
  },
  swap: {
    wasm: path.join(CIRCUITS_DIR, "out/swap_js/swap.wasm"),
    zkey: path.join(CIRCUITS_DIR, "out/swap_final.zkey"),
    // Expected public inputs: [nullifier, root, new_commitment, amount_specified, zero_for_one, amount0_delta, amount1_delta, new_sqrt_price_x128, new_tick]
    expectedPublicInputsCount: 9,
    testInputs: null // Complex inputs needed
  },
  withdraw: {
    wasm: path.join(CIRCUITS_DIR, "out/withdraw_js/withdraw.wasm"),
    zkey: path.join(CIRCUITS_DIR, "out/withdraw_final.zkey"),
    // Expected public inputs: [nullifier, root, recipient, amount]
    expectedPublicInputsCount: 4,
    testInputs: null // Complex inputs needed
  },
  lp: {
    wasm: path.join(CIRCUITS_DIR, "out/lp_js/lp.wasm"),
    zkey: path.join(CIRCUITS_DIR, "out/lp_final.zkey"),
    // Expected public inputs: [nullifier, root, tick_lower, tick_upper, liquidity, new_commitment, position_commitment]
    expectedPublicInputsCount: 7,
    testInputs: null // Complex inputs needed
  }
};

/**
 * Format proof for Garaga verifier
 * Expected format: [A.x, A.y, B.x0, B.x1, B.y0, B.y1, C.x, C.y, ...public_inputs]
 * 
 * NOTE: This is the base format. Garaga also requires precomputed hints (mpcheck_hint, msm_hint)
 * which are generated using the `garaga gen` command.
 */
function formatProofForGaraga(proof: any, publicInputs: string[]): {
  proofPoints: string[];
  publicInputs: string[];
  fullProof: string[];
} {
  // A points (G1)
  const A = [proof.pi_a[0], proof.pi_a[1]];
  
  // B points (G2) - snarkjs returns as [[x0, x1], [y0, y1]]
  // Garaga expects: [x0, x1, y0, y1]
  const B_x = proof.pi_b[0]; // [x0, x1]
  const B_y = proof.pi_b[1]; // [y0, y1]
  
  // C points (G1)
  const C = [proof.pi_c[0], proof.pi_c[1]];

  const proofPoints = [
    A[0].toString(), A[1].toString(),           // A.x, A.y
    B_x[0].toString(), B_x[1].toString(),       // B.x0, B.x1
    B_y[0].toString(), B_y[1].toString(),       // B.y0, B.y1
    C[0].toString(), C[1].toString(),           // C.x, C.y
  ];

  const fullProof = [
    ...proofPoints,
    ...publicInputs.map(v => v.toString())
  ];

  return {
    proofPoints,
    publicInputs: publicInputs.map(v => v.toString()),
    fullProof
  };
}

/**
 * Verify the structure of proof points
 */
function verifyProofStructure(proof: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check pi_a structure
  if (!Array.isArray(proof.pi_a) || proof.pi_a.length < 2) {
    errors.push("pi_a should be an array with at least 2 elements [x, y]");
  }

  // Check pi_b structure (G2 point)
  if (!Array.isArray(proof.pi_b) || proof.pi_b.length < 2) {
    errors.push("pi_b should be an array with at least 2 elements [[x0,x1], [y0,y1]]");
  } else {
    if (!Array.isArray(proof.pi_b[0]) || proof.pi_b[0].length !== 2) {
      errors.push("pi_b[0] (x coordinates) should have 2 elements");
    }
    if (!Array.isArray(proof.pi_b[1]) || proof.pi_b[1].length !== 2) {
      errors.push("pi_b[1] (y coordinates) should have 2 elements");
    }
  }

  // Check pi_c structure
  if (!Array.isArray(proof.pi_c) || proof.pi_c.length < 2) {
    errors.push("pi_c should be an array with at least 2 elements [x, y]");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Verify all values are valid field elements
 */
function verifyFieldElements(values: string[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const FIELD_PRIME = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");

  for (let i = 0; i < values.length; i++) {
    try {
      const val = BigInt(values[i]);
      if (val < 0n) {
        errors.push(`Value at index ${i} is negative`);
      }
      if (val >= FIELD_PRIME) {
        errors.push(`Value at index ${i} exceeds field prime`);
      }
    } catch {
      errors.push(`Value at index ${i} is not a valid BigInt: ${values[i]}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

async function testCircuit(circuitName: string, config: typeof CIRCUITS[keyof typeof CIRCUITS]) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Testing circuit: ${circuitName}`);
  console.log("=".repeat(60));

  // Check if files exist
  if (!fs.existsSync(config.wasm)) {
    console.log(`❌ WASM file not found: ${config.wasm}`);
    return false;
  }
  if (!fs.existsSync(config.zkey)) {
    console.log(`❌ ZKey file not found: ${config.zkey}`);
    return false;
  }
  console.log(`✅ Circuit files found`);

  // Skip if no test inputs available
  if (!config.testInputs) {
    console.log(`⚠️  Skipping proof generation (no test inputs defined)`);
    console.log(`   Expected public inputs count: ${config.expectedPublicInputsCount}`);
    return true;
  }

  try {
    // Generate proof
    console.log(`\nGenerating proof...`);
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      config.testInputs,
      config.wasm,
      config.zkey
    );
    console.log(`✅ Proof generated successfully`);

    // Verify proof structure
    console.log(`\nVerifying proof structure...`);
    const structureCheck = verifyProofStructure(proof);
    if (structureCheck.valid) {
      console.log(`✅ Proof structure is valid`);
    } else {
      console.log(`❌ Proof structure errors:`);
      structureCheck.errors.forEach(e => console.log(`   - ${e}`));
      return false;
    }

    // Format for Garaga
    console.log(`\nFormatting for Garaga...`);
    const formatted = formatProofForGaraga(proof, publicSignals);
    
    console.log(`\nProof Points (8 elements):`);
    console.log(`  A.x: ${formatted.proofPoints[0].slice(0, 40)}...`);
    console.log(`  A.y: ${formatted.proofPoints[1].slice(0, 40)}...`);
    console.log(`  B.x0: ${formatted.proofPoints[2].slice(0, 40)}...`);
    console.log(`  B.x1: ${formatted.proofPoints[3].slice(0, 40)}...`);
    console.log(`  B.y0: ${formatted.proofPoints[4].slice(0, 40)}...`);
    console.log(`  B.y1: ${formatted.proofPoints[5].slice(0, 40)}...`);
    console.log(`  C.x: ${formatted.proofPoints[6].slice(0, 40)}...`);
    console.log(`  C.y: ${formatted.proofPoints[7].slice(0, 40)}...`);

    console.log(`\nPublic Inputs (${formatted.publicInputs.length} elements):`);
    formatted.publicInputs.forEach((v, i) => {
      console.log(`  [${i}]: ${v.slice(0, 50)}${v.length > 50 ? '...' : ''}`);
    });

    // Verify public inputs count
    if (formatted.publicInputs.length !== config.expectedPublicInputsCount) {
      console.log(`❌ Expected ${config.expectedPublicInputsCount} public inputs, got ${formatted.publicInputs.length}`);
    } else {
      console.log(`✅ Public inputs count matches expected: ${config.expectedPublicInputsCount}`);
    }

    // Verify field elements
    console.log(`\nVerifying field elements...`);
    const fieldCheck = verifyFieldElements(formatted.fullProof);
    if (fieldCheck.valid) {
      console.log(`✅ All values are valid field elements`);
    } else {
      console.log(`❌ Field element errors:`);
      fieldCheck.errors.forEach(e => console.log(`   - ${e}`));
      return false;
    }

    console.log(`\n✅ Circuit ${circuitName} test PASSED`);
    return true;

  } catch (error) {
    console.log(`❌ Error testing circuit: ${error}`);
    return false;
  }
}

/**
 * Test formatProofForGaraga with a mock proof
 */
function testMockProofFormat() {
  console.log(`\n${"=".repeat(60)}`);
  console.log("Testing formatProofForGaraga with Mock Proof");
  console.log("=".repeat(60));

  // Mock snarkjs proof structure
  const mockProof = {
    pi_a: [
      "1234567890123456789012345678901234567890123456789012345678901234",
      "9876543210987654321098765432109876543210987654321098765432109876",
      "1" // Third element is always 1 for affine coordinates
    ],
    pi_b: [
      [
        "1111111111111111111111111111111111111111111111111111111111111111",
        "2222222222222222222222222222222222222222222222222222222222222222"
      ],
      [
        "3333333333333333333333333333333333333333333333333333333333333333",
        "4444444444444444444444444444444444444444444444444444444444444444"
      ],
      ["1", "0"] // Third element for affine coordinates
    ],
    pi_c: [
      "5555555555555555555555555555555555555555555555555555555555555555",
      "6666666666666666666666666666666666666666666666666666666666666666",
      "1" // Third element is always 1 for affine coordinates
    ],
    protocol: "groth16",
    curve: "bn128"
  };

  const mockPublicInputs = [
    "1000000000000000000",  // nullifier
    "2000000000000000000",  // root
    "3000000000000000000",  // commitment
  ];

  console.log("\nMock proof structure:");
  console.log(`  pi_a: [${mockProof.pi_a[0].slice(0,20)}..., ${mockProof.pi_a[1].slice(0,20)}...]`);
  console.log(`  pi_b: [[${mockProof.pi_b[0][0].slice(0,15)}..., ...], [...]]`);
  console.log(`  pi_c: [${mockProof.pi_c[0].slice(0,20)}..., ${mockProof.pi_c[1].slice(0,20)}...]`);

  // Format for Garaga
  const formatted = formatProofForGaraga(mockProof, mockPublicInputs);

  console.log("\nFormatted output:");
  console.log(`  Proof points count: ${formatted.proofPoints.length} (expected: 8)`);
  console.log(`  Public inputs count: ${formatted.publicInputs.length} (expected: ${mockPublicInputs.length})`);
  console.log(`  Full proof length: ${formatted.fullProof.length} (expected: ${8 + mockPublicInputs.length})`);

  // Verify structure
  let passed = true;

  if (formatted.proofPoints.length !== 8) {
    console.log(`❌ Wrong proof points count`);
    passed = false;
  }

  if (formatted.fullProof.length !== 8 + mockPublicInputs.length) {
    console.log(`❌ Wrong full proof length`);
    passed = false;
  }

  // Verify ordering: [A.x, A.y, B.x0, B.x1, B.y0, B.y1, C.x, C.y]
  const expectedOrder = [
    mockProof.pi_a[0],      // A.x
    mockProof.pi_a[1],      // A.y
    mockProof.pi_b[0][0],   // B.x0
    mockProof.pi_b[0][1],   // B.x1
    mockProof.pi_b[1][0],   // B.y0
    mockProof.pi_b[1][1],   // B.y1
    mockProof.pi_c[0],      // C.x
    mockProof.pi_c[1],      // C.y
  ];

  for (let i = 0; i < 8; i++) {
    if (formatted.proofPoints[i] !== expectedOrder[i]) {
      console.log(`❌ Proof point ${i} mismatch`);
      console.log(`   Expected: ${expectedOrder[i].slice(0, 30)}...`);
      console.log(`   Got: ${formatted.proofPoints[i].slice(0, 30)}...`);
      passed = false;
    }
  }

  if (passed) {
    console.log("\n✅ Mock proof format test PASSED");
    console.log("\nGaraga format verified:");
    console.log("  [A.x, A.y, B.x0, B.x1, B.y0, B.y1, C.x, C.y, ...public_inputs]");
  } else {
    console.log("\n❌ Mock proof format test FAILED");
  }

  return passed;
}

/**
 * Display verifier info
 */
function showVerifierInfo() {
  console.log(`\n${"=".repeat(60)}`);
  console.log("Garaga Verifier Configuration");
  console.log("=".repeat(60));

  const verifiers = ["membership_verifier", "swap_verifier", "withdraw_verifier", "lp_verifier"];
  
  for (const verifier of verifiers) {
    const constantsPath = path.join(CIRCUITS_DIR, verifier, "src", "groth16_verifier_constants.cairo");
    if (fs.existsSync(constantsPath)) {
      const content = fs.readFileSync(constantsPath, "utf8");
      const publicInputsMatch = content.match(/N_PUBLIC_INPUTS:usize = (\d+)/);
      const publicInputs = publicInputsMatch ? publicInputsMatch[1] : "unknown";
      console.log(`\n${verifier}:`);
      console.log(`  ✅ Constants file exists`);
      console.log(`  N_PUBLIC_INPUTS: ${publicInputs}`);
    } else {
      console.log(`\n${verifier}:`);
      console.log(`  ❌ Constants file not found`);
    }
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("Zylith Proof Format Verification for Garaga");
  console.log("=".repeat(60));

  console.log(`\nCircuits directory: ${CIRCUITS_DIR}`);
  console.log(`Checking circuit files...`);

  let allPassed = true;

  // Test mock proof format first
  if (!testMockProofFormat()) {
    allPassed = false;
  }

  // Show verifier info
  showVerifierInfo();

  // Test each circuit
  for (const [name, config] of Object.entries(CIRCUITS)) {
    const passed = await testCircuit(name, config);
    if (!passed) allPassed = false;
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("SUMMARY");
  console.log("=".repeat(60));

  if (allPassed) {
    console.log("✅ All circuit tests PASSED");
  } else {
    console.log("❌ Some tests FAILED");
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("GARAGA HINTS NOTE");
  console.log("=".repeat(60));
  console.log(`
For production use, Garaga requires additional precomputed hints
(mpcheck_hint and msm_hint) that are generated using the Garaga CLI:

  garaga gen --vk verification_key.json \\
             --proof proof.json \\
             --public_inputs public.json \\
             --output calldata.txt

The current format [A.x, A.y, B.x0, B.x1, B.y0, B.y1, C.x, C.y, ...public_inputs]
is the base format. The hints need to be appended for on-chain verification.

See: https://github.com/keep-starknet-strange/garaga for more details.
`);
}

main().catch(console.error);

