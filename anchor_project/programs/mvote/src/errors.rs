use anchor_lang::prelude::*;

#[error_code]
pub enum MvoteError {
    #[msg("Daily purchase limit exceeded (100 mVote max)")]
    DailyLimitExceeded,

    #[msg("Insufficient SOL balance")]
    InsufficientFunds,

    #[msg("Insufficient mVote token balance")]
    InsufficientTokens,

    #[msg("Question must be 1-280 characters")]
    InvalidQuestionLength,

    #[msg("Must have 2-4 voting options")]
    InvalidOptionCount,

    #[msg("Option text must be 1-100 characters")]
    InvalidOptionLength,

    #[msg("Duration must be 10-1440 minutes")]
    InvalidDuration,

    #[msg("Poll has not started yet")]
    PollNotStarted,

    #[msg("Poll has expired")]
    PollExpired,

    #[msg("Poll is not active")]
    PollNotActive,

    #[msg("Already voted on this poll")]
    AlreadyVoted,

    #[msg("Invalid option index")]
    InvalidOption,

    #[msg("Minimum 1 mVote required to vote")]
    MinimumVoteRequired,

    #[msg("Only poll creator can perform this action")]
    Unauthorized,

    #[msg("Arithmetic overflow")]
    Overflow,

    #[msg("Invalid amount")]
    InvalidAmount,
}
