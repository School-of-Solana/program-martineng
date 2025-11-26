"use client";

import { useState, useEffect, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { getMintPda } from "@/lib/anchor/program";

export const useTokenBalance = () => {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!publicKey) {
      setBalance(0);
      return;
    }

    setLoading(true);
    try {
      const mintPda = getMintPda();
      const ata = getAssociatedTokenAddressSync(mintPda, publicKey);

      const accountInfo = await connection.getTokenAccountBalance(ata);
      setBalance(Number(accountInfo.value.amount) / 1_000_000);
    } catch (error) {
      // Token account might not exist
      setBalance(0);
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { balance, loading, refetch: fetchBalance };
};
