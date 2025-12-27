// ZK Proof generation using Circom/snarkjs
// This module will execute Circom circuits to generate proofs

use std::path::Path;
use std::fs;
use serde_json;
use tokio::process::Command;

/// Generate swap proof using rapidsnark (fast) with correct format conversion
pub async fn generate_swap_proof(
    circuits_path: &str,
    input_json: serde_json::Value,
) -> Result<SwapProof, String> {
    println!("[Proof] 🔄 Starting swap proof generation with rapidsnark...");
    let start_time = std::time::Instant::now();
    
    // Create temporary files
    let temp_dir = std::env::temp_dir();
    let timestamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)
        .unwrap().as_nanos();
    let input_file = temp_dir.join(format!("swap_input_{}.json", timestamp));
    let witness_file = temp_dir.join(format!("swap_witness_{}.wtns", timestamp));
    let proof_file = temp_dir.join(format!("swap_proof_{}.json", timestamp));
    let public_file = temp_dir.join(format!("swap_public_{}.json", timestamp));
    
    fs::write(&input_file, serde_json::to_string_pretty(&input_json).unwrap())
        .map_err(|e| format!("Failed to write input file: {}", e))?;
    
    println!("[Proof] 📝 Input file created: {:?}", input_file);
    
    // Paths to circuit files
    let circuits_dir = Path::new(circuits_path).canonicalize()
        .map_err(|e| format!("Failed to canonicalize circuits path: {}", e))?;
    let wasm_path = circuits_dir.join("build").join("swap").join("swap_js").join("swap.wasm");
    let zkey_path = circuits_dir.join("build").join("zkeys").join("swap.zkey");
    
    // Check for rapidsnark binary
    let asp_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let rapidsnark_path = asp_dir.join("bin").join("rapidsnark");
    let use_rapidsnark = rapidsnark_path.exists();
    
    if !wasm_path.exists() {
        return Err(format!("WASM file not found: {:?}", wasm_path));
    }
    if !zkey_path.exists() {
        return Err(format!("ZKey file not found: {:?}", zkey_path));
    }
    
    // Step 1: Calculate witness using snarkjs (this is fast)
    println!("[Proof] 🔧 Step 1: Calculating witness with snarkjs...");
    let witness_script = format!(
        r#"
        const snarkjs = require('snarkjs');
        const fs = require('fs');
        const path = require('path');
        
        (async () => {{
            try {{
                const input = JSON.parse(fs.readFileSync('{}', 'utf8'));
                const wasmPath = path.resolve('{}');
                
                console.log('Calculating witness...');
                const startTime = Date.now();
                
                const {{ wtns }} = await snarkjs;
                await wtns.calculate(input, wasmPath, '{}');
                
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
                console.log('Witness calculated in', elapsed, 'seconds');
            }} catch (error) {{
                console.error('Error:', error.message);
                console.error('Stack:', error.stack);
                process.exit(1);
            }}
        }})();
        "#,
        input_file.to_str().unwrap().replace('\\', "/"),
        wasm_path.to_str().unwrap().replace('\\', "/"),
        witness_file.to_str().unwrap().replace('\\', "/")
    );
    
    let script_file = circuits_dir.join(format!("witness_script_{}.js", timestamp));
    fs::write(&script_file, witness_script)
        .map_err(|e| format!("Failed to write witness script: {}", e))?;
    
    let witness_start = std::time::Instant::now();
    let witness_output = Command::new("node")
        .env("NODE_OPTIONS", "--max-old-space-size=4096")
        .arg(script_file.file_name().unwrap())
        .current_dir(&circuits_dir)
        .output()
        .await
        .map_err(|e| format!("Failed to run witness calculation: {}", e))?;
    
    let _ = fs::remove_file(&script_file);
    
    if !witness_output.status.success() {
        let stderr = String::from_utf8_lossy(&witness_output.stderr);
        let stdout = String::from_utf8_lossy(&witness_output.stdout);
        let _ = fs::remove_file(&input_file);
        return Err(format!("Witness calculation failed:\nSTDOUT: {}\nSTDERR: {}", stdout, stderr));
    }
    
    println!("[Proof] ✅ Witness calculated in {:.2}s", witness_start.elapsed().as_secs_f64());
    
    // Step 2: Generate proof (use rapidsnark if available, otherwise snarkjs)
    if use_rapidsnark {
        println!("[Proof] 🔧 Step 2: Generating proof with rapidsnark (fast C++ prover)...");
        let proof_start = std::time::Instant::now();
        
        let rapidsnark_output = Command::new(&rapidsnark_path)
            .arg(&zkey_path)
            .arg(&witness_file)
            .arg(&proof_file)
            .arg(&public_file)
            .output()
            .await
            .map_err(|e| format!("Failed to run rapidsnark: {}", e))?;
        
        if !rapidsnark_output.status.success() {
            let stderr = String::from_utf8_lossy(&rapidsnark_output.stderr);
            let stdout = String::from_utf8_lossy(&rapidsnark_output.stdout);
            let _ = fs::remove_file(&input_file);
            let _ = fs::remove_file(&witness_file);
            return Err(format!("rapidsnark failed:\nSTDOUT: {}\nSTDERR: {}", stdout, stderr));
        }
        
        println!("[Proof] ✅ Proof generated with rapidsnark in {:.2}s", proof_start.elapsed().as_secs_f64());
    } else {
        println!("[Proof] 🔧 Step 2: Generating proof with snarkjs (fallback)...");
        let proof_script = format!(
            r#"
            const snarkjs = require('snarkjs');
            const fs = require('fs');
            
            (async () => {{
                try {{
                    console.log('Generating proof...');
                    const startTime = Date.now();
                    
                    const {{ proof, publicSignals }} = await snarkjs.groth16.prove(
                        '{}',
                        '{}'
                    );
                    
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
                    console.log('Proof generated in', elapsed, 'seconds');
                    
                    fs.writeFileSync('{}', JSON.stringify(proof, null, 2));
                    fs.writeFileSync('{}', JSON.stringify(publicSignals, null, 2));
                }} catch (error) {{
                    console.error('Error:', error.message);
                    process.exit(1);
                }}
            }})();
            "#,
            zkey_path.to_str().unwrap().replace('\\', "/"),
            witness_file.to_str().unwrap().replace('\\', "/"),
            proof_file.to_str().unwrap().replace('\\', "/"),
            public_file.to_str().unwrap().replace('\\', "/")
        );
        
        let script_file2 = circuits_dir.join(format!("proof_script_{}.js", timestamp));
        fs::write(&script_file2, proof_script)
            .map_err(|e| format!("Failed to write proof script: {}", e))?;
        
        let proof_start = std::time::Instant::now();
        let mut child = Command::new("node")
            .env("NODE_OPTIONS", "--max-old-space-size=8192")
            .arg(script_file2.file_name().unwrap())
            .current_dir(&circuits_dir)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn node: {}", e))?;
        
        // Wait with progress updates
        let mut last_log = std::time::Instant::now();
        let output = loop {
            match child.try_wait() {
                Ok(Some(_)) => {
                    let output = child.wait_with_output().await
                        .map_err(|e| format!("Failed to get output: {}", e))?;
                    break output;
                }
                Ok(None) => {
                    if last_log.elapsed().as_secs() >= 30 {
                        println!("[Proof] ⏳ Still processing... ({}s elapsed)", proof_start.elapsed().as_secs());
                        last_log = std::time::Instant::now();
                    }
                    tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
                }
                Err(e) => return Err(format!("Error waiting: {}", e)),
            }
        };
        
        let _ = fs::remove_file(&script_file2);
        
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let stdout = String::from_utf8_lossy(&output.stdout);
            return Err(format!("snarkjs proof failed:\nSTDOUT: {}\nSTDERR: {}", stdout, stderr));
        }
        
        println!("[Proof] ✅ Proof generated with snarkjs in {:.2}s", proof_start.elapsed().as_secs_f64());
    }
    
    // Step 3: Add protocol field to proof (required by convert_garaga.py script)
    println!("[Proof] 🔧 Step 3: Adding protocol field to proof...");
    let add_protocol_script = format!(
        r#"
        const fs = require('fs');
        const proof = JSON.parse(fs.readFileSync('{}', 'utf8'));
        
        // Add protocol field if not present (required by convert_garaga.py)
        if (!proof.protocol) {{
            proof.protocol = "groth16";
        }}
        
        // Ensure pi_a, pi_b, pi_c are in correct format (remove extra elements)
        if (proof.pi_a && proof.pi_a.length > 2) {{
            proof.pi_a = [proof.pi_a[0], proof.pi_a[1]];
        }}
        if (proof.pi_b && proof.pi_b.length > 2) {{
            proof.pi_b = [proof.pi_b[0], proof.pi_b[1]];
        }}
        if (proof.pi_c && proof.pi_c.length > 2) {{
            proof.pi_c = [proof.pi_c[0], proof.pi_c[1]];
        }}
        
        fs.writeFileSync('{}', JSON.stringify(proof, null, 2));
        "#,
        proof_file.to_str().unwrap().replace('\\', "/"),
        proof_file.to_str().unwrap().replace('\\', "/")
    );
    
    let protocol_file = circuits_dir.join(format!("add_protocol_{}.js", timestamp));
    fs::write(&protocol_file, add_protocol_script)
        .map_err(|e| format!("Failed to write protocol script: {}", e))?;
    
    let protocol_output = Command::new("node")
        .arg(protocol_file.file_name().unwrap())
        .current_dir(&circuits_dir)
        .output()
        .await
        .map_err(|e| format!("Failed to run protocol script: {}", e))?;
    
    let _ = fs::remove_file(&protocol_file);
    
    if !protocol_output.status.success() {
        let stderr = String::from_utf8_lossy(&protocol_output.stderr);
        return Err(format!("Failed to add protocol field: {}", stderr));
    }
    
    println!("[Proof] ✅ Protocol field added to proof");
    
    // Step 4: Convert proof to Garaga format and generate calldata using Python script
    println!("[Proof] 🔧 Step 4: Converting proof to Garaga format and generating calldata...");
    let garaga_start = std::time::Instant::now();
    
    // Get script path (relative to project root)
    let project_root = Path::new(env!("CARGO_MANIFEST_DIR")).parent()
        .ok_or("Failed to get project root")?;
    let script_path = project_root.join("scripts").join("convert_garaga.py");
    
    if !script_path.exists() {
        return Err(format!("Garaga conversion script not found: {:?}", script_path));
    }
    
    // Call Python script to convert proof and generate calldata directly
    let script_output = Command::new("python3")
        .arg(&script_path)
        .arg(&proof_file)
        .output()
        .await
        .map_err(|e| format!("Failed to run convert_garaga.py script: {}", e))?;
    
    if !script_output.status.success() {
        let stderr = String::from_utf8_lossy(&script_output.stderr);
        let stdout = String::from_utf8_lossy(&script_output.stdout);
        println!("[Proof] ❌ Python script failed.");
        println!("[Proof] 📋 STDERR:\n{}", stderr);
        println!("[Proof] 📋 STDOUT:\n{}", stdout);
        println!("[Proof] 💾 Proof saved at: {:?}", proof_file);
        
        let _ = fs::remove_file(&input_file);
        let _ = fs::remove_file(&witness_file);
        let _ = fs::remove_file(&public_file);
        
        return Err(format!(
            "Garaga conversion script failed.\n\
             STDERR: {}\n\
             STDOUT: {}\n\
             \n\
             Proof file at: {:?}",
            stderr, stdout, proof_file
        ));
    }
    
    // Parse calldata from script output (JSON array)
    let script_stdout = String::from_utf8_lossy(&script_output.stdout);
    let proof_calldata: Vec<String> = serde_json::from_str(script_stdout.trim())
        .map_err(|e| format!("Failed to parse calldata from script: {}. Output: {}", e, script_stdout))?;
    
    println!("[Proof] ✅ Garaga calldata generated in {:.2}s", garaga_start.elapsed().as_secs_f64());
    println!("[Proof]    Proof calldata length: {} elements", proof_calldata.len());
    
    // Read public signals for the response
    let public_signals: Vec<serde_json::Value> = serde_json::from_str(
        &fs::read_to_string(&public_file)
            .map_err(|e| format!("Failed to read public signals: {}", e))?
    ).map_err(|e| format!("Failed to parse public signals: {}", e))?;
    
    // Apply felt252 modulo to public inputs to prevent overflow
    // STARKNET_FELT_MAX = 2^251 + 17 * 2^192 + 1
    use num_bigint::BigUint;
    use num_traits::Num;
    use std::str::FromStr;
    let felt_max_str = "3618502788666131106986593281521497120414687020801267626233049500247285301248";
    let felt_max_big = BigUint::from_str(felt_max_str)
        .map_err(|_| "Failed to parse FELT_MAX constant".to_string())?;
    
    // Read public signals and apply felt252 modulo
    let public_inputs: Vec<String> = public_signals
        .iter()
        .map(|s| {
            let value_str = s.as_str().unwrap();
            // Parse as BigUint (handles both hex and decimal)
            let value_big = if value_str.starts_with("0x") {
                BigUint::from_str_radix(&value_str[2..], 16)
                    .unwrap_or_else(|_| BigUint::from(0u8))
            } else {
                BigUint::from_str(value_str)
                    .unwrap_or_else(|_| BigUint::from(0u8))
            };
            
            // Apply felt252 modulo if value exceeds limit
            let modulo_big = if value_big >= felt_max_big {
                &value_big % &felt_max_big
            } else {
                value_big.clone()
            };
            
            // Convert to string (decimal format for felt252)
            modulo_big.to_string()
        })
        .collect();
    
    // Proof calldata should only contain the 8 proof elements (A.x, A.y, B.x0, B.x1, B.y0, B.y1, C.x, C.y)
    // Public inputs are returned separately
    // The contract expects: proof (8 elements) and public_inputs (9 elements) as separate arrays
    let proof_len = proof_calldata.len();
    
    println!("[Proof]    Proof calldata length: {} elements (should be 8)", proof_len);
    println!("[Proof]    Public inputs length: {} elements (should be 9)", public_inputs.len());
    
    // Verify proof has exactly 8 elements
    if proof_len != 8 {
        return Err(format!("Invalid proof length: expected 8 elements, got {}", proof_len));
    }
    
    // Clean up temp files
    let _ = fs::remove_file(&input_file);
    let _ = fs::remove_file(&witness_file);
    let _ = fs::remove_file(&proof_file);
    let _ = fs::remove_file(&public_file);
    
    let elapsed = start_time.elapsed().as_secs_f64();
    println!("[Proof] ✅ Total proof time: {:.2}s ({})", elapsed, 
        if use_rapidsnark { "with rapidsnark" } else { "with snarkjs" });
    
    Ok(SwapProof {
        proof: proof_calldata, // Only the 8 proof elements, not combined with public inputs
        public_inputs,
    })
}

