#!/usr/bin/env node
/**
 * Test directo para calcular position_commitment
 * Usa el mismo código que generate_test_fixtures.js
 */
const { generatePositionCommitment } = require('../circuits/scripts/utils.js');

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 3) {
        console.error('Usage: node test_position_commitment_direct.js <secret> <tick_lower> <tick_upper>');
        console.error('Example: node test_position_commitment_direct.js 123 -1000 1000');
        process.exit(1);
    }
    
    const secret = BigInt(args[0]);
    const tickLower = parseInt(args[1]);
    const tickUpper = parseInt(args[2]);
    
    console.log('='.repeat(70));
    console.log('🧪 Test de position_commitment');
    console.log('='.repeat(70));
    console.log(`Secret: ${secret.toString()}`);
    console.log(`Tick Lower: ${tickLower}`);
    console.log(`Tick Upper: ${tickUpper}`);
    console.log(`Expected tick_sum: ${tickLower + tickUpper}`);
    console.log();
    
    try {
        const positionCommitment = await generatePositionCommitment(secret, tickLower, tickUpper);
        const tickSum = BigInt(tickLower) + BigInt(tickUpper);
        
        console.log('✅ Cálculo exitoso');
        console.log();
        console.log('📋 Resultados:');
        console.log(`  tick_sum: ${tickSum.toString()}`);
        console.log(`  position_commitment: 0x${positionCommitment.toString(16)}`);
        console.log();
        console.log('='.repeat(70));
        console.log('💡 Compara este position_commitment con el que espera el circuito');
        console.log('='.repeat(70));
        
        // Output JSON for Python to parse
        console.log(JSON.stringify({
            tick_sum: tickSum.toString(),
            position_commitment: `0x${positionCommitment.toString(16)}`
        }));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main();

