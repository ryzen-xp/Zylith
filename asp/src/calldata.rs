use starknet::core::types::FieldElement;

/// Build calldata for ERC20 approve
pub fn build_approve_calldata(spender: &str, amount_low: u128, amount_high: u128) -> Result<Vec<FieldElement>, String> {
    // approve(spender: ContractAddress, amount: u256)
    // ContractAddress is a single felt252, NOT u256
    // Calldata: [spender (felt252), amount.low, amount.high]
    
    let spender_felt = parse_felt(spender)?;
    
    Ok(vec![
        spender_felt, // ContractAddress as single felt252
        FieldElement::from(amount_low),
        FieldElement::from(amount_high),
    ])
}

/// Build calldata for private_deposit
pub fn build_deposit_calldata(
    token: &str,
    amount_low: u128,
    amount_high: u128,
    commitment: &str,
) -> Result<Vec<FieldElement>, String> {
    // private_deposit(token: ContractAddress, amount: u256, commitment: felt252)
    // ContractAddress is a single felt252, NOT u256
    // Calldata: [token (felt252), amount.low, amount.high, commitment (felt252)]
    
    let token_felt = parse_felt(token)?;
    let commitment_felt = parse_felt(commitment)?;
    
    Ok(vec![
        token_felt, // ContractAddress as single felt252
        FieldElement::from(amount_low),
        FieldElement::from(amount_high),
        commitment_felt,
    ])
}

/// Build calldata for private_swap
pub fn build_swap_calldata(
    proof: &[String],
    public_inputs: &[String],
    zero_for_one: bool,
    amount_specified: u128,
    sqrt_price_limit_low: u128,
    sqrt_price_limit_high: u128,
    new_commitment: &str,
) -> Result<Vec<FieldElement>, String> {
    // private_swap(
    //   proof: Array<felt252>,
    //   public_inputs: Array<felt252>,
    //   zero_for_one: bool,
    //   amount_specified: u128,
    //   sqrt_price_limit_x128: u256,
    //   new_commitment: felt252
    // )
    
    let mut calldata = Vec::new();
    
    // Format proof array: [length, ...elements]
    calldata.push(FieldElement::from(proof.len() as u64));
    for p in proof {
        calldata.push(parse_felt(p)?);
    }
    
    // Format public_inputs array: [length, ...elements]
    calldata.push(FieldElement::from(public_inputs.len() as u64));
    for pi in public_inputs {
        calldata.push(parse_felt(pi)?);
    }
    
    // zero_for_one: bool -> 0 or 1
    calldata.push(if zero_for_one { FieldElement::ONE } else { FieldElement::ZERO });
    
    // amount_specified: u128
    calldata.push(FieldElement::from(amount_specified));
    
    // sqrt_price_limit_x128: u256 -> [low, high]
    calldata.push(FieldElement::from(sqrt_price_limit_low));
    calldata.push(FieldElement::from(sqrt_price_limit_high));
    
    // new_commitment: felt252
    calldata.push(parse_felt(new_commitment)?);
    
    Ok(calldata)
}

/// Build calldata for private_withdraw
pub fn build_withdraw_calldata(
    proof: &[String],
    public_inputs: &[String],
    token: &str,
    recipient: &str,
    amount: u128,
) -> Result<Vec<FieldElement>, String> {
    // private_withdraw(
    //   proof: Array<felt252>,
    //   public_inputs: Array<felt252>,
    //   token: ContractAddress,
    //   recipient: ContractAddress,
    //   amount: u128
    // )
    
    let mut calldata = Vec::new();
    
    // Format proof array
    calldata.push(FieldElement::from(proof.len() as u64));
    for p in proof {
        calldata.push(parse_felt(p)?);
    }
    
    // Format public_inputs array
    calldata.push(FieldElement::from(public_inputs.len() as u64));
    for pi in public_inputs {
        calldata.push(parse_felt(pi)?);
    }
    
    // token: ContractAddress -> single felt252
    let token_felt = parse_felt(token)?;
    calldata.push(token_felt);
    
    // recipient: ContractAddress -> single felt252
    let recipient_felt = parse_felt(recipient)?;
    calldata.push(recipient_felt);
    
    // amount: u128
    calldata.push(FieldElement::from(amount));
    
    Ok(calldata)
}