/// Normalize rapidsnark proof format to snarkjs format for Garaga
/// snarkjs format: { pi_a: [x, y], pi_b: [[x0, x1], [y0, y1]], pi_c: [x, y] }
/// NO protocol, NO curve fields - Garaga detects curve from VK
fn normalize_proof_for_garaga(proof: serde_json::Value) -> Result<serde_json::Value, String> {
    let mut normalized = serde_json::Map::new();
    
    // Extract and normalize pi_a
    // snarkjs format: [x, y] (2 elements)
    // rapidsnark format: [x, y, "1"] (3 elements)
    // Garaga expects snarkjs format (2 elements)
    if let Some(pi_a) = proof.get("pi_a").and_then(|v| v.as_array()) {
        if pi_a.len() >= 2 {
            let mut pi_a_normalized = Vec::new();
            pi_a_normalized.push(pi_a[0].clone());
            pi_a_normalized.push(pi_a[1].clone());
            // Always use 2 elements (snarkjs format) - remove "1" if present
            normalized.insert("pi_a".to_string(), serde_json::Value::Array(pi_a_normalized));
        } else {
            return Err(format!("Invalid pi_a format: expected at least 2 elements, got {}", pi_a.len()));
        }
    } else {
        return Err("Missing pi_a".to_string());
    }
    
    // Extract and normalize pi_b
    // rapidsnark may output pi_b as nested arrays [[x0, x1], [y0, y1], [1, 0]]
    // or as a flat array [x0, x1, y0, y1, 1, 0]
    if let Some(pi_b) = proof.get("pi_b").and_then(|v| v.as_array()) {
        let mut pi_b_normalized = Vec::new();
        
        if pi_b.len() >= 2 {
            // Check if first element is an array (nested format)
            if let Some(b_x) = pi_b[0].as_array() {
                // Nested format: [[x0, x1], [y0, y1], ...]
                if b_x.len() >= 2 {
                    let mut b_x_normalized = Vec::new();
                    // CRITICAL: rapidsnark exports as [imaginario, real] but Garaga expects [real, imaginario]
                    // Swap coordinates: [a, b] -> [b, a]
                    b_x_normalized.push(b_x[1].clone()); // real
                    b_x_normalized.push(b_x[0].clone()); // imaginario
                    pi_b_normalized.push(serde_json::Value::Array(b_x_normalized));
                } else {
                    return Err("Invalid pi_b[0] format: expected at least 2 elements".to_string());
                }
                
                if pi_b.len() >= 2 {
                    if let Some(b_y) = pi_b[1].as_array() {
                        if b_y.len() >= 2 {
                            let mut b_y_normalized = Vec::new();
                            // CRITICAL: Swap coordinates for Garaga compatibility
                            b_y_normalized.push(b_y[1].clone()); // real
                            b_y_normalized.push(b_y[0].clone()); // imaginario
                            pi_b_normalized.push(serde_json::Value::Array(b_y_normalized));
                        } else {
                            return Err("Invalid pi_b[1] format: expected at least 2 elements".to_string());
                        }
                    } else {
                        return Err("pi_b[1] is not an array".to_string());
                    }
                }
            } else if pi_b.len() >= 6 {
                // Flat format: [x0, x1, y0, y1, 1, 0]
                // CRITICAL: Swap coordinates for Garaga compatibility
                let mut b_x_normalized = Vec::new();
                b_x_normalized.push(pi_b[1].clone()); // real (swap)
                b_x_normalized.push(pi_b[0].clone()); // imaginario (swap)
                pi_b_normalized.push(serde_json::Value::Array(b_x_normalized));
                
                let mut b_y_normalized = Vec::new();
                b_y_normalized.push(pi_b[3].clone()); // real (swap)
                b_y_normalized.push(pi_b[2].clone()); // imaginario (swap)
                pi_b_normalized.push(serde_json::Value::Array(b_y_normalized));
            } else {
                return Err(format!("Invalid pi_b format: expected nested arrays or 6+ elements, got {} elements", pi_b.len()));
            }
        } else {
            return Err(format!("Invalid pi_b format: expected at least 2 elements, got {}", pi_b.len()));
        }
        
        normalized.insert("pi_b".to_string(), serde_json::Value::Array(pi_b_normalized));
    } else {
        return Err("Missing pi_b".to_string());
    }
    
    // Extract and normalize pi_c
    // snarkjs format: [x, y] (2 elements)
    // rapidsnark format: [x, y, "1"] (3 elements)
    // Garaga expects snarkjs format (2 elements)
    if let Some(pi_c) = proof.get("pi_c").and_then(|v| v.as_array()) {
        if pi_c.len() >= 2 {
            let mut pi_c_normalized = Vec::new();
            pi_c_normalized.push(pi_c[0].clone());
            pi_c_normalized.push(pi_c[1].clone());
            // Always use 2 elements (snarkjs format) - remove "1" if present
            normalized.insert("pi_c".to_string(), serde_json::Value::Array(pi_c_normalized));
        } else {
            return Err(format!("Invalid pi_c format: expected at least 2 elements, got {}", pi_c.len()));
        }
    } else {
        return Err("Missing pi_c".to_string());
    }
    
    // snarkjs proof format does NOT include 'protocol' or 'curve' fields
    // Garaga detects the curve from the VK file
    // So we should NOT include these fields to match snarkjs format exactly
    
    Ok(serde_json::Value::Object(normalized))
}

