use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct UserStats {
    /// User wallet address
    pub wallet: Pubkey,
    /// Tokens purchased today
    pub tokens_purchased_today: u64,
    /// Last purchase day (unix timestamp of day start in SGT)
    pub last_purchase_day: i64,
    /// Total tokens ever purchased
    pub total_tokens_purchased: u64,
    /// Number of polls created
    pub polls_created: u64,
    /// Number of votes cast
    pub votes_cast: u64,
    /// Bump seed for PDA
    pub bump: u8,
}

impl UserStats {
    pub const SIZE: usize = 8 + // discriminator
        32 + // wallet
        8 +  // tokens_purchased_today
        8 +  // last_purchase_day
        8 +  // total_tokens_purchased
        8 +  // polls_created
        8 +  // votes_cast
        1;   // bump
}
