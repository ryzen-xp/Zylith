mod abi;
mod blockchain;
mod calldata;
mod commitment;
mod merkle;
mod proof;
mod syncer;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use blockchain::BlockchainClient;
use calldata::{
    build_approve_calldata, build_burn_liquidity_calldata, build_deposit_calldata,
    build_initialize_calldata, build_mint_liquidity_calldata, build_swap_calldata,
    build_withdraw_calldata, u256_to_low_high,
};
use num_bigint::BigUint;
use std::str::FromStr;
use commitment::{generate_commitment, generate_note};
use merkle::{MerkleProof, MerkleTree, TREE_DEPTH};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use syncer::Syncer;
use tower_http::cors::{Any, CorsLayer};

/// Application state with two Merkle trees and blockchain client
#[derive(Clone)]
struct AppState {
    /// Tree for deposit commitments (from on-chain events)
    deposit_tree: Arc<Mutex<MerkleTree>>,
    /// Tree for associated set (for compliance/subset proofs)
    associated_tree: Arc<Mutex<MerkleTree>>,
    /// Blockchain client for reading on-chain state
    blockchain: Arc<BlockchainClient>,
    /// Zylith contract address
    zylith_address: String,
}

/// Response for tree info
#[derive(Serialize)]
struct TreeInfo {
    root: String,
    leaf_count: u32,
    depth: usize,
}

/// Request to insert into associated set
#[derive(Deserialize)]
struct InsertRequest {
    commitment: String,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    // Get configuration from environment
    let rpc_url = std::env::var("RPC_URL")
        .unwrap_or_else(|_| "https://api.cartridge.gg/x/starknet/sepolia".to_string());
    let contract_address = std::env::var("CONTRACT_ADDRESS").unwrap_or_else(|_| {
        "0x002c6ced7ef107e71fb10b6b04b301d52116ab1803b19a0b88b35874d207db1d".to_string()
    });

    // Validate ABIs on startup
    let zylith_abi = abi::get_zylith_abi();
    abi::validate_zylith_abi(zylith_abi)
        .expect("Zylith ABI validation failed");
    
    let erc20_abi = abi::get_erc20_abi();
    abi::validate_erc20_abi(erc20_abi)
        .expect("ERC20 ABI validation failed");

    println!("✓ ABIs validated successfully");

    // Initialize blockchain client
    let blockchain = Arc::new(
        BlockchainClient::new(&rpc_url, &contract_address)
            .expect("Failed to initialize blockchain client"),
    );

    // Initialize both trees
    let deposit_tree = Arc::new(Mutex::new(MerkleTree::new(TREE_DEPTH)));
    let associated_tree = Arc::new(Mutex::new(MerkleTree::new(TREE_DEPTH)));

    let state = AppState {
        deposit_tree: deposit_tree.clone(),
        associated_tree: associated_tree.clone(),
        blockchain: blockchain.clone(),
        zylith_address: contract_address.clone(),
    };

    // Initialize Syncer for deposit tree with blockchain client for root verification
    let syncer = Syncer::new(&rpc_url, &contract_address, deposit_tree)
        .with_blockchain_client(blockchain.clone());
    
    // Run syncer in background
    tokio::spawn(async move {
        syncer.run().await;
    });

    // Configure CORS
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        // Deposit tree endpoints
        .route("/deposit/proof/:index", get(get_deposit_proof))
        .route("/deposit/root", get(get_deposit_root))
        .route("/deposit/info", get(get_deposit_info))
        .route("/deposit/index/:commitment", get(get_deposit_index))
        .route("/deposit/resync", post(force_resync))
        .route("/deposit/list", get(list_deposits))
        // Associated set tree endpoints
        .route("/associated/proof/:index", get(get_associated_proof))
        .route("/associated/root", get(get_associated_root))
        .route("/associated/info", get(get_associated_info))
        .route("/associated/insert", post(insert_associated))
        // Legacy endpoints (for backwards compatibility)
        .route("/proof/:index", get(get_deposit_proof))
        .route("/root", get(get_deposit_root))
        // Blockchain read endpoints
        .route("/api/pool/root", get(get_pool_root))
        .route("/api/pool/info", get(get_pool_info))
        .route("/api/nullifier/:nullifier", get(check_nullifier))
        .route("/api/token/:address/balance/:owner", get(get_token_balance))
        .route("/api/token/:address/allowance/:owner/:spender", get(get_token_allowance))
        .route("/api/pool/initialized", get(check_pool_initialized))
        // Transaction preparation endpoints
        .route("/api/deposit/prepare", post(prepare_deposit))
        .route("/api/swap/prepare", post(prepare_swap))
        .route("/api/withdraw/prepare", post(prepare_withdraw))
        .route("/api/liquidity/mint/prepare", post(prepare_mint_liquidity))
        .route("/api/liquidity/burn/prepare", post(prepare_burn_liquidity))
        .route("/api/initialize/prepare", post(prepare_initialize))
        // ZK Proof generation endpoints
        .route("/api/proof/swap", post(generate_swap_proof_endpoint))
        // Health check
        .route("/health", get(health_check))
        .layer(cors)
        .with_state(state);