/// Parse Garaga CLI array output format
/// Garaga can output in different formats, we support the "array" format
fn parse_garaga_array_output(output: &str) -> Result<Vec<String>, String> {
    // Garaga array format output looks like:
    // [0x123, 0x456, ...] or array elements on separate lines
    let trimmed = output.trim();
    
    // Try parsing as JSON array first
    if trimmed.starts_with('[') && trimmed.ends_with(']') {
        // Remove brackets and split by comma
        let inner = &trimmed[1..trimmed.len()-1];
        let values: Vec<String> = inner
            .split(',')
            .map(|s| {
                let s = s.trim();
                // Remove quotes if present
                if s.starts_with('"') && s.ends_with('"') {
                    s[1..s.len()-1].to_string()
                } else {
                    s.to_string()
                }
            })
            .filter(|s| !s.is_empty())
            .collect();
        
        if values.is_empty() {
            return Err("Garaga output is empty".to_string());
        }
        
        return Ok(values);
    }
    
    // Try parsing line by line (snforge format)
    let lines: Vec<String> = trimmed
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty() && !l.starts_with('#') && !l.starts_with("//"))
        .collect();
    
    if !lines.is_empty() {
        return Ok(lines);
    }
    
    Err(format!("Failed to parse Garaga output: {}", trimmed))
}

