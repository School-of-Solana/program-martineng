use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;
use state::{VoteMode, VotingStyle};

declare_id!("5BWRzdnfyupL8h4MpdHVgZT5bibUeLq85qrDUsu7QVmZ");

#[program]
pub mod mvote {
    use super::*;

    /// Initialize the mVote program with config and token mint
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::initialize::handler(ctx)
    }

    /// Purchase mVote tokens with SOL
    pub fn purchase_tokens(ctx: Context<PurchaseTokens>, amount: u64) -> Result<()> {
        instructions::purchase_tokens::handler(ctx, amount)
    }

    /// Create a new poll
    pub fn create_poll(
        ctx: Context<CreatePoll>,
        question: String,
        options: Vec<String>,
        vote_mode: VoteMode,
        voting_style: VotingStyle,
        duration_minutes: u16,
    ) -> Result<()> {
        instructions::create_poll::handler(ctx, question, options, vote_mode, voting_style, duration_minutes)
    }

    /// Cast a vote on a poll
    pub fn vote(
        ctx: Context<Vote>,
        poll_id: u64,
        option_index: u8,
        token_amount: u64,
    ) -> Result<()> {
        instructions::vote::handler(ctx, poll_id, option_index, token_amount)
    }

    /// Close a poll (creator only)
    pub fn close_poll(ctx: Context<ClosePoll>, poll_id: u64) -> Result<()> {
        instructions::close_poll::handler(ctx, poll_id)
    }
}