    let port = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let addr = format!("0.0.0.0:{}", port);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    println!("ASP Server running on {}", addr);
    println!("Zylith Contract: {}", contract_address);
    println!("RPC URL: {}", rpc_url);
    println!("\nEndpoints:");
    println!("  GET  /deposit/proof/:index  - Get Merkle proof for deposit");
    println!("  GET  /deposit/root          - Get current deposit tree root");
    println!("  GET  /deposit/info          - Get deposit tree info");
    println!("  GET  /deposit/index/:commitment - Get leaf index for commitment");
    println!("  POST /deposit/resync        - Force re-sync from specific block");
    println!("  GET  /associated/proof/:index - Get Merkle proof for associated set");
    println!("  GET  /associated/root       - Get current associated set root");
    println!("  GET  /associated/info       - Get associated set tree info");
    println!("  POST /associated/insert     - Insert commitment into associated set");
    println!("  GET  /api/pool/root         - Get Merkle root on-chain");
    println!("  GET  /api/pool/info         - Get pool info");
    println!("  GET  /api/nullifier/:nullifier - Check if nullifier is spent");
    println!("  GET  /api/token/:address/balance/:owner - Get token balance");
    println!("  GET  /api/token/:address/allowance/:owner/:spender - Get token allowance");
    println!("  POST /api/deposit/prepare    - Prepare deposit transaction");
    println!("  POST /api/swap/prepare      - Prepare swap transaction");
    println!("  POST /api/withdraw/prepare  - Prepare withdraw transaction");
    println!("  POST /api/liquidity/mint/prepare - Prepare mint liquidity transaction");
    println!("  POST /api/liquidity/burn/prepare - Prepare burn liquidity transaction");
    println!("  GET  /health                - Health check");

    axum::serve(listener, app).await.unwrap();
}

// ==================== Deposit Tree Endpoints ====================

async fn get_deposit_proof(
    Path(index): Path<u32>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    println!("[ASP] 📥 GET /deposit/proof/{}", index);
    println!("[ASP] 🔄 Processing proof request for index {}...", index);
    
    let tree = state.deposit_tree.lock().unwrap();
    let leaf_count = tree.get_leaf_count();

    match tree.get_proof(index) {
        Some(proof) => {
            println!("[ASP] ✅ Proof generated successfully for index {}", index);
            println!("[ASP]    Root: {}", proof.root);
            println!("[ASP]    Path length: {}", proof.path.len());
            println!("[ASP]    Leaf: {}", proof.leaf);
            println!("[ASP] 📤 Sending proof response to client...");
            println!("[ASP]    Response data: root={}, leaf={}, path_len={}, path_indices_len={}", 
                proof.root, proof.leaf, proof.path.len(), proof.path_indices.len());
            let response = Json(proof).into_response();
            println!("[ASP] ✅ Proof response sent successfully (status 200)");
            response
        },
        None => {
            println!("[ASP] ❌ Proof generation failed - leaf not found at index {}", index);
            println!("[ASP]    Tree has {} leaves (indices 0-{})", leaf_count, leaf_count.saturating_sub(1));
            (StatusCode::NOT_FOUND, Json(serde_json::json!({
                "error": "Leaf not found at index",
                "index": index,
                "tree_leaf_count": leaf_count,
                "valid_indices": if leaf_count > 0 { format!("0-{}", leaf_count - 1) } else { "none".to_string() }
            }))).into_response()
        },
    }
}

async fn get_deposit_root(State(state): State<AppState>) -> impl IntoResponse {
    let tree = state.deposit_tree.lock().unwrap();
    let root = tree.get_root();
    Json(format!("0x{:x}", root))
}

async fn get_deposit_info(State(state): State<AppState>) -> impl IntoResponse {
    println!("[ASP] 📥 GET /deposit/info");
    let tree = state.deposit_tree.lock().unwrap();
    let leaf_count = tree.get_leaf_count();
    
    // Log sample commitments for debugging (first 5) - only when explicitly requested
    if leaf_count > 0 {
        println!("[ASP] 📊 Tree status: {} leaves", leaf_count);
        for i in 0..leaf_count.min(5) {
            if let Some(leaf) = tree.nodes.get(&(0, i)) {
                println!("  [{}]: 0x{:x}", i, leaf);
            }
        }
    } else {
        println!("⚠️  Tree is empty - no deposits synced yet");
    }
    
    Json(TreeInfo {
        root: format!("0x{:x}", tree.get_root()),
        leaf_count,
        depth: tree.depth,
    })
}

