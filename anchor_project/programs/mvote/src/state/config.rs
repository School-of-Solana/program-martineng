use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Config {
    /// Program admin
    pub admin: Pubkey,
    /// mVote token mint
    pub token_mint: Pubkey,
    /// SOL collection vault
    pub sol_vault: Pubkey,
    /// SOL/USD rate (e.g., 15000 = $150.00)
    pub sol_usd_rate: u64,
    /// Tokens per USD (with decimals)
    pub tokens_per_usd: u64,
    /// Daily purchase limit (with decimals)
    pub daily_purchase_limit: u64,
    /// Cost to create a poll (with decimals)
    pub poll_creation_cost: u64,
    /// Cost per vote in Fair mode (with decimals)
    pub vote_cost: u64,
    /// Total polls created (used for poll ID)
    pub total_polls_created: u64,
    /// Bump seed for PDA
    pub bump: u8,
}

impl Config {
    pub const SIZE: usize = 8 + // discriminator
        32 + // admin
        32 + // token_mint
        32 + // sol_vault
        8 +  // sol_usd_rate
        8 +  // tokens_per_usd
        8 +  // daily_purchase_limit
        8 +  // poll_creation_cost
        8 +  // vote_cost
        8 +  // total_polls_created
        1;   // bump
}
