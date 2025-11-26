"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useConnection } from "@solana/wallet-adapter-react";
import { Keypair } from "@solana/web3.js";
import { AnchorProvider, Idl, Program, BN } from "@coral-xyz/anchor";
import Link from "next/link";
import { VoteForm } from "@/components/polls/VoteForm";
import {
  getPollPda,
  Poll,
  isVoteModeFair,
  isVotingStyleBinary,
  formatTokenAmount,
} from "@/lib/anchor/program";
import idl from "@/lib/anchor/mvote.json";

export default function PollDetailPage() {
  const params = useParams();
  const pollId = Number(params.id);
  const { connection } = useConnection();

  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchPoll = useCallback(async () => {
    try {
      const dummyWallet = Keypair.generate();
      const provider = new AnchorProvider(
        connection,
        {
          publicKey: dummyWallet.publicKey,
          signTransaction: async (tx) => tx,
          signAllTransactions: async (txs) => txs,
        },
        { commitment: "confirmed" }
      );

      const program = new Program(idl as Idl, provider);
      const pollPda = getPollPda(pollId);
      const pollData = (await (program.account as any).poll.fetch(
        pollPda
      )) as Poll;

      setPoll(pollData);
    } catch (err) {
      console.error("Error fetching poll:", err);
      setError("Poll not found");
    } finally {
      setLoading(false);
    }
  }, [connection, pollId]);

  useEffect(() => {
    fetchPoll();
  }, [fetchPoll]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (error || !poll) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 mb-4">{error || "Poll not found"}</p>
        <Link href="/" className="text-purple-400 hover:text-purple-300">
          Back to polls
        </Link>
      </div>
    );
  }

  const now = Date.now() / 1000;
  const endTime = poll.endTime.toNumber();
  const isExpired = now > endTime || !poll.isActive;
  const timeLeft = Math.max(0, endTime - now);

  const formatTimeLeft = (seconds: number) => {
    if (seconds <= 0) return "Ended";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const totalVotes = poll.voteCounts.reduce(
    (acc, count) => acc + count.toNumber(),
    0
  );

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/"
        className="text-gray-400 hover:text-white mb-6 inline-block"
      >
        &larr; Back to polls
      </Link>

      <div className="bg-gray-800 rounded-xl p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex gap-2">
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${
                isVoteModeFair(poll.voteMode)
                  ? "bg-green-500/20 text-green-400"
                  : "bg-blue-500/20 text-blue-400"
              }`}
            >
              {isVoteModeFair(poll.voteMode) ? "Fair Vote" : "Holding Vote"}
            </span>
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${
                isVotingStyleBinary(poll.votingStyle)
                  ? "bg-yellow-500/20 text-yellow-400"
                  : "bg-purple-500/20 text-purple-400"
              }`}
            >
              {isVotingStyleBinary(poll.votingStyle)
                ? "Binary"
                : "Multiple Choice"}
            </span>
          </div>
          <span
            className={`text-sm font-medium ${
              isExpired ? "text-red-400" : "text-green-400"
            }`}
          >
            {isExpired ? "Ended" : formatTimeLeft(timeLeft)}
          </span>
        </div>

        <h1 className="text-2xl font-bold text-white mb-6">{poll.question}</h1>

        <div className="space-y-3 mb-6">
          {poll.options.map((option, index) => {
            const voteCount = poll.voteCounts[index]?.toNumber() || 0;
            const percentage =
              totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;

            return (
              <div
                key={index}
                className="relative bg-gray-700/50 rounded-lg overflow-hidden"
              >
                <div
                  className="absolute inset-0 bg-purple-500/30"
                  style={{ width: `${percentage}%` }}
                />
                <div className="relative flex justify-between items-center px-4 py-3">
                  <span className="text-white font-medium">{option}</span>
                  <div className="text-right">
                    <span className="text-white font-medium">
                      {percentage.toFixed(1)}%
                    </span>
                    <span className="text-gray-400 text-sm ml-2">
                      {isVoteModeFair(poll.voteMode)
                        ? `(${voteCount} votes)`
                        : `(${formatTokenAmount(voteCount)} mVote)`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="bg-gray-700/50 rounded-lg p-3">
            <p className="text-gray-400 text-sm">Total Votes</p>
            <p className="text-white font-medium">
              {poll.totalVotes.toNumber()}
            </p>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-3">
            <p className="text-gray-400 text-sm">Tokens Spent</p>
            <p className="text-white font-medium">
              {formatTokenAmount(poll.totalTokensSpent)} mVote
            </p>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-3">
            <p className="text-gray-400 text-sm">Created</p>
            <p className="text-white font-medium">
              {new Date(poll.startTime.toNumber() * 1000).toLocaleDateString()}
            </p>
          </div>
          <div className="bg-gray-700/50 rounded-lg p-3">
            <p className="text-gray-400 text-sm">
              {isExpired ? "Ended" : "Ends"}
            </p>
            <p className="text-white font-medium">
              {new Date(poll.endTime.toNumber() * 1000).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {!isExpired && <VoteForm poll={poll} pollId={pollId} onVoted={fetchPoll} />}

      {isExpired && (
        <div className="bg-gray-800 rounded-xl p-6 text-center">
          <p className="text-gray-400">
            This poll has ended. Voting is no longer available.
          </p>
        </div>
      )}
    </div>
  );
}