/// Force re-sync from a specific block
/// This will reset the syncer state and start syncing from the specified block
/// Body: { "from_block": 4438440 } (optional, defaults to contract deployment block)
async fn force_resync(
    Json(payload): Json<serde_json::Value>,
) -> impl IntoResponse {
    use std::fs;
    
    println!("\n[ASP] ========================================");
    println!("[ASP] 🔄 POST /deposit/resync - Force re-sync requested");
    println!("[ASP] ========================================");
    
    let block_number = payload.get("from_block")
        .and_then(|v| v.as_u64())
        .unwrap_or(4438440); // Default to contract deployment block
    
    println!("[ASP] 📋 Resetting sync state to block {}", block_number);
    
    let state = serde_json::json!({
        "last_synced_block": block_number
    });
    
    if let Ok(json) = serde_json::to_string(&state) {
        if let Err(e) = fs::write("asp_state.json", json) {
            println!("[ASP] ❌ Failed to write state: {}", e);
            println!("[ASP] ========================================\n");
            return (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to write state: {}", e)).into_response();
        }
    } else {
        println!("[ASP] ❌ Failed to serialize state");
        println!("[ASP] ========================================\n");
        return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to serialize state").into_response();
    }
    
    println!("[ASP] ✅ State file updated successfully");
    println!("[ASP] ⚠️  IMPORTANT: Restart the ASP server for changes to take effect");
    println!("[ASP] ========================================\n");
    
    Json(serde_json::json!({
        "success": true,
        "message": format!("Re-sync will start from block {}", block_number),
        "note": "Restart the ASP server for changes to take effect"
    })).into_response()
}

async fn get_deposit_index(
    Path(commitment): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    use num_bigint::BigUint;
    use num_traits::Num;

    // Parse commitment from hex string
    let commitment_str = commitment.trim_start_matches("0x");
    let commitment_bigint = match BigUint::from_str_radix(commitment_str, 16) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Failed to parse commitment '{}': {:?}", commitment_str, e);
            return (StatusCode::BAD_REQUEST, format!("Invalid commitment format: {}", e)).into_response()
        }
    };

    println!("\n[ASP] ========================================");
    println!("[ASP] 🔍 GET /deposit/index/{}", commitment_str.chars().take(20).collect::<String>());
    println!("[ASP] ========================================");
    
    // First, check local tree (fast path)
    let (found_locally, leaf_count) = {
        let tree = state.deposit_tree.lock().unwrap();
        let leaf_count = tree.get_leaf_count();
        let found = tree.find_commitment_index(&commitment_bigint).is_some();
        (found, leaf_count)
    };
    
    println!("[ASP] 📊 Local tree status: {} leaves, found locally: {}", leaf_count, found_locally);
    
    if found_locally {
        let tree = state.deposit_tree.lock().unwrap();
        if let Some(index) = tree.find_commitment_index(&commitment_bigint) {
            println!("[ASP] ✅ Found commitment in local tree at index {}", index);
            println!("[ASP] ========================================\n");
            return Json(serde_json::json!({
                "index": index,
                "found": true,
                "source": "local_tree"
            })).into_response();
        }
    }
    
    // Not found locally - search in contract events directly (fast lookup)
    println!("[ASP] 🔍 Commitment not in local tree. Searching in contract events...");
    
    match state.blockchain.find_commitment_in_events(&format!("0x{:x}", commitment_bigint)).await {
        Ok(Some(index)) => {
            println!("[ASP] ✅ Found commitment in events at index {}. Adding to local tree...", index);
            
            // Add to local tree for future queries
            // Get zero_leaf first (before acquiring mutable lock)
            let (current_count, zero_leaf) = {
                let tree = state.deposit_tree.lock().unwrap();
                (tree.get_leaf_count(), tree.zeros[0].clone())
            };
            
            // Now acquire mutable lock and do all operations
            let mut tree = state.deposit_tree.lock().unwrap();
            
            // Handle gaps if needed
            if index > current_count {
                let gaps = index - current_count;
                println!("   Filling {} gap(s) before index {}", gaps, index);
                for i in 0..gaps {
                    tree.insert_at_index(current_count + i, zero_leaf.clone());
                }
            }
            
            // Insert the commitment
            if index == tree.get_leaf_count() {
                tree.insert(commitment_bigint.clone());
            } else {
                tree.insert_at_index(index, commitment_bigint.clone());
            }
            
            println!("[ASP] ========================================\n");
            Json(serde_json::json!({
                "index": index,
                "found": true,
                "source": "contract_events"
            })).into_response()
        },
        Ok(None) => {
            println!("[ASP] ❌ Commitment not found in contract events");
            println!("[ASP] 📋 This could mean:");
            println!("  - The commitment was never deposited");
            println!("  - The commitment format doesn't match (check BN254 vs Starknet Poseidon)");
            println!("  - The syncer hasn't processed the event yet");
            println!("[ASP] ========================================\n");
            Json(serde_json::json!({
                "found": false,
                "message": "Commitment not found in contract events. It may not have been deposited yet.",
                "tree_leaf_count": leaf_count
            })).into_response()
        },
        Err(e) => {
            eprintln!("[ASP] ❌ Error searching events: {}", e);
            println!("[ASP] ========================================\n");
            (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to search events: {}", e)).into_response()
        }
    }
}

/// List all deposits in the tree with their indices
async fn list_deposits(State(state): State<AppState>) -> impl IntoResponse {
    let tree = state.deposit_tree.lock().unwrap();
    let leaf_count = tree.get_leaf_count();
    
    let mut deposits = Vec::new();
    for i in 0..leaf_count {
        if let Some(leaf) = tree.nodes.get(&(0, i)) {
            deposits.push(serde_json::json!({
                "index": i,
                "commitment": format!("0x{:x}", leaf),
                "commitment_hex_no_prefix": format!("{:x}", leaf)
            }));
        }
    }
    
    Json(serde_json::json!({
        "count": leaf_count,
        "deposits": deposits
    })).into_response()
}

// ==================== Associated Set Endpoints ====================

async fn get_associated_proof(
    Path(index): Path<u32>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let tree = state.associated_tree.lock().unwrap();

    match tree.get_proof(index) {
        Some(proof) => Json(proof).into_response(),
        None => (StatusCode::NOT_FOUND, "Leaf not found at index").into_response(),
    }
}

async fn get_associated_root(State(state): State<AppState>) -> impl IntoResponse {
    let tree = state.associated_tree.lock().unwrap();
    let root = tree.get_root();
    Json(format!("0x{:x}", root))
}

