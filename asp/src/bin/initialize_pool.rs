use starknet::{
    accounts::{Account, SingleOwnerAccount},
    core::types::{BlockId, BlockTag, FieldElement},
    core::utils::{get_selector_from_name, starknet_keccak},
    providers::{jsonrpc::HttpTransport, JsonRpcClient, Provider},
    signers::{LocalWallet, SigningKey},
};
use std::str::FromStr;
use std::sync::Arc;
use url::Url;

/// Q128 constant for sqrt_price_x128 calculation
/// Q128 = 2^128 = 340282366920938463463374607431768211456
const Q128: &str = "340282366920938463463374607431768211456";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Configuration
    let rpc_url = std::env::var("STARKNET_RPC")
        .unwrap_or_else(|_| "https://starknet-sepolia-rpc.publicnode.com".to_string());
    let zylith_address = std::env::var("ZYLITH_CONTRACT")
        .unwrap_or_else(|_| "0x07fd7386f3b91ec5e130aafb85da7fe3cbfa069beb080789150c4b75efc5c9ef".to_string());
    
    // Get private key from environment or use default for testing
    let private_key_hex = std::env::var("PRIVATE_KEY")
        .expect("PRIVATE_KEY environment variable must be set");
    
    // Parse private key
    let private_key_felt = FieldElement::from_str(&private_key_hex)?;
    let private_key = SigningKey::from_secret_scalar(private_key_felt);
    let account_address = std::env::var("ACCOUNT_ADDRESS")
        .expect("ACCOUNT_ADDRESS environment variable must be set");
    let account_address = FieldElement::from_str(&account_address)?;
    
    // Token addresses (ETH/USDC on Sepolia)
    let token0 = "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7"; // ETH
    let token1 = "0x0512feAc6339Ff7889822cb5aA2a86C848e9D392bB0E3E237C008674feeD8343"; // USDC
    
    // Pool parameters
    let fee = 3000u128; // 0.3%
    let tick_spacing = 60i32;
    
    // Calculate sqrt_price_x128 for 1:1 price (Q128)
    let sqrt_price = num_bigint::BigUint::from_str(Q128)?;
    let (sqrt_price_low, sqrt_price_high) = u256_to_low_high(&sqrt_price);
    
    println!("🚀 Initializing Zylith Pool");
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("Contract: {}", zylith_address);
    println!("Token0 (ETH): {}", token0);
    println!("Token1 (USDC): {}", token1);
    println!("Fee: {} (0.3%)", fee);
    println!("Tick Spacing: {}", tick_spacing);
    println!("Sqrt Price X128: {} (1:1 price)", Q128);
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    // Setup provider and account
    let url = Url::parse(&rpc_url)?;
    let provider = Arc::new(JsonRpcClient::new(HttpTransport::new(url)));
    let chain_id = provider.chain_id().await?;
    
    let wallet = LocalWallet::from_signing_key(private_key);
    let account = SingleOwnerAccount::new(
        provider.clone(),
        wallet,
        account_address,
        chain_id,
        starknet::accounts::ExecutionEncoding::New,
    );
    
    // Check if pool is already initialized
    println!("\n📋 Checking if pool is already initialized...");
    let initialized_selector = starknet_keccak("initialized".as_bytes());
    let is_initialized = provider
        .get_storage_at(
            FieldElement::from_str(&zylith_address)?,
            initialized_selector,
            BlockId::Tag(BlockTag::Latest),
        )
        .await?;
    
    if is_initialized != FieldElement::ZERO {
        println!("⚠️  Pool is already initialized!");
        println!("   To re-initialize, you would need to deploy a new contract.");
        return Ok(());
    }
    
    println!("✅ Pool is not initialized. Proceeding...\n");
    
    // Build calldata for initialize
    let zylith_address_felt = FieldElement::from_str(&zylith_address)?;
    let initialize_selector = get_selector_from_name("initialize")?;
    
    let calldata = build_initialize_calldata(
        token0,
        token1,
        fee,
        tick_spacing,
        sqrt_price_low,
        sqrt_price_high,
    )?;
    
    println!("📦 Calldata prepared:");
    println!("   Selector: 0x{:x}", initialize_selector);
    for (i, calldata_item) in calldata.iter().enumerate() {
        println!("   [{}]: 0x{:x}", i, calldata_item);
    }
    println!();
    
    // Execute transaction
    println!("📤 Sending transaction...");
    let result = account
        .execute(vec![starknet::accounts::Call {
            to: zylith_address_felt,
            selector: initialize_selector,
            calldata: calldata.clone(),
        }])
        .send()
        .await?;
    
    // Extract transaction hash from result
    // In starknet-rs 0.10, InvokeTransactionResult has a transaction_hash field directly
    let transaction_hash = result.transaction_hash;
    
    println!("✅ Transaction sent successfully!");
    println!("   Hash: 0x{:x}", transaction_hash);
    println!("\n⏳ Waiting for transaction to be confirmed...");
    println!("   Check status at: https://sepolia.starkscan.co/tx/0x{:x}", transaction_hash);
    
    // Wait for transaction (poll every 5 seconds)
    loop {
        let status = provider.get_transaction_status(transaction_hash).await?;
        match status {
            starknet::core::types::TransactionStatus::AcceptedOnL2(_)
            | starknet::core::types::TransactionStatus::AcceptedOnL1(_) => {
                println!("✅ Transaction confirmed!");
                break;
            }
            starknet::core::types::TransactionStatus::Rejected => {
                return Err("Transaction was rejected".into());
            }
            _ => {
                tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
            }
        }
    }
    
    println!("\n🎉 Pool initialized successfully!");
    println!("   You can now use the pool for deposits, swaps, and liquidity operations.");
    
    Ok(())
}

/// Build calldata for initialize function
fn build_initialize_calldata(
    token0: &str,
    token1: &str,
    fee: u128,
    tick_spacing: i32,
    sqrt_price_low: u128,
    sqrt_price_high: u128,
) -> Result<Vec<FieldElement>, Box<dyn std::error::Error>> {
    let token0_felt = FieldElement::from_str(token0)?;
    let token1_felt = FieldElement::from_str(token1)?;
    
    // Convert i32 to u128 for FieldElement
    // In Cairo, i32 is stored as a felt252
    let tick_spacing_u128 = tick_spacing as u128;
    
    Ok(vec![
        token0_felt,
        token1_felt,
        FieldElement::from(fee),
        FieldElement::from(tick_spacing_u128),
        FieldElement::from(sqrt_price_low),
        FieldElement::from(sqrt_price_high),
    ])
}

/// Convert u256 (BigUint) to low and high u128
fn u256_to_low_high(value: &num_bigint::BigUint) -> (u128, u128) {
    use num_traits::ToPrimitive;
    let mask_128 = num_bigint::BigUint::from(1u128) << 128u32;
    let low = value % &mask_128;
    let high = value >> 128u32;
    
    let low_val = low.to_u128().unwrap_or(0);
    let high_val = high.to_u128().unwrap_or(0);
    
    (low_val, high_val)
}

