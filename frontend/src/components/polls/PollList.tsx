"use client";

import { useState, useEffect } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { BN } from "@coral-xyz/anchor";
import { PollCard } from "./PollCard";
import {
  getProgram,
  getConfigPda,
  getPollPda,
  Poll,
  Config,
} from "@/lib/anchor/program";
import { AnchorProvider, Idl, Program } from "@coral-xyz/anchor";
import { Keypair } from "@solana/web3.js";
import idl from "@/lib/anchor/mvote.json";
import { PROGRAM_ID } from "@/lib/anchor/program";

export const PollList = () => {
  const { connection } = useConnection();
  const [polls, setPolls] = useState<{ poll: Poll; id: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "ended">("all");

  useEffect(() => {
    const fetchPolls = async () => {
      try {
        // Create a read-only provider
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

        // Get config to know total polls
        const configPda = getConfigPda();
        const config = (await (program.account as any).config.fetch(
          configPda
        )) as Config;
        const totalPolls = config.totalPollsCreated.toNumber();

        // Fetch all polls
        const pollPromises = [];
        for (let i = 0; i < totalPolls; i++) {
          const pollPda = getPollPda(i);
          pollPromises.push(
            (program.account as any).poll
              .fetch(pollPda)
              .then((poll: any) => ({ poll: poll as Poll, id: i }))
              .catch(() => null)
          );
        }

        const fetchedPolls = (await Promise.all(pollPromises)).filter(
          (p): p is { poll: Poll; id: number } => p !== null
        );

        // Sort by newest first
        fetchedPolls.sort((a, b) => b.id - a.id);
        setPolls(fetchedPolls);
      } catch (error) {
        console.error("Error fetching polls:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPolls();
  }, [connection]);

  const filteredPolls = polls.filter(({ poll }) => {
    const now = Date.now() / 1000;
    const isActive = poll.isActive && poll.endTime.toNumber() > now;

    if (filter === "active") return isActive;
    if (filter === "ended") return !isActive;
    return true;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {(["all", "active", "ended"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === f
                ? "bg-purple-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {filteredPolls.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">No polls found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPolls.map(({ poll, id }) => (
            <PollCard key={id} poll={poll} pollId={id} />
          ))}
        </div>
      )}
    </div>
  );
};
