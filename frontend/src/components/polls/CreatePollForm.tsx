"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/navigation";
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
  VoteMode,
  VotingStyle,
  Config,
} from "@/lib/anchor/program";

export const CreatePollForm = () => {
  const { publicKey } = useWallet();
  const { program } = useProgram();
  const { balance, refetch } = useTokenBalance();
  const router = useRouter();

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [voteMode, setVoteMode] = useState<"fair" | "holding">("fair");
  const [votingStyle, setVotingStyle] = useState<"binary" | "multiple">(
    "binary"
  );
  const [duration, setDuration] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAddOption = () => {
    if (options.length < 4) {
      setOptions([...options, ""]);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!publicKey || !program) {
      setError("Please connect your wallet");
      return;
    }

    if (balance < 10) {
      setError("You need at least 10 mVote to create a poll");
      return;
    }

    if (!question.trim()) {
      setError("Please enter a question");
      return;
    }

    const validOptions = options.filter((o) => o.trim());
    if (validOptions.length < 2) {
      setError("Please enter at least 2 options");
      return;
    }

    setLoading(true);

    try {
      const configPda = getConfigPda();
      const config = (await (program.account as any).config.fetch(
        configPda
      )) as Config;
      const pollId = config.totalPollsCreated;
      const pollPda = getPollPda(pollId);
      const mintPda = getMintPda();
      const userStatsPda = getUserStatsPda(publicKey);
      const creatorTokenAccount = getAssociatedTokenAddressSync(
        mintPda,
        publicKey
      );

      const voteModeArg: VoteMode =
        voteMode === "fair" ? { fairVote: {} } : { holdingVote: {} };
      const votingStyleArg: VotingStyle =
        votingStyle === "binary" ? { binary: {} } : { multipleChoice: {} };

      await program.methods
        .createPoll(question, validOptions, voteModeArg, votingStyleArg, duration)
        .accounts({
          creator: publicKey,
          config: configPda,
          userStats: userStatsPda,
          poll: pollPda,
          tokenMint: mintPda,
          creatorTokenAccount: creatorTokenAccount,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      await refetch();
      router.push(`/polls/${pollId.toNumber()}`);
    } catch (err: any) {
      console.error("Error creating poll:", err);
      setError(err.message || "Failed to create poll");
    } finally {
      setLoading(false);
    }
  };

  if (!publicKey) {
    return (
      <div className="bg-gray-800 rounded-xl p-8 text-center">
        <p className="text-gray-400">Please connect your wallet to create a poll</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-800 rounded-xl p-6 space-y-6">
      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Question
        </label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={280}
          rows={3}
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
          placeholder="What would you like to ask?"
        />
        <p className="text-gray-500 text-sm mt-1">{question.length}/280</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Options
        </label>
        <div className="space-y-2">
          {options.map((option, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={option}
                onChange={(e) => handleOptionChange(index, e.target.value)}
                maxLength={100}
                className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                placeholder={`Option ${index + 1}`}
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => handleRemoveOption(index)}
                  className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
                >
                  X
                </button>
              )}
            </div>
          ))}
        </div>
        {options.length < 4 && (
          <button
            type="button"
            onClick={handleAddOption}
            className="mt-2 text-purple-400 hover:text-purple-300 text-sm"
          >
            + Add option
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Vote Mode
          </label>
          <select
            value={voteMode}
            onChange={(e) => setVoteMode(e.target.value as "fair" | "holding")}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
          >
            <option value="fair">Fair Vote (1 vote per wallet)</option>
            <option value="holding">Holding Vote (stake tokens)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Voting Style
          </label>
          <select
            value={votingStyle}
            onChange={(e) =>
              setVotingStyle(e.target.value as "binary" | "multiple")
            }
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
          >
            <option value="binary">Binary (Yes/No)</option>
            <option value="multiple">Multiple Choice</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Duration: {duration} minutes ({(duration / 60).toFixed(1)} hours)
        </label>
        <input
          type="range"
          min={10}
          max={1440}
          step={10}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-gray-500 text-sm">
          <span>10 min</span>
          <span>24 hours</span>
        </div>
      </div>

      <div className="bg-gray-700/50 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-300">Creation Cost</span>
          <span className="text-purple-400 font-medium">10 mVote</span>
        </div>
        <div className="flex justify-between items-center mt-1">
          <span className="text-gray-400 text-sm">Your Balance</span>
          <span className="text-gray-400 text-sm">{balance.toFixed(2)} mVote</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || balance < 10}
        className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition"
      >
        {loading ? "Creating..." : "Create Poll (10 mVote)"}
      </button>
    </form>
  );
};
