"use client";

import Link from "next/link";
import { Poll, isVoteModeFair, formatTokenAmount } from "@/lib/anchor/program";

interface Props {
  poll: Poll;
  pollId: number;
}

export const PollCard = ({ poll, pollId }: Props) => {
  const now = Date.now() / 1000;
  const endTime = poll.endTime.toNumber();
  const isExpired = now > endTime || !poll.isActive;
  const timeLeft = Math.max(0, endTime - now);

  const formatTimeLeft = (seconds: number) => {
    if (seconds <= 0) return "Ended";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  const totalVotes = poll.voteCounts.reduce(
    (acc, count) => acc + count.toNumber(),
    0
  );

  return (
    <Link href={`/polls/${pollId}`}>
      <div className="bg-gray-800 rounded-xl p-6 hover:bg-gray-750 transition cursor-pointer border border-gray-700 hover:border-purple-500">
        <div className="flex justify-between items-start mb-4">
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
            className={`text-sm ${
              isExpired ? "text-red-400" : "text-green-400"
            }`}
          >
            {formatTimeLeft(timeLeft)}
          </span>
        </div>

        <h3 className="text-lg font-semibold text-white mb-4 line-clamp-2">
          {poll.question}
        </h3>

        <div className="space-y-2 mb-4">
          {poll.options.slice(0, 2).map((option, index) => {
            const voteCount = poll.voteCounts[index]?.toNumber() || 0;
            const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;

            return (
              <div key={index} className="relative">
                <div
                  className="absolute inset-0 bg-purple-500/20 rounded"
                  style={{ width: `${percentage}%` }}
                />
                <div className="relative flex justify-between items-center px-3 py-2">
                  <span className="text-gray-300 text-sm truncate">
                    {option}
                  </span>
                  <span className="text-gray-400 text-sm ml-2">
                    {percentage.toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}
          {poll.options.length > 2 && (
            <p className="text-gray-500 text-sm">
              +{poll.options.length - 2} more options
            </p>
          )}
        </div>

        <div className="flex justify-between text-sm text-gray-400">
          <span>{poll.totalVotes.toNumber()} votes</span>
          <span>
            {isVoteModeFair(poll.voteMode)
              ? `${poll.totalVotes.toNumber()} participants`
              : `${formatTokenAmount(poll.totalTokensSpent)} mVote spent`}
          </span>
        </div>
      </div>
    </Link>
  );
};
