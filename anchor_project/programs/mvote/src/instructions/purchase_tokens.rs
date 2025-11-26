use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};

use crate::constants::*;
use crate::errors::MvoteError;
use crate::state::{Config, UserStats};

#[derive(Accounts)]
pub struct PurchaseTokens<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,

    #[account(
        init_if_needed,
        payer = buyer,
        space = UserStats::SIZE,
        seeds = [USER_SEED, buyer.key().as_ref()],
        bump
    )]
    pub user_stats: Account<'info, UserStats>,

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
        associated_token::authority = buyer
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    /// CHECK: SOL vault PDA
    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump
    )]
    pub sol_vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<PurchaseTokens>, amount: u64) -> Result<()> {
    require!(amount > 0, MvoteError::InvalidAmount);

    let config = &ctx.accounts.config;
    let user_stats = &mut ctx.accounts.user_stats;
    let clock = Clock::get()?;
    let current_time = clock.unix_timestamp;

    // Initialize user stats if new
    if user_stats.wallet == Pubkey::default() {
        user_stats.wallet = ctx.accounts.buyer.key();
        user_stats.tokens_purchased_today = 0;
        user_stats.last_purchase_day = 0;
        user_stats.total_tokens_purchased = 0;
        user_stats.polls_created = 0;
        user_stats.votes_cast = 0;
        user_stats.bump = ctx.bumps.user_stats;
    }

    // Check if it's a new day in SGT and reset daily limit
    if is_new_day_sgt(user_stats.last_purchase_day, current_time) {
        user_stats.tokens_purchased_today = 0;
        user_stats.last_purchase_day = current_time;
    }

    // Check daily limit
    let new_total = user_stats
        .tokens_purchased_today
        .checked_add(amount)
        .ok_or(MvoteError::Overflow)?;
    require!(
        new_total <= config.daily_purchase_limit,
        MvoteError::DailyLimitExceeded
    );

    // Calculate SOL cost
    // amount is in token smallest units (6 decimals)
    // sol_usd_rate is price in cents (e.g., 15000 = $150.00)
    // 1 USD = 1 mVote = 1_000_000 units
    let sol_cost = calculate_sol_cost(amount, config.sol_usd_rate)?;

    // Transfer SOL from buyer to vault
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.sol_vault.to_account_info(),
            },
        ),
        sol_cost,
    )?;

    // Mint tokens to buyer
    let config_seeds = &[CONFIG_SEED, &[config.bump]];
    let signer_seeds = &[&config_seeds[..]];

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.token_mint.to_account_info(),
                to: ctx.accounts.buyer_token_account.to_account_info(),
                authority: ctx.accounts.config.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    // Update user stats
    user_stats.tokens_purchased_today = new_total;
    user_stats.total_tokens_purchased = user_stats
        .total_tokens_purchased
        .checked_add(amount)
        .ok_or(MvoteError::Overflow)?;

    msg!(
        "Purchased {} mVote tokens for {} lamports",
        amount,
        sol_cost
    );

    Ok(())
}

/// Check if it's a new day in SGT (UTC+8)
fn is_new_day_sgt(last_timestamp: i64, current_timestamp: i64) -> bool {
    if last_timestamp == 0 {
        return true;
    }

    let last_day = (last_timestamp + SGT_OFFSET_SECONDS) / SECONDS_PER_DAY;
    let current_day = (current_timestamp + SGT_OFFSET_SECONDS) / SECONDS_PER_DAY;

    current_day > last_day
}

/// Calculate SOL cost in lamports for given token amount
fn calculate_sol_cost(token_amount: u64, sol_usd_rate: u64) -> Result<u64> {
    // token_amount is in smallest units (6 decimals), so 1_000_000 = 1 mVote = $1
    // sol_usd_rate is in cents, so 15000 = $150.00
    // LAMPORTS_PER_SOL = 1_000_000_000

    // USD cost = token_amount / 1_000_000
    // SOL cost = USD_cost / (sol_usd_rate / 100)
    // lamports = SOL_cost * 1_000_000_000

    // Simplified: lamports = (token_amount * 1_000_000_000 * 100) / (1_000_000 * sol_usd_rate)
    // = (token_amount * 100_000) / sol_usd_rate

    let lamports = (token_amount as u128)
        .checked_mul(100_000_000_000)
        .ok_or(MvoteError::Overflow)?
        .checked_div(sol_usd_rate as u128)
        .ok_or(MvoteError::Overflow)?
        .checked_div(1_000_000)
        .ok_or(MvoteError::Overflow)? as u64;

    Ok(lamports)
}