async fn get_associated_info(State(state): State<AppState>) -> impl IntoResponse {
    let tree = state.associated_tree.lock().unwrap();
    Json(TreeInfo {
        root: format!("0x{:x}", tree.get_root()),
        leaf_count: tree.get_leaf_count(),
        depth: tree.depth,
    })
}

/// Insert a commitment into the associated set tree
/// This is used by operators to build compliance sets
async fn insert_associated(
    State(state): State<AppState>,
    Json(payload): Json<InsertRequest>,
) -> impl IntoResponse {
    use num_bigint::BigUint;
    use num_traits::Num;

    // Parse commitment from hex string
    let commitment_str = payload.commitment.trim_start_matches("0x");
    let commitment = match BigUint::from_str_radix(commitment_str, 16) {
        Ok(c) => c,
        Err(_) => {
            return (StatusCode::BAD_REQUEST, "Invalid commitment format").into_response()
        }
    };

    let mut tree = state.associated_tree.lock().unwrap();
    let new_root = tree.insert(commitment);
    let leaf_index = tree.get_leaf_count() - 1;

    Json(serde_json::json!({
        "success": true,
        "leaf_index": leaf_index,
        "new_root": format!("0x{:x}", new_root)
    }))
    .into_response()
}

// ==================== Blockchain Read Endpoints ====================