/// Generate withdraw proof using Circom circuit
pub async fn generate_withdraw_proof(
    _circuits_path: &str,
    _inputs: WithdrawProofInputs,
) -> Result<WithdrawProof, String> {
    // TODO: Implement Circom proof generation
    Err("Withdraw proof generation not yet implemented".to_string())
}

/// Generate mint liquidity proof using Circom circuit
pub async fn generate_mint_liquidity_proof(
    _circuits_path: &str,
    _inputs: MintProofInputs,
) -> Result<LiquidityProof, String> {
    // TODO: Implement Circom proof generation
    Err("Mint liquidity proof generation not yet implemented".to_string())
}

/// Generate burn liquidity proof using Circom circuit
pub async fn generate_burn_liquidity_proof(
    _circuits_path: &str,
    _inputs: BurnProofInputs,
) -> Result<LiquidityProof, String> {
    // TODO: Implement Circom proof generation
    Err("Burn liquidity proof generation not yet implemented".to_string())
}

/// Format proof for Garaga verifier
/// Garaga expects proof as array of felt252
pub fn format_proof_for_garaga(_proof: &SwapProof) -> Vec<String> {
    // TODO: Convert Groth16 proof format to Garaga format
    // Garaga expects: [A.x, A.y, B.x0, B.x1, B.y0, B.y1, C.x, C.y, ...public_inputs]
    vec![]
}

