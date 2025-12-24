use crate::merkle::MerkleTree;
use num_bigint::BigUint;
use starknet::{
    core::types::{BlockId, EventFilter, FieldElement},
    providers::{jsonrpc::HttpTransport, JsonRpcClient, Provider},
};
use std::fs;
use std::sync::{Arc, Mutex};
use tokio::time::{sleep, Duration};
use url::Url;

/// Deposit event selector: starknet_keccak("Deposit")
/// This is the hash of the event name used to filter deposit events
/// Calculated as: starknet_keccak(b"Deposit") truncated to 250 bits
const DEPOSIT_EVENT_SELECTOR: &str =
    "0x9149d2123147c5f43d258257fef0b7b969db78269369ebcf5ebb9eef8592f2";

/// State file for persistence
const STATE_FILE: &str = "asp_state.json";

#[derive(serde::Serialize, serde::Deserialize, Default)]
struct SyncerState {
    last_synced_block: u64,
}

pub struct Syncer {
    pub provider: Arc<JsonRpcClient<HttpTransport>>,
    pub contract_address: FieldElement,
    pub tree: Arc<Mutex<MerkleTree>>,
    pub deposit_selector: FieldElement,
}

impl Syncer {
    pub fn new(rpc_url: &str, contract_address: &str, tree: Arc<Mutex<MerkleTree>>) -> Self {
        let provider = Arc::new(JsonRpcClient::new(HttpTransport::new(
            Url::parse(rpc_url).unwrap(),
        )));
        let contract_address = FieldElement::from_hex_be(contract_address).unwrap();
        let deposit_selector = FieldElement::from_hex_be(DEPOSIT_EVENT_SELECTOR).unwrap();

        Self {
            provider,
            contract_address,
            tree,
            deposit_selector,
        }
    }

    /// Load persisted state
    fn load_state() -> SyncerState {
        fs::read_to_string(STATE_FILE)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    }

    /// Save state to file
    fn save_state(state: &SyncerState) {
        if let Ok(json) = serde_json::to_string(state) {
            let _ = fs::write(STATE_FILE, json);
        }
    }

    pub async fn run(&self) {
        let mut state = Self::load_state();
        println!(
            "Starting sync from block {}",
            state.last_synced_block
        );

        loop {
            match self.sync_events(state.last_synced_block).await {
                Ok(new_last_block) => {
                    if new_last_block > state.last_synced_block {
                        state.last_synced_block = new_last_block;
                        Self::save_state(&state);
                    }
                }
                Err(e) => {
                    eprintln!("Sync error: {:?}", e);
                }
            }
            sleep(Duration::from_secs(5)).await;
        }
    }

    async fn sync_events(&self, from_block: u64) -> Result<u64, Box<dyn std::error::Error>> {
        let latest_block = self.provider.block_number().await?;
        if from_block >= latest_block {
            return Ok(from_block);
        }

        println!(
            "Syncing blocks {} to {}",
            from_block + 1,
            latest_block
        );

        // Filter for events from our contract with Deposit selector
        let filter = EventFilter {
            from_block: Some(BlockId::Number(from_block + 1)),
            to_block: Some(BlockId::Number(latest_block)),
            address: Some(self.contract_address),
            keys: Some(vec![vec![self.deposit_selector]]), // Filter by Deposit event
        };

        let chunk_size = 1000;
        let mut continuation_token = None;
        let mut events_processed = 0u32;

        loop {
            let events_page = self
                .provider
                .get_events(filter.clone(), continuation_token, chunk_size)
                .await?;
            
            for event in events_page.events {
                // Verify this is a Deposit event
                if event.keys.is_empty() || event.keys[0] != self.deposit_selector {
                    continue;
                }

                // Parse Deposit event data:
                // data[0] = commitment (felt252)
                // data[1] = leaf_index (u32)
                // data[2] = root (felt252)
                if event.data.len() >= 3 {
                        let commitment_felt = event.data[0];
                    let leaf_index_felt = event.data[1];
                    let new_root_felt = event.data[2];

                    // Convert to BigUint for our Merkle tree
                    let commitment = BigUint::from_bytes_be(&commitment_felt.to_bytes_be());
                    let leaf_index: u32 = {
                        let bytes = leaf_index_felt.to_bytes_be();
                        let mut arr = [0u8; 4];
                        let start = bytes.len().saturating_sub(4);
                        arr.copy_from_slice(&bytes[start..]);
                        u32::from_be_bytes(arr)
                    };

                    // Insert into our tree
                        let mut tree = self.tree.lock().unwrap();

                    // Verify index matches expected (should be sequential)
                    let expected_index = tree.get_leaf_count();
                    if leaf_index != expected_index {
                        eprintln!(
                            "Warning: Leaf index mismatch. Expected {}, got {}. Possible missed events.",
                            expected_index, leaf_index
                        );
                    }

                    let computed_root = tree.insert(commitment.clone());
                    events_processed += 1;

                    // Log
                    println!(
                        "Synced deposit #{}: commitment=0x{:x}, root=0x{:x}",
                        leaf_index, commitment, computed_root
                    );

                    // Optionally verify root matches on-chain (for debugging)
                    let expected_root = BigUint::from_bytes_be(&new_root_felt.to_bytes_be());
                    if computed_root != expected_root {
                        eprintln!(
                            "Warning: Root mismatch! Computed=0x{:x}, On-chain=0x{:x}",
                            computed_root, expected_root
                        );
                    }
                } else {
                    eprintln!("Warning: Deposit event with insufficient data fields");
                }
            }

            continuation_token = events_page.continuation_token;
            if continuation_token.is_none() {
                break;
            }
        }

        if events_processed > 0 {
            println!("Processed {} deposit events", events_processed);
        }

        Ok(latest_block)
    }
}