async fn get_pool_root(State(state): State<AppState>) -> impl IntoResponse {
    match state.blockchain.get_merkle_root().await {
        Ok(root) => Json(serde_json::json!({ "root": root })).into_response(),
        Err(e) => {
            (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to get merkle root: {}", e))
                .into_response()
        }
    }
}

async fn check_pool_initialized(State(state): State<AppState>) -> impl IntoResponse {
    match state.blockchain.is_pool_initialized().await {
        Ok(initialized) => Json(serde_json::json!({ "initialized": initialized })).into_response(),
        Err(e) => {
            (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to check pool status: {}", e))
                .into_response()
        }
    }
}

async fn get_pool_info(State(state): State<AppState>) -> impl IntoResponse {
    // First check if pool is initialized
    let is_initialized = match state.blockchain.is_pool_initialized().await {
        Ok(init) => init,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to check pool status: {}", e))
                .into_response();
        }
    };

    if !is_initialized {
        return Json(serde_json::json!({
            "initialized": false,
            "error": "Pool is not initialized. Please initialize the pool first."
        })).into_response();
    }

    // Get pool tokens and merkle root
    let token0 = state.blockchain.get_pool_token0().await;
    let token1 = state.blockchain.get_pool_token1().await;
    let root = state.blockchain.get_merkle_root().await;

    match (token0, token1, root) {
        (Ok(t0), Ok(t1), Ok(r)) => Json(serde_json::json!({
            "initialized": true,
            "merkle_root": r,
            "contract_address": state.zylith_address,
            "token0": t0,
            "token1": t1
        })).into_response(),
        _ => {
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to get pool info")
                .into_response()
        }
    }
}

async fn check_nullifier(
    Path(nullifier): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    match state.blockchain.is_nullifier_spent(&nullifier).await {
        Ok(spent) => Json(serde_json::json!({ "spent": spent })).into_response(),
        Err(e) => {
            (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to check nullifier: {}", e))
                .into_response()
        }
    }
}

async fn get_token_balance(
    Path((token_address, owner)): Path<(String, String)>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    match state.blockchain.get_token_balance(&token_address, &owner).await {
        Ok((low, high)) => Json(serde_json::json!({
            "low": low.to_string(),
            "high": high.to_string()
        })).into_response(),
        Err(e) => {
            (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to get token balance: {}", e))
                .into_response()
        }
    }
}

async fn get_token_allowance(
    Path((token_address, owner, spender)): Path<(String, String, String)>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    match state.blockchain.get_token_allowance(&token_address, &owner, &spender).await {
        Ok((low, high)) => Json(serde_json::json!({
            "low": low.to_string(),
            "high": high.to_string()
        })).into_response(),
        Err(e) => {
            (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to get token allowance: {}", e))
                .into_response()
        }
    }
}

// ==================== Transaction Preparation Endpoints ====================

#[derive(Deserialize)]
struct PrepareDepositRequest {
    amount: String,
    token_address: String,
    user_address: String,
}

#[derive(Serialize)]
struct PreparedTransaction {
    contract_address: String,
    entry_point: String,
    calldata: Vec<String>,
}

#[derive(Serialize)]
struct DepositPrepareResponse {
    transactions: Vec<PreparedTransaction>,
    commitment: String,
    note_data: NoteData,
}

#[derive(Serialize)]
struct NoteData {
    secret: String,
    nullifier: String,
    amount: String,
}

async fn prepare_deposit(
    State(state): State<AppState>,
    Json(payload): Json<PrepareDepositRequest>,
) -> impl IntoResponse {
    // Parse amount
    let amount = match payload.amount.parse::<u128>() {
        Ok(a) => a,
        Err(_) => {
            return (StatusCode::BAD_REQUEST, "Invalid amount").into_response();
        }
    };
    
    let (amount_low, amount_high) = u256_to_low_high(amount);

    // Generate note (secret, nullifier)
    let (secret, nullifier) = generate_note();

    // Generate commitment
    let commitment = match generate_commitment(&secret, &nullifier, amount) {
        Ok(c) => c,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to generate commitment: {}", e))
                .into_response();
        }
    };

    // Skip token validation - let the contract validate it
    // This avoids slow RPC calls to read storage

    // Check current allowance (optional, for info)
    let _allowance = state.blockchain
        .get_token_allowance(&payload.token_address, &payload.user_address, &state.zylith_address)
        .await;

    let mut transactions = Vec::new();

    // Always include approve (frontend can skip if not needed)
    let approve_calldata = match build_approve_calldata(&state.zylith_address, amount_low, amount_high) {
        Ok(c) => c,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to build approve calldata: {}", e))
                .into_response();
        }
    };

    transactions.push(PreparedTransaction {
        contract_address: payload.token_address.clone(),
        entry_point: "approve".to_string(),
        calldata: approve_calldata.iter().map(|f| format!("0x{:x}", f)).collect(),
    });

    // Build deposit calldata
    let deposit_calldata = match build_deposit_calldata(&payload.token_address, amount_low, amount_high, &commitment) {
        Ok(c) => c,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to build deposit calldata: {}", e))
                .into_response();
        }
    };

    transactions.push(PreparedTransaction {
        contract_address: state.zylith_address.clone(),
        entry_point: "private_deposit".to_string(),
        calldata: deposit_calldata.iter().map(|f| format!("0x{:x}", f)).collect(),
    });

    Json(DepositPrepareResponse {
        transactions,
        commitment,
        note_data: NoteData {
            secret,
            nullifier,
            amount: payload.amount,
        },
    })
    .into_response()
}

#[derive(Deserialize)]
struct PrepareSwapRequest {
    // Input note data (user must provide this)
    secret: String,
    nullifier: String,
    amount: String,
    note_index: u32, // For getting Merkle proof
    // Swap parameters
    amount_specified: String,
    zero_for_one: bool,
    sqrt_price_limit: Option<String>, // Optional, format: "low,high"
    // Output note (will generate if not provided)
    new_secret: Option<String>,
    new_nullifier: Option<String>,
    new_amount: Option<String>,
}

#[derive(Serialize)]
struct SwapPrepareResponse {
    merkle_proof: MerkleProof,
    new_commitment: String,
    output_note_data: NoteData,
}

async fn prepare_swap(
    state: State<AppState>,
    payload: Json<PrepareSwapRequest>,
) -> impl IntoResponse {
    println!("\n[ASP] ========================================");
    println!("[ASP] 📥 POST /api/swap/prepare - Request received");
    println!("[ASP] ========================================");
    println!("[ASP] 🔄 Processing swap preparation...");
    println!("[ASP]    Note index: {}", payload.note_index);
    println!("[ASP]    Amount specified: {}", payload.amount_specified);
    println!("[ASP]    Zero for one: {}", payload.zero_for_one);
    println!("[ASP]    Has new_secret: {}", payload.new_secret.is_some());
    println!("[ASP]    Has new_nullifier: {}", payload.new_nullifier.is_some());
    println!("[ASP]    Has new_amount: {}", payload.new_amount.is_some());
    let start_time = std::time::Instant::now();
    
    // Get Merkle proof for input note
    println!("[ASP] 🔍 Fetching Merkle proof for index {}...", payload.note_index);
    let deposit_tree = state.deposit_tree.lock().unwrap();
    let merkle_proof = match deposit_tree.get_proof(payload.note_index) {
        Some(proof) => {
            println!("[ASP] ✅ Merkle proof found for index {}", payload.note_index);
            println!("[ASP]    Root: {}", proof.root);
            println!("[ASP]    Path length: {}", proof.path.len());
            proof
        }
        None => {
            let elapsed = start_time.elapsed().as_secs_f64();
            println!("[ASP] ❌ Merkle proof not found for index {} (elapsed: {:.2}s)", payload.note_index, elapsed);
            println!("[ASP] ========================================\n");
            return (StatusCode::NOT_FOUND, format!("Merkle proof not found for index {}", payload.note_index)).into_response();
        }
    };
    drop(deposit_tree);
    
    // Generate output note if not provided
    let (new_secret, new_nullifier) = if let (Some(secret), Some(nullifier)) = (&payload.new_secret, &payload.new_nullifier) {
        println!("[ASP] 📝 Using provided output note");
        (secret.clone(), nullifier.clone())
    } else {
        println!("[ASP] 🔐 Generating new output note...");
        let (secret, nullifier) = generate_note();
        (secret, nullifier)
    };
    
    let new_amount = payload.new_amount.as_ref()
        .and_then(|a| a.parse::<u128>().ok())
        .unwrap_or(0);
    
    // Generate commitment for output note
    println!("[ASP] 🔗 Generating commitment for output note...");
    let new_commitment = match generate_commitment(&new_secret, &new_nullifier, new_amount) {
        Ok(c) => {
            println!("[ASP] ✅ Output commitment generated");
            c
        }
        Err(e) => {
            let elapsed = start_time.elapsed().as_secs_f64();
            println!("[ASP] ❌ Failed to generate output commitment (elapsed: {:.2}s): {}", elapsed, e);
            println!("[ASP] ========================================\n");
            return (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to generate output commitment: {}", e)).into_response();
        }
    };
    
    let elapsed = start_time.elapsed().as_secs_f64();
    println!("[ASP] ✅ Swap preparation completed in {:.2}s", elapsed);
    println!("[ASP] 📤 Returning prepared data (Merkle proof, commitment, output note)");
    println!("[ASP] ℹ️  Note: ZK proof generation is handled separately via /api/proof/swap endpoint");
    println!("[ASP] ========================================\n");
    
    // Return prepared data (similar to deposit/prepare)
    // The frontend will use this data along with the ZK proof to construct the transaction
    Json(SwapPrepareResponse {
        merkle_proof,
        new_commitment,
        output_note_data: NoteData {
            secret: new_secret,
            nullifier: new_nullifier,
            amount: new_amount.to_string(),
        },
    })
    .into_response()
}

#[derive(Deserialize)]
struct SwapProofRequest {
    // Public inputs
    nullifier: String,
    root: String,
    new_commitment: String,
    amount_specified: String,
    zero_for_one: String, // "0" or "1"
    amount0_delta: String,
    amount1_delta: String,
    new_sqrt_price_x128: String,
    new_tick: String,
    // Private inputs
    secret_in: String,
    amount_in: String,
    secret_out: String,
    nullifier_out: String,
    amount_out: String,
    #[serde(rename = "pathElements")]
    path_elements: Vec<String>,
    #[serde(rename = "pathIndices")]
    path_indices: Vec<u32>,
    sqrt_price_old: String,
    liquidity: String,
    // Note: pathElements and pathIndices are required (obtained from /api/swap/prepare)
    // Removed note_index fallback - frontend must call prepareSwap first
}

async fn generate_swap_proof_endpoint(
    state: State<AppState>,
    payload: Json<SwapProofRequest>,
) -> impl IntoResponse {
    println!("\n[ASP] ========================================");
    println!("[ASP] 📥 POST /api/proof/swap - ZK Proof generation request");
    println!("[ASP] ========================================");
    let start_time = std::time::Instant::now();
    
    // Merkle proof must be provided in request (from prepareSwap)
    // Frontend should call /api/swap/prepare first to get Merkle proof
    if payload.path_elements.is_empty() || payload.path_indices.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": "pathElements and pathIndices must be provided. Call /api/swap/prepare first to get Merkle proof."
        }))).into_response();
    }
    
    if payload.root.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": "root must be provided. Call /api/swap/prepare first to get Merkle proof."
        }))).into_response();
    }
    
    let merkle_path = payload.path_elements.clone();
    let merkle_path_indices = payload.path_indices.clone();
    let root = payload.root.clone();
    
    println!("[ASP] ✅ Using Merkle proof from request (obtained via prepareSwap)");
    println!("[ASP]    Root: {}", root);
    println!("[ASP]    Path length: {}", merkle_path.len());
    
    // Parse amounts
    let amount_in = match payload.amount_in.parse::<u128>() {
        Ok(v) => v,
        Err(_) => {
            return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
                "error": "Invalid amount_in format"
            }))).into_response();
        }
    };
    let amount_out = match payload.amount_out.parse::<u128>() {
        Ok(v) => v,
        Err(_) => {
            return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
                "error": "Invalid amount_out format"
            }))).into_response();
        }
    };
    let amount_specified = match payload.amount_specified.parse::<u128>() {
        Ok(v) => v,
        Err(_) => {
            return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
                "error": "Invalid amount_specified format"
            }))).into_response();
        }
    };
    
    // Validate swap complexity before generating proof
    // Calculate estimated ticks crossed based on price difference
    let sqrt_price_old = match payload.sqrt_price_old.parse::<u128>() {
        Ok(v) => v,
        Err(_) => {
            return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
                "error": "Invalid sqrt_price_old format"
            }))).into_response();
        }
    };

    let new_sqrt_price_x128 = match payload.new_sqrt_price_x128.parse::<u128>() {
        Ok(v) => v,
        Err(_) => {
            return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
                "error": "Invalid new_sqrt_price_x128 format"
            }))).into_response();
        }
    };

    // If frontend sends "0" (not yet implemented), use default Q128 (1:1 price)
    // Q128 = 2^128 = 340282366920938463463374607431768211456
    // BUT: u128::MAX = 2^128 - 1 = 340282366920938463463374607431768211455
    // IMPORTANT: The circuit expects Q128 = 2^128, but Rust can't parse it
    // Frontend sends U128_MAX string when value is Q128, we need to convert back to Q128 string for circuit
    let q128: u128 = u128::MAX; // Use u128::MAX for Rust parsing
    
    let sqrt_price_old_final = if sqrt_price_old == 0 {
        println!("[ASP] ⚠️  sqrt_price_old is zero, using default Q128 (1:1 price)");
        q128
    } else {
        sqrt_price_old
    };

    let new_sqrt_price_x128_final = if new_sqrt_price_x128 == 0 {
        println!("[ASP] ⚠️  new_sqrt_price_x128 is zero, using sqrt_price_old (no price change)");
        sqrt_price_old_final
    } else {
        new_sqrt_price_x128
    };
    
    // Convert u128::MAX back to Q128 string for circuit (circuit expects Q128 = 2^128)
    // If value is u128::MAX, it means frontend sent Q128, so we send Q128 string to circuit
    let sqrt_price_old_str = if sqrt_price_old_final == u128::MAX {
        "340282366920938463463374607431768211456".to_string() // Q128 = 2^128
    } else {
        sqrt_price_old_final.to_string()
    };
    
    let new_sqrt_price_x128_str = if new_sqrt_price_x128_final == u128::MAX {
        "340282366920938463463374607431768211456".to_string() // Q128 = 2^128
    } else {
        new_sqrt_price_x128_final.to_string()
    };

    // Calculate price ratio to estimate ticks crossed
    // tick = log(sqrt_price) / log(1.0001) ≈ log(sqrt_price) * 10000
    // For quick estimation: price_ratio = new_price / old_price
    let price_ratio = (new_sqrt_price_x128_final as f64) / (sqrt_price_old_final as f64);

    // Estimate ticks: log(ratio) * 10000 / log(1.0001)
    // Simplified: if ratio is 1.01, that's ~100 ticks
    // For MVP: reject if price change > 5% (roughly >50 ticks)
    let max_price_change_ratio = 1.05f64; // 5% max change
    let min_price_change_ratio = 0.95f64; // -5% min change

    if price_ratio > max_price_change_ratio || price_ratio < min_price_change_ratio {
        let price_change_pct = if price_ratio > 1.0 {
            (price_ratio - 1.0) * 100.0
        } else {
            (1.0 - price_ratio) * 100.0
        };
        
        println!("[ASP] ⚠️  Swap rejected: Price change too large ({:.2}%)", price_change_pct);
        println!("[ASP]    sqrt_price_old: {}", sqrt_price_old_final);
        println!("[ASP]    new_sqrt_price_x128: {}", new_sqrt_price_x128_final);
        println!("[ASP]    Estimated ticks crossed: >50 (too many for MVP)");
        
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": format!(
                "Swap rejected: Price change too large ({:.2}%). This swap would cross too many ticks (>50), making proof generation too slow. Please use a tighter sqrt_price_limit or split into smaller swaps.",
                price_change_pct
            ),
            "price_change_percent": price_change_pct,
            "sqrt_price_old": sqrt_price_old_final.to_string(),
            "new_sqrt_price_x128": new_sqrt_price_x128_final.to_string(),
            "suggestion": "Use a sqrt_price_limit closer to current price to limit ticks crossed"
        }))).into_response();
    }

    // Log estimated complexity
    let estimated_ticks = (price_ratio.ln() * 10000.0).abs();
    println!("[ASP] 📊 Swap validation:");
    println!("[ASP]    Price change: {:.2}%", (price_ratio - 1.0) * 100.0);
    println!("[ASP]    Estimated ticks crossed: ~{:.0}", estimated_ticks);
    println!("[ASP]    Estimated proof time: {} minutes", 
        if estimated_ticks < 5.0 { "1-2" } 
        else if estimated_ticks < 10.0 { "2-4" } 
        else { "4-10" });
    println!("[ASP]    Amount specified: {}", amount_specified);
    println!("[ASP]    Zero for one: {}", payload.zero_for_one);
    
    // Get circuits path (relative to ASP directory, go up to project root)
    let circuits_path = std::env::current_dir()
        .unwrap()
        .parent()
        .unwrap()
        .join("circuits")
        .to_str()
        .unwrap()
        .to_string();
    
    // Build input JSON directly from request payload (frontend already formats it correctly)
    // Update root and pathElements/pathIndices if we fetched them
    let input_json = serde_json::json!({
        "nullifier": payload.nullifier,
        "root": root,
        "new_commitment": payload.new_commitment,
        "amount_specified": payload.amount_specified,
        "zero_for_one": payload.zero_for_one,
        "amount0_delta": payload.amount0_delta,
        "amount1_delta": payload.amount1_delta,
        "new_sqrt_price_x128": new_sqrt_price_x128_str.clone(),
        "new_tick": payload.new_tick,
        "secret_in": payload.secret_in,
        "amount_in": payload.amount_in,
        "secret_out": payload.secret_out,
        "nullifier_out": payload.nullifier_out,
        "amount_out": payload.amount_out,
        "pathElements": merkle_path,
        "pathIndices": merkle_path_indices.iter().map(|i| i.to_string()).collect::<Vec<_>>(),
        "sqrt_price_old": sqrt_price_old_str.clone(),
        "liquidity": payload.liquidity,
    });
    
    println!("[ASP] 🔧 Generating ZK proof...");
    println!("[ASP]    Circuits path: {}", circuits_path);
    
    // Generate proof - pass JSON directly to proof generator
    match proof::generate_swap_proof(&circuits_path, input_json).await {
        Ok(swap_proof) => {
            let elapsed = start_time.elapsed().as_secs_f64();
            println!("[ASP] ✅ ZK proof generated successfully in {:.2}s", elapsed);
            println!("[ASP]    Proof length: {}, Public inputs: {}", 
                swap_proof.proof.len(), swap_proof.public_inputs.len());
            
            // Log the actual values being returned
            println!("[ASP] 📋 Returning proof with {} elements:", swap_proof.proof.len());
            for (i, val) in swap_proof.proof.iter().enumerate() {
                println!("[ASP]    proof[{}]: {}", i, val);
            }
            println!("[ASP] 📋 Returning public_inputs with {} elements:", swap_proof.public_inputs.len());
            for (i, val) in swap_proof.public_inputs.iter().enumerate() {
                println!("[ASP]    public_inputs[{}]: {}", i, val);
            }
            
            println!("[ASP] ========================================\n");
            
            Json(serde_json::json!({
                "full_proof_with_hints": swap_proof.proof,
                "public_inputs": swap_proof.public_inputs,
            })).into_response()
        }
        Err(e) => {
            let elapsed = start_time.elapsed().as_secs_f64();
            println!("[ASP] ❌ ZK proof generation failed (elapsed: {:.2}s): {}", elapsed, e);
            println!("[ASP] ========================================\n");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "error": format!("Proof generation failed: {}", e)
            }))).into_response()
        }
    }
}

