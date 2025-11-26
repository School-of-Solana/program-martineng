use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount};

use crate::constants::*;
use crate::errors::MvoteError;
use crate::state::{Config, Poll, UserStats, VoteMode, VotingStyle};

#[derive(Accounts)]
pub struct CreatePoll<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [USER_SEED, creator.key().as_ref()],
        bump = user_stats.bump
    )]
    pub user_stats: Account<'info, UserStats>,

    #[account(
        init,
        payer = creator,
        space = Poll::SIZE,
        seeds = [POLL_SEED, config.total_polls_created.to_le_bytes().as_ref()],
        bump
    )]
    pub poll: Account<'info, Poll>,

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
        associated_token::authority = creator
    )]
    pub creator_token_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(
    ctx: Context<CreatePoll>,
    question: String,
    options: Vec<String>,
    vote_mode: VoteMode,
    voting_style: VotingStyle,
    duration_minutes: u16,
) -> Result<()> {
    let config = &mut ctx.accounts.config;
    let user_stats = &mut ctx.accounts.user_stats;
    let poll = &mut ctx.accounts.poll;
    let clock = Clock::get()?;

    // Validate question length
    require!(
        !question.is_empty() && question.len() <= MAX_QUESTION_LENGTH,
        MvoteError::InvalidQuestionLength
    );

    // Validate options count
    require!(
        options.len() >= MIN_OPTIONS && options.len() <= MAX_OPTIONS,
        MvoteError::InvalidOptionCount
    );

    // Validate each option length
    for option in &options {
        require!(
            !option.is_empty() && option.len() <= MAX_OPTION_LENGTH,
            MvoteError::InvalidOptionLength
        );
    }

    // Validate duration
    require!(
        duration_minutes >= MIN_DURATION_MINUTES && duration_minutes <= MAX_DURATION_MINUTES,
        MvoteError::InvalidDuration
    );

    // Check token balance
    require!(
        ctx.accounts.creator_token_account.amount >= config.poll_creation_cost,
        MvoteError::InsufficientTokens
    );

    // Burn tokens for poll creation
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.token_mint.to_account_info(),
                from: ctx.accounts.creator_token_account.to_account_info(),
                authority: ctx.accounts.creator.to_account_info(),
            },
        ),
        config.poll_creation_cost,
    )?;

    // Initialize poll
    let poll_id = config.total_polls_created;
    let start_time = clock.unix_timestamp;
    let end_time = start_time + (duration_minutes as i64 * 60);

    poll.id = poll_id;
    poll.creator = ctx.accounts.creator.key();
    poll.question = question;
    poll.options = options.clone();
    poll.vote_counts = vec![0u64; options.len()];
    poll.vote_mode = vote_mode;
    poll.voting_style = voting_style;
    poll.start_time = start_time;
    poll.end_time = end_time;
    poll.total_votes = 0;
    poll.total_tokens_spent = 0;
    poll.is_active = true;
    poll.bump = ctx.bumps.poll;

    // Update config
    config.total_polls_created = config
        .total_polls_created
        .checked_add(1)
        .ok_or(MvoteError::Overflow)?;

    // Update user stats
    user_stats.polls_created = user_stats
        .polls_created
        .checked_add(1)
        .ok_or(MvoteError::Overflow)?;

    msg!("Poll created with ID: {}", poll_id);
    msg!("Question: {}", poll.question);
    msg!("Ends at: {}", end_time);

    Ok(())
}
