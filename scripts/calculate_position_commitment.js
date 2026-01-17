#!/usr/bin/env node
/**
 * Script para calcular position_commitment de la misma manera que el circuito
 * Usa la misma lógica que circuits/scripts/utils.js generatePositionCommitment
 * 
 * Usage: node calculate_position_commitment.js <secret_hex> <tick_lower> <tick_upper>
 * Example: node calculate_position_commitment.js 0x1234... -1000 1000
 */

const path = require('path');

// Get paths - script is in scripts/, circuits is sibling directory
// __dirname is available in Node.js CommonJS modules
const scriptDir = __dirname; // /path/to/project/scripts
const projectRoot = path.dirname(scriptDir); // /path/to/project
const circuitsDir = path.join(projectRoot, 'circuits'); // /path/to/project/circuits

// Load utils from circuits/scripts/utils.js
const utilsPath = path.join(circuitsDir, 'scripts', 'utils.js');
const { generatePositionCommitment } = require(utilsPath);

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 3) {
        console.error('Usage: node calculate_position_commitment.js <secret_hex> <tick_lower> <tick_upper>');
        console.error('Example: node calculate_position_commitment.js 0x1234... -1000 1000');
        process.exit(1);
    }
    
    const secret = args[0];
    const tickLower = parseInt(args[1]);
    const tickUpper = parseInt(args[2]);
    
    if (isNaN(tickLower) || isNaN(tickUpper)) {
        console.error('Error: tick_lower and tick_upper must be valid integers');
        process.exit(1);
    }
    
    try {
        // Convert secret to BigInt (handle hex strings)
        const secretBigInt = secret.startsWith('0x') 
            ? BigInt(secret) 
            : BigInt(secret);
        
        // Calculate position commitment using the same logic as the circuit
        const positionCommitment = await generatePositionCommitment(secretBigInt, tickLower, tickUpper);
        const tickSum = BigInt(tickLower) + BigInt(tickUpper);
        
        // Output JSON for Rust to parse (last line only)
        console.log(JSON.stringify({
            tick_sum: tickSum.toString(),
            position_commitment: `0x${positionCommitment.toString(16)}`
        }));
        
    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});