#[derive(Deserialize)]
struct PrepareWithdrawRequest {
    // Input note data (user must provide this)
    secret: String,
    nullifier: String,
    amount: String,
    note_index: u32, // For getting Merkle proof
    // Withdraw parameters
    recipient: String,
    token_address: Option<String>, // Optional, will use note's token if not provided
}

async fn prepare_withdraw(
    _state: State<AppState>,
    _payload: Json<PrepareWithdrawRequest>,
) -> impl IntoResponse {
    // TODO: Implement withdraw preparation with ZK proof generation
    (StatusCode::NOT_IMPLEMENTED, "ZK proof generation not yet implemented")
}

#[derive(Deserialize)]
struct PrepareLiquidityRequest {
    // Input note data
    secret: String,
    nullifier: String,
    amount: String,
    note_index: u32,
    // Liquidity parameters
    tick_lower: i32,
    tick_upper: i32,
    liquidity: String,
    // Output note
    new_secret: Option<String>,
    new_nullifier: Option<String>,
    new_amount: Option<String>,
}

async fn prepare_mint_liquidity(
    _state: State<AppState>,
    _payload: Json<PrepareLiquidityRequest>,
) -> impl IntoResponse {
    // TODO: Implement mint liquidity preparation with ZK proof generation
    (StatusCode::NOT_IMPLEMENTED, "ZK proof generation not yet implemented")
}

