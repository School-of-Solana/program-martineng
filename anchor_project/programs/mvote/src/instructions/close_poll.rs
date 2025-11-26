use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::MvoteError;
use crate::state::Poll;

#[derive(Accounts)]
#[instruction(poll_id: u64)]
pub struct ClosePoll<'info> {
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [POLL_SEED, poll_id.to_le_bytes().as_ref()],
        bump = poll.bump,
        constraint = poll.creator == creator.key() @ MvoteError::Unauthorized
    )]
    pub poll: Account<'info, Poll>,
}

pub fn handler(ctx: Context<ClosePoll>, _poll_id: u64) -> Result<()> {
    let poll = &mut ctx.accounts.poll;

    // Check poll is still active
    require!(poll.is_active, MvoteError::PollNotActive);

    // Close the poll
    poll.is_active = false;

    msg!("Poll {} closed by creator", poll.id);

    Ok(())
}
