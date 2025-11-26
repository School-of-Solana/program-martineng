use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum VoteMode {
    /// Each user can vote once, costs 1 mVote
    FairVote,
    /// Users can vote multiple times with any amount of mVote
    HoldingVote,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum VotingStyle {
    /// Yes/No or Agree/Disagree
    Binary,
    /// Multiple choice options (A, B, C, D)
    MultipleChoice,
}

#[account]
#[derive(InitSpace)]
pub struct Poll {
    /// Unique poll identifier
    pub id: u64,
    /// Poll creator
    pub creator: Pubkey,
    /// Poll question (max 280 chars)
    #[max_len(280)]
    pub question: String,
    /// Voting options (2-4 options, max 100 chars each)
    #[max_len(4, 100)]
    pub options: Vec<String>,
    /// Vote counts for each option
    #[max_len(4)]
    pub vote_counts: Vec<u64>,
    /// Voting mode (Fair or Holding)
    pub vote_mode: VoteMode,
    /// Voting style (Binary or Multiple Choice)
    pub voting_style: VotingStyle,
    /// Poll start time (unix timestamp)
    pub start_time: i64,
    /// Poll end time (unix timestamp)
    pub end_time: i64,
    /// Total number of votes cast
    pub total_votes: u64,
    /// Total tokens spent on this poll
    pub total_tokens_spent: u64,
    /// Whether the poll is active
    pub is_active: bool,
    /// Bump seed for PDA
    pub bump: u8,
}

impl Poll {
    // Base size + dynamic allocations
    pub const SIZE: usize = 8 +    // discriminator
        8 +                         // id
        32 +                        // creator
        4 + 280 +                   // question (vec prefix + max chars)
        4 + (4 * (4 + 100)) +       // options (vec prefix + 4 * (vec prefix + 100 chars))
        4 + (4 * 8) +               // vote_counts (vec prefix + 4 * u64)
        1 +                         // vote_mode
        1 +                         // voting_style
        8 +                         // start_time
        8 +                         // end_time
        8 +                         // total_votes
        8 +                         // total_tokens_spent
        1 +                         // is_active
        1;                          // bump
}
