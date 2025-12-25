use starknet::core::types::{BlockId, BlockTag, FieldElement, FunctionCall};
use starknet::core::utils::starknet_keccak;
use starknet::providers::{jsonrpc::HttpTransport, JsonRpcClient, Provider};
use starknet_crypto::{pedersen_hash, FieldElement as CryptoFieldElement};
use url::Url;

pub struct BlockchainClient {
    provider: JsonRpcClient<HttpTransport>,
    zylith_address: FieldElement,
}

impl BlockchainClient {
    pub fn new(rpc_url: &str, zylith_address: &str) -> Result<Self, String> {
        let url = Url::parse(rpc_url)
            .map_err(|e| format!("Invalid RPC URL: {}", e))?;
        
        let provider = JsonRpcClient::new(HttpTransport::new(url));
        
        let zylith_addr = parse_felt(zylith_address)
            .map_err(|e| format!("Invalid Zylith address: {}", e))?;

        Ok(Self {
            provider,
            zylith_address: zylith_addr,
        })
    }

    /// Get Merkle root from contract
    pub async fn get_merkle_root(&self) -> Result<String, String> {
        let call = FunctionCall {
            contract_address: self.zylith_address,
            entry_point_selector: get_selector("get_merkle_root"),
            calldata: vec![],
        };

        let result = self.provider
            .call(call, BlockId::Tag(BlockTag::Latest))
            .await
            .map_err(|e| format!("Failed to call get_merkle_root: {}", e))?;

        if result.is_empty() {
            return Err("Empty response from get_merkle_root".to_string());
        }

        Ok(format!("0x{:x}", result[0]))
    }

    /// Check if nullifier is spent
    pub async fn is_nullifier_spent(&self, nullifier: &str) -> Result<bool, String> {
        let nullifier_felt = parse_felt(nullifier)?;

        let call = FunctionCall {
            contract_address: self.zylith_address,
            entry_point_selector: get_selector("is_nullifier_spent"),
            calldata: vec![nullifier_felt],
        };

        let result = self.provider
            .call(call, BlockId::Tag(BlockTag::Latest))
            .await
            .map_err(|e| format!("Failed to call is_nullifier_spent: {}", e))?;

        if result.is_empty() {
            return Err("Empty response from is_nullifier_spent".to_string());
        }

        // Cairo bool: 0 = false, 1 = true
        Ok(result[0] != FieldElement::ZERO)
    }

    /// Check if root is known (historical root)
    pub async fn is_root_known(&self, root: &str) -> Result<bool, String> {
        let root_felt = parse_felt(root)?;

        let call = FunctionCall {
            contract_address: self.zylith_address,
            entry_point_selector: get_selector("is_root_known"),
            calldata: vec![root_felt],
        };

        let result = self.provider
            .call(call, BlockId::Tag(BlockTag::Latest))
            .await
            .map_err(|e| format!("Failed to call is_root_known: {}", e))?;

        if result.is_empty() {
            return Err("Empty response from is_root_known".to_string());
        }

        Ok(result[0] != FieldElement::ZERO)
    }

    /// Get token balance (ERC20) - returns (low, high) for u256
    pub async fn get_token_balance(
        &self,
        token_address: &str,
        owner: &str,
    ) -> Result<(u128, u128), String> {
        let token_addr = parse_felt(token_address)?;
        let owner_addr = parse_felt(owner)?;

        // ERC20 uses balance_of (snake_case in Cairo)
        let call = FunctionCall {
            contract_address: token_addr,
            entry_point_selector: get_selector("balance_of"),
            calldata: vec![owner_addr],
        };

        let result = self.provider
            .call(call, BlockId::Tag(BlockTag::Latest))
            .await
            .map_err(|e| format!("Failed to call balance_of: {}", e))?;

        if result.len() < 2 {
            return Err("Invalid response from balance_of (expected u256)".to_string());
        }

        // u256 is returned as [low, high]
        let low = result[0];
        let high = result[1];
        
        // Convert FieldElement to u128
        let low_bytes = low.to_bytes_be();
        let high_bytes = high.to_bytes_be();
        
        let low_u128 = u128::from_be_bytes([
            low_bytes[16], low_bytes[17], low_bytes[18], low_bytes[19],
            low_bytes[20], low_bytes[21], low_bytes[22], low_bytes[23],
            low_bytes[24], low_bytes[25], low_bytes[26], low_bytes[27],
            low_bytes[28], low_bytes[29], low_bytes[30], low_bytes[31],
        ]);
        let high_u128 = u128::from_be_bytes([
            high_bytes[16], high_bytes[17], high_bytes[18], high_bytes[19],
            high_bytes[20], high_bytes[21], high_bytes[22], high_bytes[23],
            high_bytes[24], high_bytes[25], high_bytes[26], high_bytes[27],
            high_bytes[28], high_bytes[29], high_bytes[30], high_bytes[31],
        ]);

        Ok((low_u128, high_u128))
    }

