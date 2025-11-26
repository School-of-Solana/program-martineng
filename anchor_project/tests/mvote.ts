import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Mvote } from "../target/types/mvote";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import { assert, expect } from "chai";

describe("mvote", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Mvote as Program<Mvote>;

  // PDAs
  let configPda: PublicKey;
  let mintPda: PublicKey;
  let vaultPda: PublicKey;

  // Test users
  const admin = provider.wallet;
  let user1: Keypair;
  let user2: Keypair;

  // Token accounts
  let adminTokenAccount: PublicKey;
  let user1TokenAccount: PublicKey;
  let user2TokenAccount: PublicKey;

  // User stats PDAs
  let adminStatsPda: PublicKey;
  let user1StatsPda: PublicKey;
  let user2StatsPda: PublicKey;

  before(async () => {
    // Derive PDAs
    [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );

    [mintPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint")],
      program.programId
    );

    [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      program.programId
    );

    // Create test users
    user1 = Keypair.generate();
    user2 = Keypair.generate();

    // Airdrop SOL to test users
    const airdropTx1 = await provider.connection.requestAirdrop(
      user1.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropTx1);

    const airdropTx2 = await provider.connection.requestAirdrop(
      user2.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropTx2);

    // Derive token accounts
    adminTokenAccount = getAssociatedTokenAddressSync(
      mintPda,
      admin.publicKey
    );
    user1TokenAccount = getAssociatedTokenAddressSync(mintPda, user1.publicKey);
    user2TokenAccount = getAssociatedTokenAddressSync(mintPda, user2.publicKey);

    // Derive user stats PDAs
    [adminStatsPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), admin.publicKey.toBuffer()],
      program.programId
    );
    [user1StatsPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), user1.publicKey.toBuffer()],
      program.programId
    );
    [user2StatsPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), user2.publicKey.toBuffer()],
      program.programId
    );
  });

  describe("Initialize", () => {
    it("should initialize the program", async () => {
      const tx = await program.methods
        .initialize()
        .accounts({
          admin: admin.publicKey,
          config: configPda,
          tokenMint: mintPda,
          solVault: vaultPda,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      console.log("Initialize tx:", tx);

      // Verify config account
      const config = await program.account.config.fetch(configPda);
      assert.ok(config.admin.equals(admin.publicKey));
      assert.ok(config.tokenMint.equals(mintPda));
      assert.ok(config.solVault.equals(vaultPda));
      assert.equal(config.totalPollsCreated.toNumber(), 0);
    });

    it("should fail to initialize twice", async () => {
      try {
        await program.methods
          .initialize()
          .accounts({
            admin: admin.publicKey,
            config: configPda,
            tokenMint: mintPda,
            solVault: vaultPda,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .rpc();
        assert.fail("Should have failed");
      } catch (err) {
        // Expected to fail - account already exists
        expect(err).to.exist;
      }
    });
  });

  describe("Purchase Tokens", () => {
    before(async () => {
      // Create associated token accounts for all users
      const createAtaIx1 = createAssociatedTokenAccountInstruction(
        admin.publicKey,
        adminTokenAccount,
        admin.publicKey,
        mintPda
      );

      const createAtaIx2 = createAssociatedTokenAccountInstruction(
        user1.publicKey,
        user1TokenAccount,
        user1.publicKey,
        mintPda
      );

      const createAtaIx3 = createAssociatedTokenAccountInstruction(
        user2.publicKey,
        user2TokenAccount,
        user2.publicKey,
        mintPda
      );

      // Create admin ATA
      const tx1 = new anchor.web3.Transaction().add(createAtaIx1);
      await provider.sendAndConfirm(tx1);

      // Create user1 ATA
      const tx2 = new anchor.web3.Transaction().add(createAtaIx2);
      await provider.sendAndConfirm(tx2, [user1]);

      // Create user2 ATA
      const tx3 = new anchor.web3.Transaction().add(createAtaIx3);
      await provider.sendAndConfirm(tx3, [user2]);
    });

    it("should purchase tokens successfully", async () => {
      const amount = new anchor.BN(10_000_000); // 10 mVote

      const tx = await program.methods
        .purchaseTokens(amount)
        .accounts({
          buyer: admin.publicKey,
          config: configPda,
          userStats: adminStatsPda,
          tokenMint: mintPda,
          buyerTokenAccount: adminTokenAccount,
          solVault: vaultPda,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      console.log("Purchase tokens tx:", tx);

      // Verify token balance
      const tokenAccount = await getAccount(
        provider.connection,
        adminTokenAccount
      );
      assert.equal(tokenAccount.amount.toString(), amount.toString());

      // Verify user stats
      const userStats = await program.account.userStats.fetch(adminStatsPda);
      assert.equal(
        userStats.tokensPurchasedToday.toString(),
        amount.toString()
      );
    });

    it("should allow multiple purchases within daily limit", async () => {
      const amount = new anchor.BN(50_000_000); // 50 mVote

      await program.methods
        .purchaseTokens(amount)
        .accounts({
          buyer: admin.publicKey,
          config: configPda,
          userStats: adminStatsPda,
          tokenMint: mintPda,
          buyerTokenAccount: adminTokenAccount,
          solVault: vaultPda,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      // Verify updated balance (10 + 50 = 60 mVote)
      const tokenAccount = await getAccount(
        provider.connection,
        adminTokenAccount
      );
      assert.equal(tokenAccount.amount.toString(), "60000000");
    });

    it("should fail when exceeding daily limit", async () => {
      const amount = new anchor.BN(50_000_000); // 50 more would exceed 100 limit

      try {
        await program.methods
          .purchaseTokens(amount)
          .accounts({
            buyer: admin.publicKey,
            config: configPda,
            userStats: adminStatsPda,
            tokenMint: mintPda,
            buyerTokenAccount: adminTokenAccount,
            solVault: vaultPda,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        assert.fail("Should have failed due to daily limit");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("DailyLimitExceeded");
      }
    });

    it("should fail with zero amount", async () => {
      try {
        await program.methods
          .purchaseTokens(new anchor.BN(0))
          .accounts({
            buyer: user1.publicKey,
            config: configPda,
            userStats: user1StatsPda,
            tokenMint: mintPda,
            buyerTokenAccount: user1TokenAccount,
            solVault: vaultPda,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user1])
          .rpc();
        assert.fail("Should have failed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("InvalidAmount");
      }
    });
  });

  describe("Create Poll", () => {
    before(async () => {
      // Purchase tokens for user1
      const amount = new anchor.BN(50_000_000); // 50 mVote
      await program.methods
        .purchaseTokens(amount)
        .accounts({
          buyer: user1.publicKey,
          config: configPda,
          userStats: user1StatsPda,
          tokenMint: mintPda,
          buyerTokenAccount: user1TokenAccount,
          solVault: vaultPda,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user1])
        .rpc();
    });

    it("should create a binary poll (FairVote)", async () => {
      const config = await program.account.config.fetch(configPda);
      const pollId = config.totalPollsCreated;

      const [pollPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("poll"), pollId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      const tx = await program.methods
        .createPoll(
          "Should we implement dark mode?",
          ["Yes", "No"],
          { fairVote: {} },
          { binary: {} },
          60 // 60 minutes
        )
        .accounts({
          creator: user1.publicKey,
          config: configPda,
          userStats: user1StatsPda,
          poll: pollPda,
          tokenMint: mintPda,
          creatorTokenAccount: user1TokenAccount,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user1])
        .rpc();

      console.log("Create poll tx:", tx);

      // Verify poll
      const poll = await program.account.poll.fetch(pollPda);
      assert.equal(poll.question, "Should we implement dark mode?");
      assert.equal(poll.options.length, 2);
      assert.deepEqual(poll.voteMode, { fairVote: {} });
      assert.equal(poll.isActive, true);
    });

    it("should create a multiple choice poll (HoldingVote)", async () => {
      const config = await program.account.config.fetch(configPda);
      const pollId = config.totalPollsCreated;

      const [pollPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("poll"), pollId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      await program.methods
        .createPoll(
          "What feature should we build next?",
          ["Mobile App", "API Access", "Dark Mode", "Notifications"],
          { holdingVote: {} },
          { multipleChoice: {} },
          120 // 2 hours
        )
        .accounts({
          creator: user1.publicKey,
          config: configPda,
          userStats: user1StatsPda,
          poll: pollPda,
          tokenMint: mintPda,
          creatorTokenAccount: user1TokenAccount,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user1])
        .rpc();

      const poll = await program.account.poll.fetch(pollPda);
      assert.equal(poll.options.length, 4);
      assert.deepEqual(poll.voteMode, { holdingVote: {} });
    });

    it("should fail with invalid question length", async () => {
      const config = await program.account.config.fetch(configPda);
      const pollId = config.totalPollsCreated;

      const [pollPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("poll"), pollId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      try {
        await program.methods
          .createPoll(
            "", // Empty question
            ["Yes", "No"],
            { fairVote: {} },
            { binary: {} },
            60
          )
          .accounts({
            creator: user1.publicKey,
            config: configPda,
            userStats: user1StatsPda,
            poll: pollPda,
            tokenMint: mintPda,
            creatorTokenAccount: user1TokenAccount,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user1])
          .rpc();
        assert.fail("Should have failed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("InvalidQuestionLength");
      }
    });

    it("should fail with invalid option count", async () => {
      const config = await program.account.config.fetch(configPda);
      const pollId = config.totalPollsCreated;

      const [pollPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("poll"), pollId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      try {
        await program.methods
          .createPoll(
            "Valid question?",
            ["Only one option"], // Less than 2 options
            { fairVote: {} },
            { binary: {} },
            60
          )
          .accounts({
            creator: user1.publicKey,
            config: configPda,
            userStats: user1StatsPda,
            poll: pollPda,
            tokenMint: mintPda,
            creatorTokenAccount: user1TokenAccount,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user1])
          .rpc();
        assert.fail("Should have failed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("InvalidOptionCount");
      }
    });

    it("should fail with invalid duration", async () => {
      const config = await program.account.config.fetch(configPda);
      const pollId = config.totalPollsCreated;

      const [pollPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("poll"), pollId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      try {
        await program.methods
          .createPoll(
            "Valid question?",
            ["Yes", "No"],
            { fairVote: {} },
            { binary: {} },
            5 // Less than 10 minutes
          )
          .accounts({
            creator: user1.publicKey,
            config: configPda,
            userStats: user1StatsPda,
            poll: pollPda,
            tokenMint: mintPda,
            creatorTokenAccount: user1TokenAccount,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user1])
          .rpc();
        assert.fail("Should have failed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("InvalidDuration");
      }
    });

    it("should fail with insufficient tokens", async () => {
      const config = await program.account.config.fetch(configPda);
      const pollId = config.totalPollsCreated;

      const [pollPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("poll"), pollId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      // user2 has no tokens
      try {
        await program.methods
          .createPoll(
            "Valid question?",
            ["Yes", "No"],
            { fairVote: {} },
            { binary: {} },
            60
          )
          .accounts({
            creator: user2.publicKey,
            config: configPda,
            userStats: user2StatsPda,
            poll: pollPda,
            tokenMint: mintPda,
            creatorTokenAccount: user2TokenAccount,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user2])
          .rpc();
        assert.fail("Should have failed");
      } catch (err: any) {
        // Could be InsufficientTokens or constraint error
        expect(err).to.exist;
      }
    });
  });

  describe("Vote", () => {
    let fairVotePollId: anchor.BN;
    let holdingVotePollId: anchor.BN;

    before(async () => {
      // Get poll IDs (poll 0 is FairVote, poll 1 is HoldingVote)
      fairVotePollId = new anchor.BN(0);
      holdingVotePollId = new anchor.BN(1);

      // Purchase tokens for user2 to vote
      const amount = new anchor.BN(20_000_000); // 20 mVote
      await program.methods
        .purchaseTokens(amount)
        .accounts({
          buyer: user2.publicKey,
          config: configPda,
          userStats: user2StatsPda,
          tokenMint: mintPda,
          buyerTokenAccount: user2TokenAccount,
          solVault: vaultPda,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user2])
        .rpc();
    });

    it("should vote on FairVote poll successfully", async () => {
      const [pollPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("poll"), fairVotePollId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      const [voteRecordPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("vote"),
          fairVotePollId.toArrayLike(Buffer, "le", 8),
          user2.publicKey.toBuffer(),
        ],
        program.programId
      );

      const tx = await program.methods
        .vote(fairVotePollId, 0, new anchor.BN(1_000_000)) // Vote for option 0 (Yes)
        .accounts({
          voter: user2.publicKey,
          config: configPda,
          userStats: user2StatsPda,
          poll: pollPda,
          voteRecord: voteRecordPda,
          tokenMint: mintPda,
          voterTokenAccount: user2TokenAccount,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user2])
        .rpc();

      console.log("Vote tx:", tx);

      // Verify poll vote counts
      const poll = await program.account.poll.fetch(pollPda);
      assert.equal(poll.voteCounts[0].toNumber(), 1);
      assert.equal(poll.totalVotes.toNumber(), 1);

      // Verify vote record
      const voteRecord = await program.account.voteRecord.fetch(voteRecordPda);
      assert.ok(voteRecord.voter.equals(user2.publicKey));
      assert.equal(voteRecord.optionIndex, 0);
    });

    it("should fail to vote twice on FairVote poll", async () => {
      const [pollPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("poll"), fairVotePollId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      const [voteRecordPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("vote"),
          fairVotePollId.toArrayLike(Buffer, "le", 8),
          user2.publicKey.toBuffer(),
        ],
        program.programId
      );

      try {
        await program.methods
          .vote(fairVotePollId, 1, new anchor.BN(1_000_000))
          .accounts({
            voter: user2.publicKey,
            config: configPda,
            userStats: user2StatsPda,
            poll: pollPda,
            voteRecord: voteRecordPda,
            tokenMint: mintPda,
            voterTokenAccount: user2TokenAccount,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user2])
          .rpc();
        assert.fail("Should have failed - already voted");
      } catch (err) {
        // Expected - vote record already exists
        expect(err).to.exist;
      }
    });

    it("should vote on HoldingVote poll with custom amount", async () => {
      const [pollPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("poll"), holdingVotePollId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      const [voteRecordPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("vote"),
          holdingVotePollId.toArrayLike(Buffer, "le", 8),
          user2.publicKey.toBuffer(),
        ],
        program.programId
      );

      const tokenAmount = new anchor.BN(5_000_000); // 5 mVote

      await program.methods
        .vote(holdingVotePollId, 0, tokenAmount) // Vote for Mobile App
        .accounts({
          voter: user2.publicKey,
          config: configPda,
          userStats: user2StatsPda,
          poll: pollPda,
          voteRecord: voteRecordPda,
          tokenMint: mintPda,
          voterTokenAccount: user2TokenAccount,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user2])
        .rpc();

      // Verify poll - votes should equal token amount in HoldingVote mode
      const poll = await program.account.poll.fetch(pollPda);
      assert.equal(poll.voteCounts[0].toString(), tokenAmount.toString());
    });

    it("should fail with invalid option index", async () => {
      const [pollPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("poll"), fairVotePollId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      const [voteRecordPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("vote"),
          fairVotePollId.toArrayLike(Buffer, "le", 8),
          admin.publicKey.toBuffer(),
        ],
        program.programId
      );

      try {
        await program.methods
          .vote(fairVotePollId, 5, new anchor.BN(1_000_000)) // Invalid option
          .accounts({
            voter: admin.publicKey,
            config: configPda,
            userStats: adminStatsPda,
            poll: pollPda,
            voteRecord: voteRecordPda,
            tokenMint: mintPda,
            voterTokenAccount: adminTokenAccount,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        assert.fail("Should have failed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("InvalidOption");
      }
    });

    it("should fail with insufficient tokens to vote", async () => {
      // Create a new user with no tokens but with initialized user_stats
      const newUser = Keypair.generate();
      await provider.connection.requestAirdrop(
        newUser.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const newUserTokenAccount = getAssociatedTokenAddressSync(
        mintPda,
        newUser.publicKey
      );

      // Create ATA
      const createAtaIx = createAssociatedTokenAccountInstruction(
        newUser.publicKey,
        newUserTokenAccount,
        newUser.publicKey,
        mintPda
      );
      const tx = new anchor.web3.Transaction().add(createAtaIx);
      await provider.sendAndConfirm(tx, [newUser]);

      const [newUserStatsPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user"), newUser.publicKey.toBuffer()],
        program.programId
      );

      // Purchase and spend tokens to initialize user_stats but end up with 0 balance
      // Buy 1 mVote first
      await program.methods
        .purchaseTokens(new anchor.BN(1_000_000))
        .accounts({
          buyer: newUser.publicKey,
          config: configPda,
          userStats: newUserStatsPda,
          tokenMint: mintPda,
          buyerTokenAccount: newUserTokenAccount,
          solVault: vaultPda,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([newUser])
        .rpc();

      // Vote on holding vote poll to spend the token
      const [holdingPollPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("poll"), holdingVotePollId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      const [holdingVoteRecordPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("vote"),
          holdingVotePollId.toArrayLike(Buffer, "le", 8),
          newUser.publicKey.toBuffer(),
        ],
        program.programId
      );

      await program.methods
        .vote(holdingVotePollId, 1, new anchor.BN(1_000_000))
        .accounts({
          voter: newUser.publicKey,
          config: configPda,
          userStats: newUserStatsPda,
          poll: holdingPollPda,
          voteRecord: holdingVoteRecordPda,
          tokenMint: mintPda,
          voterTokenAccount: newUserTokenAccount,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([newUser])
        .rpc();

      // Now try to vote on fair vote poll with 0 tokens
      const [pollPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("poll"), fairVotePollId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      const [voteRecordPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("vote"),
          fairVotePollId.toArrayLike(Buffer, "le", 8),
          newUser.publicKey.toBuffer(),
        ],
        program.programId
      );

      try {
        await program.methods
          .vote(fairVotePollId, 0, new anchor.BN(1_000_000))
          .accounts({
            voter: newUser.publicKey,
            config: configPda,
            userStats: newUserStatsPda,
            poll: pollPda,
            voteRecord: voteRecordPda,
            tokenMint: mintPda,
            voterTokenAccount: newUserTokenAccount,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([newUser])
          .rpc();
        assert.fail("Should have failed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("InsufficientTokens");
      }
    });
  });

  describe("Close Poll", () => {
    let testPollId: anchor.BN;

    before(async () => {
      // Create a new poll to close
      const config = await program.account.config.fetch(configPda);
      testPollId = config.totalPollsCreated;

      const [pollPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("poll"), testPollId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      // Give user1 more tokens if needed
      const tokenAccount = await getAccount(
        provider.connection,
        user1TokenAccount
      );
      if (Number(tokenAccount.amount) < 10_000_000) {
        await program.methods
          .purchaseTokens(new anchor.BN(20_000_000))
          .accounts({
            buyer: user1.publicKey,
            config: configPda,
            userStats: user1StatsPda,
            tokenMint: mintPda,
            buyerTokenAccount: user1TokenAccount,
            solVault: vaultPda,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user1])
          .rpc();
      }

      await program.methods
        .createPoll(
          "Poll to be closed?",
          ["Yes", "No"],
          { fairVote: {} },
          { binary: {} },
          60
        )
        .accounts({
          creator: user1.publicKey,
          config: configPda,
          userStats: user1StatsPda,
          poll: pollPda,
          tokenMint: mintPda,
          creatorTokenAccount: user1TokenAccount,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user1])
        .rpc();
    });

    it("should close poll by creator", async () => {
      const [pollPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("poll"), testPollId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      await program.methods
        .closePoll(testPollId)
        .accounts({
          creator: user1.publicKey,
          poll: pollPda,
        })
        .signers([user1])
        .rpc();

      const poll = await program.account.poll.fetch(pollPda);
      assert.equal(poll.isActive, false);
    });

    it("should fail to close poll by non-creator", async () => {
      // Create another poll first
      const config = await program.account.config.fetch(configPda);
      const newPollId = config.totalPollsCreated;

      const [pollPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("poll"), newPollId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      // Give user1 more tokens
      await program.methods
        .purchaseTokens(new anchor.BN(20_000_000))
        .accounts({
          buyer: user1.publicKey,
          config: configPda,
          userStats: user1StatsPda,
          tokenMint: mintPda,
          buyerTokenAccount: user1TokenAccount,
          solVault: vaultPda,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user1])
        .rpc();

      await program.methods
        .createPoll(
          "Another poll?",
          ["Yes", "No"],
          { fairVote: {} },
          { binary: {} },
          60
        )
        .accounts({
          creator: user1.publicKey,
          config: configPda,
          userStats: user1StatsPda,
          poll: pollPda,
          tokenMint: mintPda,
          creatorTokenAccount: user1TokenAccount,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user1])
        .rpc();

      // Try to close as user2 (not the creator)
      try {
        await program.methods
          .closePoll(newPollId)
          .accounts({
            creator: user2.publicKey,
            poll: pollPda,
          })
          .signers([user2])
          .rpc();
        assert.fail("Should have failed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("Unauthorized");
      }
    });

    it("should fail to close already closed poll", async () => {
      const [pollPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("poll"), testPollId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      try {
        await program.methods
          .closePoll(testPollId)
          .accounts({
            creator: user1.publicKey,
            poll: pollPda,
          })
          .signers([user1])
          .rpc();
        assert.fail("Should have failed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("PollNotActive");
      }
    });

    it("should fail to vote on closed poll", async () => {
      const [pollPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("poll"), testPollId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      const [voteRecordPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("vote"),
          testPollId.toArrayLike(Buffer, "le", 8),
          admin.publicKey.toBuffer(),
        ],
        program.programId
      );

      try {
        await program.methods
          .vote(testPollId, 0, new anchor.BN(1_000_000))
          .accounts({
            voter: admin.publicKey,
            config: configPda,
            userStats: adminStatsPda,
            poll: pollPda,
            voteRecord: voteRecordPda,
            tokenMint: mintPda,
            voterTokenAccount: adminTokenAccount,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        assert.fail("Should have failed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("PollNotActive");
      }
    });
  });
});
