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
use merkle::{MerkleTree, TREE_DEPTH};
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
        "0x04b6a594dc9747caf1bd3d8933621366bbb7fbaefa1522174432611b577ae94d".to_string()
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

    // Initialize Syncer for deposit tree
    let syncer = Syncer::new(&rpc_url, &contract_address, deposit_tree);
    
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
    let tree = state.deposit_tree.lock().unwrap();

    match tree.get_proof(index) {
        Some(proof) => Json(proof).into_response(),
        None => (StatusCode::NOT_FOUND, "Leaf not found at index").into_response(),
    }
}

async fn get_deposit_root(State(state): State<AppState>) -> impl IntoResponse {
    let tree = state.deposit_tree.lock().unwrap();
    let root = tree.get_root();
    Json(format!("0x{:x}", root))
}

async fn get_deposit_info(State(state): State<AppState>) -> impl IntoResponse {
    let tree = state.deposit_tree.lock().unwrap();
    Json(TreeInfo {
        root: format!("0x{:x}", tree.get_root()),
        leaf_count: tree.get_leaf_count(),
        depth: tree.depth,
    })
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
    transactions: Vec<PreparedTransaction>,
    new_commitment: String,
    output_note_data: NoteData,
}

async fn prepare_swap(
    _state: State<AppState>,
    _payload: Json<PrepareSwapRequest>,
) -> impl IntoResponse {
    // TODO: Implement swap preparation with ZK proof generation
    (StatusCode::NOT_IMPLEMENTED, "ZK proof generation not yet implemented. Proof service needs Circom integration.")
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
