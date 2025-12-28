
            const snarkjs = require('snarkjs');
            const fs = require('fs');
            
            (async () => {
                try {
                    console.log('Generating proof...');
                    const startTime = Date.now();
                    
                    const { proof, publicSignals } = await snarkjs.groth16.prove(
                        '/home/ryzen/Desktop/dev/starknet-bounty/circuits/build/zkeys/swap.zkey',
                        '/tmp/swap_witness_1766896184387207874.wtns'
                    );
                    
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
                    console.log('Proof generated in', elapsed, 'seconds');
                    
                    fs.writeFileSync('/tmp/swap_proof_1766896184387207874.json', JSON.stringify(proof, null, 2));
                    fs.writeFileSync('/tmp/swap_public_1766896184387207874.json', JSON.stringify(publicSignals, null, 2));
                } catch (error) {
                    console.error('Error:', error.message);
                    process.exit(1);
                }
            })();
            