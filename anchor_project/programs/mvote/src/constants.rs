// Seeds for PDAs
pub const CONFIG_SEED: &[u8] = b"config";
pub const MINT_SEED: &[u8] = b"mint";
pub const VAULT_SEED: &[u8] = b"vault";
pub const USER_SEED: &[u8] = b"user";
pub const POLL_SEED: &[u8] = b"poll";
pub const VOTE_SEED: &[u8] = b"vote";

// Token configuration
pub const TOKEN_DECIMALS: u8 = 6;
pub const TOKENS_PER_USD: u64 = 1_000_000; // 1 token = 1 USD (with 6 decimals)

// Limits
pub const DAILY_PURCHASE_LIMIT: u64 = 100_000_000; // 100 tokens (with 6 decimals)
pub const POLL_CREATION_COST: u64 = 10_000_000; // 10 tokens
pub const VOTE_COST: u64 = 1_000_000; // 1 token

// Poll constraints
pub const MAX_QUESTION_LENGTH: usize = 280;
pub const MAX_OPTION_LENGTH: usize = 100;
pub const MIN_OPTIONS: usize = 2;
pub const MAX_OPTIONS: usize = 4;
pub const MIN_DURATION_MINUTES: u16 = 10;
pub const MAX_DURATION_MINUTES: u16 = 1440; // 24 hours

// Time
pub const SGT_OFFSET_SECONDS: i64 = 8 * 60 * 60; // UTC+8
pub const SECONDS_PER_DAY: i64 = 86400;

// Fixed SOL/USD rate for simplicity (can be replaced with oracle)
// Representing $150.00 as 15000 (2 decimal places)
pub const SOL_USD_RATE: u64 = 15000; // $150.00 per SOL
