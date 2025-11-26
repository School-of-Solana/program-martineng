use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount};

use crate::constants::*;
use crate::errors::MvoteError;
use crate::state::{Config, Poll, UserStats, VoteMode, VoteRecord};

#[derive(Accounts)]
#[instruction(poll_id: u64)]
pub struct Vote<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [USER_SEED, voter.key().as_ref()],
        bump = user_stats.bump
    )]
    pub user_stats: Account<'info, UserStats>,

    #[account(
        mut,
        seeds = [POLL_SEED, poll_id.to_le_bytes().as_ref()],
        bump = poll.bump
    )]
    pub poll: Account<'info, Poll>,

    #[account(
        init,
        payer = voter,
        space = VoteRecord::SIZE,
        seeds = [VOTE_SEED, poll_id.to_le_bytes().as_ref(), voter.key().as_ref()],
        bump
    )]
    pub vote_record: Account<'info, VoteRecord>,

    #[account(
        mut,
        seeds = [MINT_SEED],
        bump,
        constraint = token_mint.key() == config.token_mint
    )]
    pub token_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = voter
    )]
    pub voter_token_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(
    ctx: Context<Vote>,
    poll_id: u64,
    option_index: u8,
    token_amount: u64,
) -> Result<()> {
    let config = &ctx.accounts.config;
    let poll = &mut ctx.accounts.poll;
    let user_stats = &mut ctx.accounts.user_stats;
    let vote_record = &mut ctx.accounts.vote_record;
    let clock = Clock::get()?;
    let current_time = clock.unix_timestamp;

    // Check poll is active
    require!(poll.is_active, MvoteError::PollNotActive);

    // Check poll hasn't expired
    require!(current_time <= poll.end_time, MvoteError::PollExpired);

    // Check poll has started
    require!(current_time >= poll.start_time, MvoteError::PollNotStarted);

    // Check valid option
    require!(
        (option_index as usize) < poll.options.len(),
        MvoteError::InvalidOption
    );

    // Calculate tokens to burn based on vote mode
    let tokens_to_burn = match poll.vote_mode {
        VoteMode::FairVote => config.vote_cost,
        VoteMode::HoldingVote => {
            require!(token_amount >= config.vote_cost, MvoteError::MinimumVoteRequired);
            token_amount
        }
    };

    // Check token balance
    require!(
        ctx.accounts.voter_token_account.amount >= tokens_to_burn,
        MvoteError::InsufficientTokens
    );

    // Burn tokens
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.token_mint.to_account_info(),
                from: ctx.accounts.voter_token_account.to_account_info(),
                authority: ctx.accounts.voter.to_account_info(),
            },
        ),
        tokens_to_burn,
    )?;

    // Update vote counts
    let vote_weight = match poll.vote_mode {
        VoteMode::FairVote => 1,
        VoteMode::HoldingVote => tokens_to_burn,
    };

    poll.vote_counts[option_index as usize] = poll.vote_counts[option_index as usize]
        .checked_add(vote_weight)
        .ok_or(MvoteError::Overflow)?;

    poll.total_votes = poll
        .total_votes
        .checked_add(1)
        .ok_or(MvoteError::Overflow)?;

    poll.total_tokens_spent = poll
        .total_tokens_spent
        .checked_add(tokens_to_burn)
        .ok_or(MvoteError::Overflow)?;

    // Initialize vote record
    vote_record.voter = ctx.accounts.voter.key();
    vote_record.poll_id = poll_id;
    vote_record.option_index = option_index;
    vote_record.tokens_spent = tokens_to_burn;
    vote_record.voted_at = current_time;
    vote_record.bump = ctx.bumps.vote_record;

    // Update user stats
    user_stats.votes_cast = user_stats
        .votes_cast
        .checked_add(1)
        .ok_or(MvoteError::Overflow)?;

    msg!(
        "Vote cast on poll {} for option {} with {} tokens",
        poll_id,
        option_index,
        tokens_to_burn
    );

    Ok(())
}
