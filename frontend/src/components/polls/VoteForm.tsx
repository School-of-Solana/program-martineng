"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import { useProgram } from "@/hooks/useProgram";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import {
  getConfigPda,
  getMintPda,
  getUserStatsPda,
  getPollPda,
  getVoteRecordPda,
  Poll,
  isVoteModeFair,
  formatTokenAmount,
} from "@/lib/anchor/program";

interface Props {
  poll: Poll;
  pollId: number;
  onVoted: () => void;
}

export const VoteForm = ({ poll, pollId, onVoted }: Props) => {
  const { publicKey } = useWallet();
  const { program } = useProgram();
  const { balance, refetch } = useTokenBalance();

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [tokenAmount, setTokenAmount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isFairVote = isVoteModeFair(poll.voteMode);
  const voteCost = isFairVote ? 1 : tokenAmount;
  const totalVotes = poll.voteCounts.reduce(
    (acc, count) => acc + count.toNumber(),
    0
  );

  const handleVote = async () => {
    setError("");

    if (!publicKey || !program) {
      setError("Please connect your wallet");
      return;
    }

    if (selectedOption === null) {
      setError("Please select an option");
      return;
    }

    if (balance < voteCost) {
      setError(`You need at least ${voteCost} mVote to vote`);
      return;
    }

    setLoading(true);

    try {
      const configPda = getConfigPda();
      const pollPda = getPollPda(pollId);
      const mintPda = getMintPda();
      const userStatsPda = getUserStatsPda(publicKey);
      const voteRecordPda = getVoteRecordPda(pollId, publicKey);
      const voterTokenAccount = getAssociatedTokenAddressSync(mintPda, publicKey);

      const tokenAmountBN = new BN(voteCost * 1_000_000);

      await program.methods
        .vote(new BN(pollId), selectedOption, tokenAmountBN)
        .accounts({
          voter: publicKey,
          config: configPda,
          userStats: userStatsPda,
          poll: pollPda,
          voteRecord: voteRecordPda,
          tokenMint: mintPda,
          voterTokenAccount: voterTokenAccount,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      await refetch();
      onVoted();
    } catch (err: any) {
      console.error("Error voting:", err);
      if (err.message?.includes("already in use")) {
        setError("You have already voted on this poll");
      } else {
        setError(err.message || "Failed to vote");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!publicKey) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 text-center">
        <p className="text-gray-400">Please connect your wallet to vote</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl p-6 space-y-4">
      <h3 className="text-lg font-semibold text-white">Cast Your Vote</h3>

      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {poll.options.map((option, index) => {
          const voteCount = poll.voteCounts[index]?.toNumber() || 0;
          const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;

          return (
            <button
              key={index}
              onClick={() => setSelectedOption(index)}
              className={`w-full relative overflow-hidden rounded-lg border-2 transition ${
                selectedOption === index
                  ? "border-purple-500 bg-purple-500/10"
                  : "border-gray-700 hover:border-gray-600"
              }`}
            >
              <div
                className="absolute inset-0 bg-purple-500/20"
                style={{ width: `${percentage}%` }}
              />
              <div className="relative flex justify-between items-center px-4 py-3">
                <span className="text-white">{option}</span>
                <span className="text-gray-400">
                  {isFairVote
                    ? `${voteCount} votes`
                    : `${formatTokenAmount(voteCount)} mVote`}
                  {" "}({percentage.toFixed(1)}%)
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {!isFairVote && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Token Amount: {tokenAmount} mVote
          </label>
          <input
            type="range"
            min={1}
            max={Math.min(100, Math.floor(balance))}
            value={tokenAmount}
            onChange={(e) => setTokenAmount(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-gray-500 text-sm">
            <span>1 mVote</span>
            <span>{Math.min(100, Math.floor(balance))} mVote</span>
          </div>
        </div>
      )}

      <div className="bg-gray-700/50 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-300">Vote Cost</span>
          <span className="text-purple-400 font-medium">{voteCost} mVote</span>
        </div>
        <div className="flex justify-between items-center mt-1">
          <span className="text-gray-400 text-sm">Your Balance</span>
          <span className="text-gray-400 text-sm">
            {balance.toFixed(2)} mVote
          </span>
        </div>
      </div>

      <button
        onClick={handleVote}
        disabled={loading || selectedOption === null || balance < voteCost}
        className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition"
      >
        {loading ? "Voting..." : `Vote (${voteCost} mVote)`}
      </button>
    </div>
  );
};
