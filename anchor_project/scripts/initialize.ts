import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Mvote } from "../target/types/mvote";
import { PublicKey, SystemProgram, Keypair, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";

async function main() {
  // Load wallet
  const walletPath = "./phantom.json";
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  console.log("Wallet:", wallet.publicKey.toBase58());

  // Setup connection and provider
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(wallet),
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  // Load program
  const program = anchor.workspace.Mvote as Program<Mvote>;
  console.log("Program ID:", program.programId.toBase58());

  // Derive PDAs
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );
  const [mintPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint")],
    program.programId
  );
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault")],
    program.programId
  );

  console.log("Config PDA:", configPda.toBase58());
  console.log("Mint PDA:", mintPda.toBase58());
  console.log("Vault PDA:", vaultPda.toBase58());

  // Check if already initialized
  try {
    const config = await (program.account as any).config.fetch(configPda);
    console.log("Program already initialized!");
    console.log("Admin:", config.admin.toBase58());
    console.log("Total polls:", config.totalPollsCreated.toString());
    return;
  } catch (e) {
    console.log("Program not initialized, proceeding...");
  }

  // Initialize
  try {
    const tx = await program.methods
      .initialize()
      .accounts({
        admin: wallet.publicKey,
      })
      .signers([wallet])
      .rpc();

    console.log("Initialize transaction:", tx);
    console.log("Program initialized successfully!");
  } catch (err) {
    console.error("Error initializing:", err);
  }
}

main().catch(console.error);