// Input/Output structures

pub struct SwapProofInputs {
    pub secret: String,
    pub nullifier: String,
    pub amount: u128,
    pub merkle_path: Vec<String>,
    pub merkle_path_indices: Vec<u32>,
    pub root: String,
    pub new_secret: String,
    pub new_nullifier: String,
    pub new_amount: u128,
    // Swap-specific
    pub zero_for_one: bool,
    pub amount_specified: u128,
    pub sqrt_price_limit: Option<(u128, u128)>,
}

pub struct WithdrawProofInputs {
    pub secret: String,
    pub nullifier: String,
    pub amount: u128,
    pub merkle_path: Vec<String>,
    pub merkle_path_indices: Vec<u32>,
    pub root: String,
    pub recipient: String,
    pub token_address: String,
}

pub struct MintProofInputs {
    pub secret: String,
    pub nullifier: String,
    pub amount: u128,
    pub merkle_path: Vec<String>,
    pub merkle_path_indices: Vec<u32>,
    pub root: String,
    pub tick_lower: i32,
    pub tick_upper: i32,
    pub liquidity: u128,
    pub new_secret: String,
    pub new_nullifier: String,
    pub new_amount: u128,
}

pub struct BurnProofInputs {
    pub secret: String,
    pub nullifier: String,
    pub amount: u128,
    pub merkle_path: Vec<String>,
    pub merkle_path_indices: Vec<u32>,
    pub root: String,
    pub tick_lower: i32,
    pub tick_upper: i32,
    pub liquidity: u128,
    pub new_secret: String,
    pub new_nullifier: String,
    pub new_amount: u128,
}

pub struct SwapProof {
    pub proof: Vec<String>, // Groth16 proof formatted for Garaga
    pub public_inputs: Vec<String>,
}

pub struct WithdrawProof {
    pub proof: Vec<String>,
    pub public_inputs: Vec<String>,
}

pub struct LiquidityProof {
    pub proof: Vec<String>,
    pub public_inputs: Vec<String>,
}

