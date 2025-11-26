# Project Description

**Deployed Frontend URL:** https://program-martineng.vercel.app/

**Solana Program ID:** `5BWRzdnfyupL8h4MpdHVgZT5bibUeLq85qrDUsu7QVmZ`

**Network:** Devnet

**Explorer:** [View on Solana Explorer](https://explorer.solana.com/address/5BWRzdnfyupL8h4MpdHVgZT5bibUeLq85qrDUsu7QVmZ?cluster=devnet)

### Deployed PDA Accounts
| Account | Address |
|---------|---------|
| Config | `9QDyoTpYvPHe3iQH4e5RTQ9F9VeWfMJa6Z9bSbif3MAc` |
| Token Mint | `EeWe6rT9yiqZQoV2PqEykHfkZJVPHxpTAyC56dYmZ7cy` |
| SOL Vault | `BgQACGKkNzsUYKURZaRowApnt7C7ZRYvCNqaizTrNCBf` |

## Project Overview

### Description
mVote is a decentralized voting platform built on Solana where users purchase mVote SPL tokens to create and participate in polls. The platform introduces token-based voting mechanics with anti-spam measures (daily purchase limits) and flexible poll configurations. Users can create polls with two different voting modes: Fair Vote (1 vote per wallet for democratic decisions) or Holding Vote (stake tokens to show conviction). The dApp demonstrates Solana program development concepts including PDAs, SPL token minting/burning, and on-chain state management.

### Key Features
- **mVote Token Purchase**: Users buy mVote tokens using SOL at a rate of $1 USD worth of SOL = 1 mVote
- **Daily Purchase Limit**: 100 mVote per wallet per day, resetting at 00:00 SGT (UTC+8) to prevent whale accumulation
- **Poll Creation**: Create polls for 10 mVote with customizable options, duration, and voting mode
- **Fair Vote Mode**: Each wallet can vote once, costing 1 mVote - ideal for democratic decisions
- **Holding Vote Mode**: Users stake any amount of mVote to vote - votes are weighted by tokens spent
- **Binary & Multiple Choice**: Support for Yes/No polls or up to 4 options
- **Timed Polls**: Duration from 10 minutes to 24 hours
- **Real-time Results**: View vote distribution and statistics as votes are cast

### How to Use the dApp

1. **Connect Wallet** - Click "Select Wallet" and connect your Phantom wallet (Devnet)
2. **Purchase mVote Tokens**
   - Navigate to "Buy Tokens" page
   - Select amount (1-100 mVote per day)
   - Confirm transaction to receive mVote tokens
3. **Create a Poll**
   - Go to "Create" page
   - Enter your question (max 280 characters)
   - Add 2-4 voting options
   - Select vote mode (Fair Vote or Holding Vote)
   - Select voting style (Binary or Multiple Choice)
   - Set duration (10 min - 24 hours)
   - Pay 10 mVote to create the poll
4. **Vote on Polls**
   - Browse active polls on the home page
   - Click a poll to view details
   - Select your option
   - For Holding Vote, choose how many tokens to spend
   - Confirm transaction to cast your vote
5. **View Results**
   - See real-time vote percentages on poll cards
   - View detailed statistics on poll detail pages

## Program Architecture

The mVote program uses a modular architecture with separate files for state accounts and instructions. The program leverages PDAs for deterministic account addresses and SPL tokens for the voting economy.

### PDA Usage
Program Derived Addresses are used extensively to create deterministic, program-controlled accounts:

**PDAs Used:**
- **Config PDA** `["config"]`: Stores global program configuration including admin, token mint address, SOL vault, pricing, and total polls counter. Single instance for the entire program.
- **Mint PDA** `["mint"]`: The mVote SPL token mint. Program has mint authority to mint tokens when users purchase.
- **Vault PDA** `["vault"]`: Receives SOL payments when users purchase tokens. Program-controlled treasury.
- **UserStats PDA** `["user", wallet_pubkey]`: Tracks per-user statistics including daily purchase amounts, total purchases, polls created, and votes cast. Enables daily limit enforcement.
- **Poll PDA** `["poll", poll_id_bytes]`: Stores poll data including question, options, vote counts, mode, timing, and status. Poll ID is an incrementing counter from Config.
- **VoteRecord PDA** `["vote", poll_id_bytes, voter_pubkey]`: Records that a user voted on a specific poll. Prevents double voting in Fair Vote mode.

### Program Instructions

**Instructions Implemented:**
- **initialize**: Sets up the program by creating Config, Mint, and Vault PDAs. Called once by admin to bootstrap the program.
- **purchase_tokens**: Allows users to buy mVote tokens with SOL. Enforces daily limit of 100 mVote. Creates/updates UserStats PDA. Mints tokens to buyer's associated token account.
- **create_poll**: Creates a new poll by burning 10 mVote from creator. Validates question length, option count, and duration. Initializes Poll PDA with provided settings.
- **vote**: Casts a vote on an active poll. Burns 1 mVote (Fair Vote) or specified amount (Holding Vote). Creates VoteRecord PDA to track vote. Updates poll vote counts.
- **close_poll**: Allows poll creator to close a poll early. Sets `is_active` to false, preventing further votes.

### Account Structure

```rust
#[account]
pub struct Config {
    pub admin: Pubkey,              // Program admin
    pub token_mint: Pubkey,         // mVote token mint
    pub sol_vault: Pubkey,          // SOL collection vault
    pub sol_usd_rate: u64,          // SOL/USD rate (e.g., 15000 = $150.00)
    pub tokens_per_usd: u64,        // Tokens per USD (1_000_000 with 6 decimals)
    pub daily_purchase_limit: u64,  // 100_000_000 (100 tokens)
    pub poll_creation_cost: u64,    // 10_000_000 (10 tokens)
    pub vote_cost: u64,             // 1_000_000 (1 token)
    pub total_polls_created: u64,   // Counter for poll IDs
    pub bump: u8,
}

#[account]
pub struct UserStats {
    pub wallet: Pubkey,             // User wallet address
    pub tokens_purchased_today: u64, // Tokens purchased today
    pub last_purchase_day: i64,     // Timestamp for daily reset (SGT)
    pub total_tokens_purchased: u64, // Lifetime purchases
    pub polls_created: u64,         // Number of polls created
    pub votes_cast: u64,            // Number of votes cast
    pub bump: u8,
}

#[account]
pub struct Poll {
    pub id: u64,                    // Unique poll identifier
    pub creator: Pubkey,            // Poll creator
    pub question: String,           // Poll question (max 280 chars)
    pub options: Vec<String>,       // 2-4 voting options
    pub vote_counts: Vec<u64>,      // Vote counts per option
    pub vote_mode: VoteMode,        // FairVote or HoldingVote
    pub voting_style: VotingStyle,  // Binary or MultipleChoice
    pub start_time: i64,            // Unix timestamp
    pub end_time: i64,              // Unix timestamp
    pub total_votes: u64,           // Total votes cast
    pub total_tokens_spent: u64,    // Total mVote spent
    pub is_active: bool,            // Whether poll accepts votes
    pub bump: u8,
}

#[account]
pub struct VoteRecord {
    pub voter: Pubkey,              // Voter wallet address
    pub poll_id: u64,               // Poll ID voted on
    pub option_index: u8,           // Option chosen
    pub tokens_spent: u64,          // mVote spent on this vote
    pub voted_at: i64,              // Timestamp of vote
    pub bump: u8,
}
```

## Testing

### Test Coverage
Comprehensive test suite with 21 tests covering all 5 instructions. Tests verify both successful operations (happy path) and error conditions (unhappy path) to ensure program security and reliability.

**Happy Path Tests:**
- `should initialize the program` - Creates Config, Mint, and Vault PDAs
- `should purchase tokens successfully` - User buys 10 mVote with SOL
- `should allow multiple purchases within daily limit` - User buys additional 50 mVote
- `should create a binary poll (FairVote)` - Creates Yes/No poll with Fair Vote mode
- `should create a multiple choice poll (HoldingVote)` - Creates 4-option poll with Holding Vote
- `should vote on FairVote poll successfully` - User votes and vote count updates
- `should vote on HoldingVote poll with custom amount` - User stakes 5 mVote to vote
- `should close poll by creator` - Creator closes poll early

**Unhappy Path Tests:**
- `should fail to initialize twice` - Prevents double initialization
- `should fail when exceeding daily limit` - Rejects purchase over 100 mVote/day
- `should fail with zero amount` - Rejects zero token purchase
- `should fail with invalid question length` - Rejects empty question
- `should fail with invalid option count` - Rejects single option poll
- `should fail with invalid duration` - Rejects duration outside 10-1440 minutes
- `should fail with insufficient tokens` - Rejects poll creation without 10 mVote
- `should fail to vote twice on FairVote poll` - Prevents double voting
- `should fail with invalid option index` - Rejects out-of-bounds option
- `should fail with insufficient tokens to vote` - Rejects vote without tokens
- `should fail to close poll by non-creator` - Only creator can close
- `should fail to close already closed poll` - Can't close twice
- `should fail to vote on closed poll` - Closed polls reject votes

### Running Tests
```bash
cd anchor_project
yarn install    # Install dependencies
anchor test     # Run all 21 tests
```

### Additional Notes for Evaluators

**Technical Highlights:**
- Uses `init_if_needed` for UserStats to automatically create account on first purchase
- Implements SGT (UTC+8) timezone for daily reset calculation
- Burns tokens on poll creation and voting (not transferred) to prevent manipulation
- VoteRecord PDA ensures one vote per user per poll in Fair Vote mode
- SOL/USD rate stored in Config allows future oracle integration

**Project Files:**
- `plan.md` - Detailed design document with architecture, token economics, and RWA examples
- `anchor_project/` - Complete Anchor program with modular code structure
- `frontend/` - Next.js 16 frontend with Tailwind CSS and wallet adapter

**Deployment Status:** Program deployed and initialized on Devnet.

**Deployment Transactions:**
- Deploy: [View on Explorer](https://explorer.solana.com/tx/4cmbVeeqBEJS2y88eZYhPkfHkejTTuRiYmPj1izmBQxsqSEexsbz3pZcjDh9cf8F4DKsRAqfqNduFj9hyomDzL8R?cluster=devnet)
- Initialize: [View on Explorer](https://explorer.solana.com/tx/tKUGLWVpQWLfRufNreGwfZqgFiYZCFcvK1KiaZXcrGDiBw2fX9dKpJwWisVRqHLj7UbVhnEUtVvUbUu3ifN1sfR?cluster=devnet)

**To Run Locally:**
```bash
cd anchor_project
yarn install    # Install dependencies
anchor test     # Run all 21 tests (uses localnet)
```

**To Deploy Frontend:**
```bash
cd frontend
npm install
npm run build
# Deploy to Vercel and update the URL above
```
