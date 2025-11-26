import { Program, AnchorProvider, Idl, BN } from "@coral-xyz/anchor";
import { Connection, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import idl from "./mvote.json";

export const PROGRAM_ID = new PublicKey(idl.address);

// Seeds
const CONFIG_SEED = Buffer.from("config");
const MINT_SEED = Buffer.from("mint");
const VAULT_SEED = Buffer.from("vault");
const USER_SEED = Buffer.from("user");
const POLL_SEED = Buffer.from("poll");
const VOTE_SEED = Buffer.from("vote");

// PDAs
export const getConfigPda = () => {
  return PublicKey.findProgramAddressSync([CONFIG_SEED], PROGRAM_ID)[0];
};

export const getMintPda = () => {
  return PublicKey.findProgramAddressSync([MINT_SEED], PROGRAM_ID)[0];
};

export const getVaultPda = () => {
  return PublicKey.findProgramAddressSync([VAULT_SEED], PROGRAM_ID)[0];
};

export const getUserStatsPda = (wallet: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [USER_SEED, wallet.toBuffer()],
    PROGRAM_ID
  )[0];
};

export const getPollPda = (pollId: BN | number) => {
  const id = typeof pollId === "number" ? new BN(pollId) : pollId;
  return PublicKey.findProgramAddressSync(
    [POLL_SEED, id.toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  )[0];
};

export const getVoteRecordPda = (pollId: BN | number, voter: PublicKey) => {
  const id = typeof pollId === "number" ? new BN(pollId) : pollId;
  return PublicKey.findProgramAddressSync(
    [VOTE_SEED, id.toArrayLike(Buffer, "le", 8), voter.toBuffer()],
    PROGRAM_ID
  )[0];
};

export const getProgram = (provider: AnchorProvider) => {
  return new Program(idl as Idl, provider);
};

// Types
export type VoteMode = { fairVote: {} } | { holdingVote: {} };
export type VotingStyle = { binary: {} } | { multipleChoice: {} };

export interface Config {
  admin: PublicKey;
  tokenMint: PublicKey;
  solVault: PublicKey;
  solUsdRate: BN;
  tokensPerUsd: BN;
  dailyPurchaseLimit: BN;
  pollCreationCost: BN;
  voteCost: BN;
  totalPollsCreated: BN;
  bump: number;
}

export interface UserStats {
  wallet: PublicKey;
  tokensPurchasedToday: BN;
  lastPurchaseDay: BN;
  totalTokensPurchased: BN;
  pollsCreated: BN;
  votesCast: BN;
  bump: number;
}

export interface Poll {
  id: BN;
  creator: PublicKey;
  question: string;
  options: string[];
  voteCounts: BN[];
  voteMode: VoteMode;
  votingStyle: VotingStyle;
  startTime: BN;
  endTime: BN;
  totalVotes: BN;
  totalTokensSpent: BN;
  isActive: boolean;
  bump: number;
}

export interface VoteRecord {
  voter: PublicKey;
  pollId: BN;
  optionIndex: number;
  tokensSpent: BN;
  votedAt: BN;
  bump: number;
}

// Helper functions
export const formatTokenAmount = (amount: BN | number): string => {
  const value = typeof amount === "number" ? amount : amount.toNumber();
  return (value / 1_000_000).toFixed(2);
};

export const parseTokenAmount = (amount: number): BN => {
  return new BN(Math.floor(amount * 1_000_000));
};

export const isVoteModeFair = (mode: VoteMode): boolean => {
  return "fairVote" in mode;
};

export const isVotingStyleBinary = (style: VotingStyle): boolean => {
  return "binary" in style;
};