    /// Get token allowance (ERC20) - returns (low, high) for u256
    pub async fn get_token_allowance(
        &self,
        token_address: &str,
        owner: &str,
        spender: &str,
    ) -> Result<(u128, u128), String> {
        let token_addr = parse_felt(token_address)?;
        let owner_addr = parse_felt(owner)?;
        let spender_addr = parse_felt(spender)?;

        let call = FunctionCall {
            contract_address: token_addr,
            entry_point_selector: get_selector("allowance"),
            calldata: vec![owner_addr, spender_addr],
        };

        let result = self.provider
            .call(call, BlockId::Tag(BlockTag::Latest))
            .await
            .map_err(|e| format!("Failed to call allowance: {}", e))?;

        if result.len() < 2 {
            return Err("Invalid response from allowance (expected u256)".to_string());
        }

        // u256 is returned as [low, high]
        let low = result[0];
        let high = result[1];
        
        let low_bytes = low.to_bytes_be();
        let high_bytes = high.to_bytes_be();
        
        let low_u128 = u128::from_be_bytes([
            low_bytes[16], low_bytes[17], low_bytes[18], low_bytes[19],
            low_bytes[20], low_bytes[21], low_bytes[22], low_bytes[23],
            low_bytes[24], low_bytes[25], low_bytes[26], low_bytes[27],
            low_bytes[28], low_bytes[29], low_bytes[30], low_bytes[31],
        ]);
        let high_u128 = u128::from_be_bytes([
            high_bytes[16], high_bytes[17], high_bytes[18], high_bytes[19],
            high_bytes[20], high_bytes[21], high_bytes[22], high_bytes[23],
            high_bytes[24], high_bytes[25], high_bytes[26], high_bytes[27],
            high_bytes[28], high_bytes[29], high_bytes[30], high_bytes[31],
        ]);

        Ok((low_u128, high_u128))
    }

    /// Check if pool is initialized
    pub async fn is_pool_initialized(&self) -> Result<bool, String> {
        // Check initialized field: sn_keccak("initialized")
        let initialized_selector = starknet_keccak("initialized".as_bytes());
        
        let storage_value = self.provider
            .get_storage_at(self.zylith_address, initialized_selector, BlockId::Tag(BlockTag::Latest))
            .await
            .map_err(|e| format!("Failed to read initialized storage: {}", e))?;

        // Cairo bool: 0 = false, 1 = true
        Ok(storage_value != FieldElement::ZERO)
    }

    /// Get pool token0 address by reading storage directly
    /// In Cairo, for storage nodes, the address calculation is complex.
    /// We try multiple methods: pedersen_hash and direct base address
    pub async fn get_pool_token0(&self) -> Result<String, String> {
        // First check if pool is initialized
        let is_initialized = self.is_pool_initialized().await
            .map_err(|e| format!("Failed to check if pool is initialized: {}", e))?;
        
        if !is_initialized {
            return Err("Pool is not initialized. Please initialize the pool first.".to_string());
        }

        let pool_base = starknet_keccak("pool".as_bytes());
        let token0_field = starknet_keccak("token0".as_bytes());
        
        // Method 1: Try pedersen_hash (standard for storage nodes)
        let pool_base_crypto = CryptoFieldElement::from_bytes_be(&pool_base.to_bytes_be())
            .map_err(|e| format!("Failed to convert pool_base: {}", e))?;
        let token0_field_crypto = CryptoFieldElement::from_bytes_be(&token0_field.to_bytes_be())
            .map_err(|e| format!("Failed to convert token0_field: {}", e))?;
        
        let storage_address_pedersen = pedersen_hash(&pool_base_crypto, &token0_field_crypto);
        let storage_address1 = FieldElement::from_bytes_be(&storage_address_pedersen.to_bytes_be())
            .map_err(|e| format!("Failed to convert pedersen result: {}", e))?;
        
        // Method 2: Try direct base (first field in storage node)
        let storage_address2 = pool_base;
        
        // Method 3: Try base + field (alternative calculation)
        let storage_address3 = pool_base + token0_field;
        
        // Try pedersen_hash first (most likely correct for storage nodes)
        // Use tokio::time::timeout to avoid hanging on slow RPC calls
        match tokio::time::timeout(
            tokio::time::Duration::from_secs(5),
            self.provider.get_storage_at(self.zylith_address, storage_address1, BlockId::Tag(BlockTag::Latest))
        ).await {
            Ok(Ok(value)) if value != FieldElement::ZERO => {
                // Normalize to 64 hex chars (remove leading zeros)
                let hex_str = format!("{:064x}", value);
                // Remove leading zeros but keep at least one char
                let trimmed = hex_str.trim_start_matches('0');
                let normalized = if trimmed.is_empty() { "0" } else { trimmed };
                return Ok(format!("0x{}", normalized));
            }
            Ok(Ok(_)) => {
                // Value is zero, try direct_base as fallback
            }
            Ok(Err(e)) => {
                eprintln!("Warning: Failed to read storage using pedersen_hash: {}", e);
            }
            Err(_) => {
                eprintln!("Warning: Timeout reading storage using pedersen_hash");
            }
        }
        
        // Fallback: Try direct_base (faster, less likely but worth trying)
        match tokio::time::timeout(
            tokio::time::Duration::from_secs(3),
            self.provider.get_storage_at(self.zylith_address, storage_address2, BlockId::Tag(BlockTag::Latest))
        ).await {
            Ok(Ok(value)) if value != FieldElement::ZERO => {
                let hex_str = format!("{:064x}", value);
                let trimmed = hex_str.trim_start_matches('0');
                let normalized = if trimmed.is_empty() { "0" } else { trimmed };
                return Ok(format!("0x{}", normalized));
            }
            _ => {}
        }
        
        // All methods failed
        Err(format!(
            "token0 is zero at all attempted storage addresses. This usually means:\n1. The pool initialization transaction hasn't been confirmed yet (wait 10-30 seconds)\n2. The initialization transaction failed\n3. There's a delay in state propagation\n4. The storage address calculation is incorrect\n\nPlease verify the initialization transaction was successful at https://sepolia.starkscan.co and wait a few seconds before trying again.\n\nTried addresses:\n- pedersen_hash: 0x{:x}\n- direct_base: 0x{:x}\n- base_plus_field: 0x{:x}",
            storage_address1, storage_address2, storage_address3
        ))
    }

