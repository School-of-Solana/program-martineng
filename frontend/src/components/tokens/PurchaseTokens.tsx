"use client";

import { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { BN } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import { SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useProgram } from "@/hooks/useProgram";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import {
  getConfigPda,
  getMintPda,
  getVaultPda,
  getUserStatsPda,
  Config,
} from "@/lib/anchor/program";

export const PurchaseTokens = () => {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const { program, provider } = useProgram();
  const { balance, refetch } = useTokenBalance();

  const [amount, setAmount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [solBalance, setSolBalance] = useState(0);
  const [solPrice, setSolPrice] = useState(150); // Default $150

  useEffect(() => {
    const fetchData = async () => {
      if (!publicKey) return;

      // Fetch SOL balance
      const bal = await connection.getBalance(publicKey);
      setSolBalance(bal / LAMPORTS_PER_SOL);

      // Fetch SOL price from config
      if (program) {
        try {
          const configPda = getConfigPda();
          const config = (await (program.account as any).config.fetch(
            configPda
          )) as Config;
          setSolPrice(config.solUsdRate.toNumber() / 100);
        } catch (e) {
          // Config might not exist yet
        }
      }
    };

    fetchData();
  }, [publicKey, connection, program]);

  const solCost = amount / solPrice;

  const handlePurchase = async () => {
    setError("");
    setSuccess("");

    if (!publicKey || !program || !provider) {
      setError("Please connect your wallet");
      return;
    }

    if (solBalance < solCost + 0.01) {
      setError("Insufficient SOL balance");
      return;
    }

    setLoading(true);

    try {
      const configPda = getConfigPda();
      const mintPda = getMintPda();
      const vaultPda = getVaultPda();
      const userStatsPda = getUserStatsPda(publicKey);
      const buyerTokenAccount = getAssociatedTokenAddressSync(mintPda, publicKey);

      // Check if ATA exists, if not create it
      let ataExists = false;
      try {
        await getAccount(connection, buyerTokenAccount);
        ataExists = true;
      } catch (e) {
        ataExists = false;
      }

      if (!ataExists) {
        const createAtaIx = createAssociatedTokenAccountInstruction(
          publicKey,
          buyerTokenAccount,
          publicKey,
          mintPda
        );
        const tx = new Transaction().add(createAtaIx);
        const sig = await sendTransaction(tx, connection);
        await connection.confirmTransaction(sig, "confirmed");
      }

      const tokenAmountBN = new BN(amount * 1_000_000);

      await program.methods
        .purchaseTokens(tokenAmountBN)
        .accounts({
          buyer: publicKey,
          config: configPda,
          userStats: userStatsPda,
          tokenMint: mintPda,
          buyerTokenAccount: buyerTokenAccount,
          solVault: vaultPda,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      await refetch();
      setSuccess(`Successfully purchased ${amount} mVote!`);
      setAmount(10);
    } catch (err: any) {
      console.error("Error purchasing tokens:", err);
      if (err.message?.includes("DailyLimitExceeded")) {
        setError("Daily purchase limit exceeded (100 mVote max per day)");
      } else {
        setError(err.message || "Failed to purchase tokens");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!publicKey) {
    return (
      <div className="bg-gray-800 rounded-xl p-8 text-center">
        <p className="text-gray-400">
          Please connect your wallet to purchase tokens
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl p-6 space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Buy mVote Tokens</h2>
        <p className="text-gray-400">
          Purchase mVote to create polls and vote
        </p>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/20 border border-green-500 text-green-400 px-4 py-2 rounded-lg">
          {success}
        </div>
      )}

      <div className="bg-gray-700/50 rounded-lg p-4 space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-400">Your mVote Balance</span>
          <span className="text-purple-400 font-medium">
            {balance.toFixed(2)} mVote
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Your SOL Balance</span>
          <span className="text-white">{solBalance.toFixed(4)} SOL</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">SOL Price</span>
          <span className="text-white">${solPrice.toFixed(2)}</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Amount: {amount} mVote
        </label>
        <input
          type="range"
          min={1}
          max={100}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-gray-500 text-sm">
          <span>1 mVote</span>
          <span>100 mVote (daily limit)</span>
        </div>
      </div>

      <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-300">You Pay</span>
          <span className="text-white font-medium">
            ~{solCost.toFixed(6)} SOL
          </span>
        </div>
        <div className="flex justify-between items-center mt-1">
          <span className="text-gray-400 text-sm">USD Value</span>
          <span className="text-gray-400 text-sm">${amount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center mt-1">
          <span className="text-gray-300">You Receive</span>
          <span className="text-purple-400 font-medium">{amount} mVote</span>
        </div>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
        <p className="text-yellow-400 text-sm">
          Daily limit: 100 mVote per wallet. Resets at 00:00 SGT (UTC+8).
        </p>
      </div>

      <button
        onClick={handlePurchase}
        disabled={loading || amount < 1 || solBalance < solCost + 0.01}
        className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition"
      >
        {loading ? "Processing..." : `Buy ${amount} mVote`}
      </button>
    </div>
  );
};
