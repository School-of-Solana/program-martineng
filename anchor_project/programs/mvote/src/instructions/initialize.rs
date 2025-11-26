use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};

use crate::constants::*;
use crate::state::Config;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = Config::SIZE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = admin,
        mint::decimals = TOKEN_DECIMALS,
        mint::authority = config,
        seeds = [MINT_SEED],
        bump
    )]
    pub token_mint: Account<'info, Mint>,

    /// CHECK: This is the SOL vault PDA
    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump
    )]
    pub sol_vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<Initialize>) -> Result<()> {
    let config = &mut ctx.accounts.config;

    config.admin = ctx.accounts.admin.key();
    config.token_mint = ctx.accounts.token_mint.key();
    config.sol_vault = ctx.accounts.sol_vault.key();
    config.sol_usd_rate = SOL_USD_RATE;
    config.tokens_per_usd = TOKENS_PER_USD;
    config.daily_purchase_limit = DAILY_PURCHASE_LIMIT;
    config.poll_creation_cost = POLL_CREATION_COST;
    config.vote_cost = VOTE_COST;
    config.total_polls_created = 0;
    config.bump = ctx.bumps.config;

    msg!("mVote program initialized!");
    msg!("Token Mint: {}", ctx.accounts.token_mint.key());
    msg!("SOL Vault: {}", ctx.accounts.sol_vault.key());

    Ok(())
}