    /// Get pool token1 address by reading storage directly
    /// In Cairo, for storage nodes, the address calculation is complex.
    /// We try multiple methods: pedersen_hash and direct base address
    pub async fn get_pool_token1(&self) -> Result<String, String> {
        // First check if pool is initialized
        let is_initialized = self.is_pool_initialized().await
            .map_err(|e| format!("Failed to check if pool is initialized: {}", e))?;
        
        if !is_initialized {
            return Err("Pool is not initialized. Please initialize the pool first.".to_string());
        }

        let pool_base = starknet_keccak("pool".as_bytes());
        let token1_field = starknet_keccak("token1".as_bytes());
        
        // Method 1: Try pedersen_hash (standard for storage nodes)
        let pool_base_crypto = CryptoFieldElement::from_bytes_be(&pool_base.to_bytes_be())
            .map_err(|e| format!("Failed to convert pool_base: {}", e))?;
        let token1_field_crypto = CryptoFieldElement::from_bytes_be(&token1_field.to_bytes_be())
            .map_err(|e| format!("Failed to convert token1_field: {}", e))?;
        
        let storage_address_pedersen = pedersen_hash(&pool_base_crypto, &token1_field_crypto);
        let storage_address1 = FieldElement::from_bytes_be(&storage_address_pedersen.to_bytes_be())
            .map_err(|e| format!("Failed to convert pedersen result: {}", e))?;
        
        // Method 2: Try direct base + 1 (second field in storage node)
        let storage_address2 = pool_base + FieldElement::ONE;
        
        // Try pedersen_hash first (most likely correct for storage nodes)
        // Use tokio::time::timeout to avoid hanging on slow RPC calls
        match tokio::time::timeout(
            tokio::time::Duration::from_secs(5),
            self.provider.get_storage_at(self.zylith_address, storage_address1, BlockId::Tag(BlockTag::Latest))
        ).await {
            Ok(Ok(value)) if value != FieldElement::ZERO => {
                // Normalize to 64 hex chars (remove leading zeros)
                let hex_str = format!("{:064x}", value);
                // Remove leading zeros but keep at least one char
                let trimmed = hex_str.trim_start_matches('0');
                let normalized = if trimmed.is_empty() { "0" } else { trimmed };
                return Ok(format!("0x{}", normalized));
            }
            Ok(Ok(_)) => {
                // Value is zero, try direct_base_plus_one as fallback
            }
            Ok(Err(e)) => {
                eprintln!("Warning: Failed to read storage using pedersen_hash: {}", e);
            }
            Err(_) => {
                eprintln!("Warning: Timeout reading storage using pedersen_hash");
            }
        }
        
        // Fallback: Try direct_base_plus_one (faster, less likely but worth trying)
        match tokio::time::timeout(
            tokio::time::Duration::from_secs(3),
            self.provider.get_storage_at(self.zylith_address, storage_address2, BlockId::Tag(BlockTag::Latest))
        ).await {
            Ok(Ok(value)) if value != FieldElement::ZERO => {
                let hex_str = format!("{:064x}", value);
                let trimmed = hex_str.trim_start_matches('0');
                let normalized = if trimmed.is_empty() { "0" } else { trimmed };
                return Ok(format!("0x{}", normalized));
            }
            _ => {}
        }
        
        // All methods failed
        Err(format!(
            "token1 is zero at all attempted storage addresses. Pool may not be properly initialized.\n\nTried addresses:\n- pedersen_hash: 0x{:x}\n- direct_base_plus_one: 0x{:x}",
            storage_address1, storage_address2
        ))
    }
}

/// Get function selector from function name
fn get_selector(function_name: &str) -> FieldElement {
    use starknet::core::utils::get_selector_from_name;
    get_selector_from_name(function_name).unwrap_or(FieldElement::ZERO)
}

/// Parse felt252 from hex string
fn parse_felt(hex_str: &str) -> Result<FieldElement, String> {
    FieldElement::from_hex_be(hex_str)
        .map_err(|e| format!("Failed to parse felt252 '{}': {}", hex_str, e))
}