async fn prepare_burn_liquidity(
    _state: State<AppState>,
    _payload: Json<PrepareLiquidityRequest>,
) -> impl IntoResponse {
    // TODO: Implement burn liquidity preparation with ZK proof generation
    (StatusCode::NOT_IMPLEMENTED, "ZK proof generation not yet implemented")
}

/// Request to prepare initialize transaction
#[derive(Deserialize)]
struct PrepareInitializeRequest {
    token0: Option<String>,
    token1: Option<String>,
    fee: Option<u128>,
    tick_spacing: Option<i32>,
    sqrt_price_x128: Option<String>, // u256 as string
}

/// Prepare initialize transaction
#[axum::debug_handler]
async fn prepare_initialize(
    State(state): State<AppState>,
    Json(payload): Json<PrepareInitializeRequest>,
) -> impl IntoResponse {
    // Use default values if not provided
    let token0 = payload.token0.unwrap_or_else(|| {
        "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7".to_string() // ETH
    });
    let token1 = payload.token1.unwrap_or_else(|| {
        "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8".to_string() // USDC
    });
    let fee = payload.fee.unwrap_or(3000); // 0.3%
    let tick_spacing = payload.tick_spacing.unwrap_or(60);
    
    // Calculate sqrt_price_x128 (Q128 = 2^128 for 1:1 price)
    let sqrt_price = if let Some(price_str) = payload.sqrt_price_x128 {
        match BigUint::from_str(&price_str) {
            Ok(p) => p,
            Err(e) => {
                return (StatusCode::BAD_REQUEST, format!("Invalid sqrt_price_x128: {}", e))
                    .into_response();
            }
        }
    } else {
        // Default to Q128 (1:1 price)
        match BigUint::from_str("340282366920938463463374607431768211456") {
            Ok(p) => p,
            Err(e) => {
                return (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to parse Q128: {}", e))
                    .into_response();
            }
        }
    };
    
    let (sqrt_price_low, sqrt_price_high) = u256_to_low_high_bigint(&sqrt_price);
    
    // Build calldata
    let calldata = match build_initialize_calldata(
        &token0,
        &token1,
        fee,
        tick_spacing,
        sqrt_price_low,
        sqrt_price_high,
    ) {
        Ok(c) => c,
        Err(e) => {
            return (StatusCode::BAD_REQUEST, format!("Failed to build calldata: {}", e))
                .into_response();
        }
    };
    
    // Convert calldata to hex strings
    let calldata_hex: Vec<String> = calldata.iter()
        .map(|fe| format!("0x{:x}", fe))
        .collect();
    
    // Return entrypoint name (not selector) - starknet-react expects the function name
    let transaction = PreparedTransaction {
        contract_address: state.zylith_address.clone(),
        entry_point: "initialize".to_string(), // Use function name, not selector
        calldata: calldata_hex,
    };
    
    (StatusCode::OK, Json(serde_json::json!({
        "transactions": [transaction],
        "token0": token0,
        "token1": token1,
        "fee": fee,
        "tick_spacing": tick_spacing,
        "sqrt_price_x128": {
            "low": sqrt_price_low.to_string(),
            "high": sqrt_price_high.to_string()
        }
    }))).into_response()
}

/// Convert u256 (BigUint) to low and high u128
fn u256_to_low_high_bigint(value: &BigUint) -> (u128, u128) {
    use num_traits::ToPrimitive;
    let mask_128 = BigUint::from(1u128) << 128u32;
    let low = value % &mask_128;
    let high = value >> 128u32;
    
    let low_val = low.to_u128().unwrap_or(0);
    let high_val = high.to_u128().unwrap_or(0);
    
    (low_val, high_val)
}

// ==================== Health Check ====================

async fn health_check() -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "ok",
        "version": "0.1.0"
    }))
}
