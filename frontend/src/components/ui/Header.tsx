"use client";

import Link from "next/link";
import { WalletButton } from "../wallet/WalletButton";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useWallet } from "@solana/wallet-adapter-react";

export const Header = () => {
  const { publicKey } = useWallet();
  const { balance } = useTokenBalance();

  return (
    <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-2xl font-bold text-purple-400">
              mVote
            </Link>
            <nav className="hidden md:flex gap-6">
              <Link
                href="/"
                className="text-gray-300 hover:text-white transition"
              >
                Polls
              </Link>
              <Link
                href="/create"
                className="text-gray-300 hover:text-white transition"
              >
                Create
              </Link>
              <Link
                href="/tokens"
                className="text-gray-300 hover:text-white transition"
              >
                Buy Tokens
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {publicKey && (
              <div className="hidden sm:flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-lg">
                <span className="text-purple-400 font-medium">
                  {balance.toFixed(2)}
                </span>
                <span className="text-gray-400 text-sm">mVote</span>
              </div>
            )}
            <WalletButton />
          </div>
        </div>
      </div>
    </header>
  );
};
