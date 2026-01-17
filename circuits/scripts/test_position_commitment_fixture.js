#!/usr/bin/env node
/**
 * Test usando generate_test_fixtures.js que ya funciona
 * Calcula position_commitment con los mismos valores que se usan en los tests
 */
const { generatePositionCommitment } = require('../circuits/scripts/utils.js');

async function main() {
    const args = process.argv.slice(2);
    
    // Valores de prueba (puedes cambiarlos)
    const secret = args[0] ? BigInt(args[0]) : 123n; // TEST_SECRET_IN del fixture
    const tickLower = args[1] ? parseInt(args[1]) : -600;
    const tickUpper = args[2] ? parseInt(args[2]) : 600;
    
    console.log('='.repeat(70));
    console.log('🧪 Test de position_commitment (usando utils.js)');
    console.log('='.repeat(70));
    console.log(`Secret: ${secret.toString()}`);
    console.log(`Tick Lower: ${tickLower}`);
    console.log(`Tick Upper: ${tickUpper}`);
    console.log(`Expected tick_sum: ${tickLower + tickUpper}`);
    console.log();
    
    try {
        console.log('📞 Calculando position_commitment...');
        const positionCommitment = await generatePositionCommitment(secret, tickLower, tickUpper);
        const tickSum = BigInt(tickLower) + BigInt(tickUpper);
        
        console.log('✅ Cálculo exitoso');
        console.log();
        console.log('📋 Resultados:');
        console.log(`  tick_sum: ${tickSum.toString()}`);
        console.log(`  position_commitment: 0x${positionCommitment.toString(16)}`);
        console.log();
        console.log('='.repeat(70));
        
        // Output JSON for Python to parse (last line)
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

