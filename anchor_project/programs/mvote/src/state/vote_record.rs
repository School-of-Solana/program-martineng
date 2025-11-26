use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct VoteRecord {
    /// Voter wallet address
    pub voter: Pubkey,
    /// Poll ID this vote is for
    pub poll_id: u64,
    /// Index of the chosen option
    pub option_index: u8,
    /// Total tokens spent on this vote
    pub tokens_spent: u64,
    /// Timestamp when vote was cast
    pub voted_at: i64,
    /// Bump seed for PDA
    pub bump: u8,
}

impl VoteRecord {
    pub const SIZE: usize = 8 + // discriminator
        32 + // voter
        8 +  // poll_id
        1 +  // option_index
        8 +  // tokens_spent
        8 +  // voted_at
        1;   // bump
}
