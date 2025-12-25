use serde::{Deserialize, Serialize};
use once_cell::sync::Lazy;

/// ABI Entry - represents a single entry in the ABI JSON
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum AbiEntry {
    #[serde(rename = "impl")]
    Impl {
        name: String,
        interface_name: String,
    },
    #[serde(rename = "struct")]
    Struct {
        name: String,
        members: Vec<StructMember>,
    },
    #[serde(rename = "enum")]
    Enum {
        name: String,
        variants: Vec<EnumVariant>,
    },
    #[serde(rename = "interface")]
    Interface {
        name: String,
        items: Vec<InterfaceItem>,
    },
    #[serde(rename = "constructor")]
    Constructor {
        name: String,
        inputs: Vec<FunctionInput>,
    },
    #[serde(rename = "event")]
    Event {
        name: String,
        #[serde(default)]
        kind: String,
        #[serde(default)]
        members: Vec<StructMember>,
        #[serde(default)]
        variants: Vec<EnumVariant>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StructMember {
    pub name: String,
    #[serde(rename = "type")]
    pub type_: String,
    #[serde(default)]
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnumVariant {
    pub name: String,
    #[serde(rename = "type")]
    pub type_: Option<String>,
    #[serde(default)]
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InterfaceItem {
    #[serde(rename = "type")]
    pub item_type: String,
    pub name: String,
    #[serde(default)]
    pub inputs: Vec<FunctionInput>,
    #[serde(default)]
    pub outputs: Vec<FunctionOutput>,
    #[serde(default)]
    pub state_mutability: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionInput {
    pub name: String,
    #[serde(rename = "type")]
    pub type_: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionOutput {
    #[serde(rename = "type")]
    pub type_: String,
}

/// Load Zylith ABI (embebido en código)
static ZYLITH_ABI: Lazy<Vec<AbiEntry>> = Lazy::new(|| {
    let abi_str = include_str!("abis/zylith-abi.json");
    serde_json::from_str(abi_str)
        .expect("Failed to parse Zylith ABI")
});

/// Load ERC20 ABI (embebido en código)
static ERC20_ABI: Lazy<Vec<AbiEntry>> = Lazy::new(|| {
    let abi_str = include_str!("abis/erc20-abi.json");
    serde_json::from_str(abi_str)
        .expect("Failed to parse ERC20 ABI")
});

/// Get Zylith ABI
pub fn get_zylith_abi() -> &'static [AbiEntry] {
    &ZYLITH_ABI
}

/// Get ERC20 ABI
pub fn get_erc20_abi() -> &'static [AbiEntry] {
    &ERC20_ABI
}

/// Find function in ABI by name
pub fn find_function<'a>(abi: &'a [AbiEntry], function_name: &str) -> Result<&'a InterfaceItem, String> {
    for entry in abi {
        if let AbiEntry::Interface { items, .. } = entry {
            for item in items {
                if item.item_type == "function" && item.name == function_name {
                    return Ok(item);
                }
            }
        }
    }
    Err(format!("Function '{}' not found in ABI", function_name))
}

/// Validate that ABI contains all required functions
pub fn validate_zylith_abi(abi: &[AbiEntry]) -> Result<(), String> {
    let required_functions = vec![
        "private_deposit",
        "private_swap",
        "private_withdraw",
        "private_mint_liquidity",
        "private_burn_liquidity",
        "get_merkle_root",
        "is_nullifier_spent",
        "is_root_known",
    ];

    for func_name in required_functions {
        find_function(abi, func_name)
            .map_err(|_| format!("Required function '{}' not found in ABI", func_name))?;
    }

    Ok(())
}

/// Validate that ERC20 ABI contains required functions
pub fn validate_erc20_abi(abi: &[AbiEntry]) -> Result<(), String> {
    let required_functions = vec!["approve", "balance_of", "allowance"];

    for func_name in required_functions {
        find_function(abi, func_name)
            .map_err(|_| format!("Required function '{}' not found in ERC20 ABI", func_name))?;
    }

    Ok(())
}