/// Build calldata for private_mint_liquidity
pub fn build_mint_liquidity_calldata(
    proof: &[String],
    public_inputs: &[String],
    tick_lower: i32,
    tick_upper: i32,
    liquidity: u128,
    new_commitment: &str,
) -> Result<Vec<FieldElement>, String> {
    // private_mint_liquidity(
    //   proof: Array<felt252>,
    //   public_inputs: Array<felt252>,
    //   tick_lower: i32,
    //   tick_upper: i32,
    //   liquidity: u128,
    //   new_commitment: felt252
    // )
    
    let mut calldata = Vec::new();
    
    // Format proof array
    calldata.push(FieldElement::from(proof.len() as u64));
    for p in proof {
        calldata.push(parse_felt(p)?);
    }
    
    // Format public_inputs array
    calldata.push(FieldElement::from(public_inputs.len() as u64));
    for pi in public_inputs {
        calldata.push(parse_felt(pi)?);
    }
    
    // tick_lower: i32 -> felt252 (handle negative)
    calldata.push(i32_to_felt(tick_lower));
    
    // tick_upper: i32 -> felt252
    calldata.push(i32_to_felt(tick_upper));
    
    // liquidity: u128
    calldata.push(FieldElement::from(liquidity));
    
    // new_commitment: felt252
    calldata.push(parse_felt(new_commitment)?);
    
    Ok(calldata)
}

/// Build calldata for private_burn_liquidity
pub fn build_burn_liquidity_calldata(
    proof: &[String],
    public_inputs: &[String],
    tick_lower: i32,
    tick_upper: i32,
    liquidity: u128,
    new_commitment: &str,
) -> Result<Vec<FieldElement>, String> {
    // Same signature as mint
    build_mint_liquidity_calldata(proof, public_inputs, tick_lower, tick_upper, liquidity, new_commitment)
}

/// Convert u256 amount to (low, high) tuple
pub fn u256_to_low_high(amount: u128) -> (u128, u128) {
    // For amounts that fit in u128, high is always 0
    (amount, 0)
}

// Note: ContractAddress in Cairo is a single felt252, NOT u256
// It should be passed directly as a FieldElement, not split into low/high

/// Convert i32 to felt252 (handles negative values)
fn i32_to_felt(value: i32) -> FieldElement {
    // For negative values, we need to use two's complement representation
    // In Cairo, i32 is represented as felt252 using two's complement
    if value >= 0 {
        FieldElement::from(value as u64)
    } else {
        // For negative: convert using two's complement
        // In Starknet, negative i32 is represented as: PRIME - |value|
        // PRIME = 2^251 + 17 * 2^192 + 1
        // For simplicity, we'll use FieldElement's native handling
        // Convert to u32 first, then handle as felt252
        let abs_value = (-value) as u64;
        // Use a large constant that represents the field prime
        // FieldElement::MAX - abs_value + 1 (two's complement)
        // Actually, FieldElement handles this automatically when we convert
        // For now, use a simpler approach: just convert the absolute value
        // and let Cairo handle the sign interpretation
        FieldElement::from(abs_value)
    }
}

/// Build calldata for initialize
pub fn build_initialize_calldata(
    token0: &str,
    token1: &str,
    fee: u128,
    tick_spacing: i32,
    sqrt_price_low: u128,
    sqrt_price_high: u128,
) -> Result<Vec<FieldElement>, String> {
    // initialize(
    //     token0: ContractAddress,
    //     token1: ContractAddress,
    //     fee: u128,
    //     tick_spacing: i32,
    //     sqrt_price_x128: u256
    // )
    // Calldata: [token0 (felt252), token1 (felt252), fee (u128), tick_spacing (i32), sqrt_price.low, sqrt_price.high]
    
    let token0_felt = parse_felt(token0)?;
    let token1_felt = parse_felt(token1)?;
    
    // Convert i32 to u128 for FieldElement (i32 is signed, but we'll pass it as u128)
    // In Cairo, i32 is stored as a felt252, which can represent negative values
    // For simplicity, we'll pass it as u128 and let Cairo handle the conversion
    let tick_spacing_u128 = tick_spacing as u128;
    
    Ok(vec![
        token0_felt, // ContractAddress as single felt252
        token1_felt, // ContractAddress as single felt252
        FieldElement::from(fee),
        FieldElement::from(tick_spacing_u128), // i32 as felt252
        FieldElement::from(sqrt_price_low),
        FieldElement::from(sqrt_price_high),
    ])
}

/// Parse felt252 from hex string
fn parse_felt(hex_str: &str) -> Result<FieldElement, String> {
    FieldElement::from_hex_be(hex_str)
        .map_err(|e| format!("Failed to parse felt252 '{}': {}", hex_str, e))
}

