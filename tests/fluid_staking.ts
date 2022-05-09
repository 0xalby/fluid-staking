import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { FluidStaking } from "../target/types/fluid_staking";
import { Transaction } from "@solana/web3.js";
import {
  addSols,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAtaForMint,
  getStakeFarmPda,
  getStakeAccountPda,
  getRawTokenAccount,
  mintNFT,
  TOKEN_PROGRAM_ID,
  getStakeMintPda,
} from "./utils";
import { assert } from "chai";

describe("staking", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  let mint = null;
  let falseMint = null;
  let falseStakerAta = null;
  let rewardMint = null;
  let stakerAta = null;
  let managerRewardAta = null;

  const program = anchor.workspace.FluidStaking as Program<FluidStaking>;
  const manager = anchor.web3.Keypair.generate();
  const staker = anchor.web3.Keypair.generate();

  before("setup", async () => {
    await addSols(program.provider, manager.publicKey);
    console.log("funding manager");
    await addSols(program.provider, staker.publicKey);
    console.log("funding client");

    const nftMint = await mintNFT(program.provider, staker, staker, staker, 1);
    const falseNftMint = await mintNFT(program.provider, staker, staker, staker, 1);

    const rewardToken = await mintNFT(
      program.provider,
      manager,
      manager,
      manager,
      5000000
    );

    falseMint = falseNftMint.tokenMint;
    falseStakerAta = falseNftMint.tokenMint;

    mint = nftMint.tokenMint;
    stakerAta = nftMint.payerAta;

    managerRewardAta = rewardToken.payerAta;
    rewardMint = rewardToken.tokenMint;
  });

  it("create farm", async () => {
    const [stakeFarm, _] = await getStakeFarmPda(
      manager.publicKey,
      program.programId
    );
    const instruction = await program.methods
      .createFarm(new anchor.BN(5))
      .accounts({
        manager: manager.publicKey,
        stakeFarm: stakeFarm,
        systemProgram: anchor.web3.SystemProgram.programId,
        rewardMint: rewardMint
      })
      .instruction();

    const transaction = new Transaction();
    transaction.add(instruction);

    await program.provider.sendAndConfirm!(transaction, [manager]);
  });

  it("initialize tier", async () => {
    const [stakeFarm, _] = await getStakeFarmPda(
      manager.publicKey,
      program.programId
    );
    const stakeTier = anchor.web3.Keypair.generate();

    //if lock period is set - the nft will stop earning rewards after the period has finished
    let lock_period = new anchor.BN(0); // if set will lock the NFT inside the vault for said period of time
    let reward = new anchor.BN(10); // reward handed out once every tick

    const instruction = await program.methods
      .createTier(lock_period, reward)
      .accounts({
        manager: manager.publicKey,
        stakeFarm: stakeFarm,
        stakeTier: stakeTier.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .instruction();

    const transaction = new Transaction();
    transaction.add(instruction);

    await program.provider.sendAndConfirm!(transaction, [manager, stakeTier]);
  });

  it("add mint to whitelist", async () => {
    const [stakeFarm, _] = await getStakeFarmPda(manager.publicKey, program.programId);
    const [stakeMint, _1] = await getStakeMintPda(stakeFarm, mint, program.programId);

    let preBalance = await program.provider.connection.getBalance(manager.publicKey);

    let bonus_reward = new anchor.BN(2);

    const instruction = await program.methods
      .addMint(bonus_reward)
      .accounts({
        manager: manager.publicKey,
        stakeFarm: stakeFarm,
        mint: mint,
        stakeMint: stakeMint,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .instruction();

    const transaction = new Transaction();
    transaction.add(instruction);

    await program.provider.sendAndConfirm!(transaction, [manager]);

    let postBalance = await program.provider.connection.getBalance(manager.publicKey);
    console.log('Whitelist cost: ', (preBalance - postBalance) / anchor.web3.LAMPORTS_PER_SOL);

  });

  it("fund farm", async () => {
    const [stakeFarm, _1] = await getStakeFarmPda(manager.publicKey, program.programId);
    const [stakeFarmRewardAta, _2] = await getAtaForMint(stakeFarm, rewardMint);

    let reward_fund_amount = new anchor.BN(800)

    const instruction = await program.methods
      .fundFarm(reward_fund_amount)
      .accounts({
        manager: manager.publicKey,
        managerRewardAta: managerRewardAta,
        rewardTokenMint: rewardMint,
        stakeFarmRewardAta: stakeFarmRewardAta,
        stakeFarm: stakeFarm,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .instruction();

    const transaction = new Transaction();
    transaction.add(instruction);

    await program.provider.sendAndConfirm!(transaction, [manager]);

    const farmRewardAtaData = await getRawTokenAccount(program.provider, stakeFarmRewardAta);
    const managerRewardAtaData = await getRawTokenAccount(program.provider, managerRewardAta);

    console.log(`
    Manager Reward Amount: ${managerRewardAtaData.amount.toString()}
    Farm Reward Amount; ${farmRewardAtaData.amount.toString()}
    `);
  });

  it("stake", async () => {
    const [stakeFarm, _1] = await getStakeFarmPda(
      manager.publicKey,
      program.programId
    );
    const [stakeAccount, _2] = await getStakeAccountPda(
      staker.publicKey,
      mint,
      program.programId
    );
    const [stakeFarmAta, _3] = await getAtaForMint(stakeFarm, mint);
    const [stakeMint, _4] = await getStakeMintPda(stakeFarm, mint, program.programId);
    const tiers = await program.account.stakeTier.all();
    const stakeTier = tiers[0].publicKey;

    const instruction = await program.methods
      .stake()
      .accounts({
        staker: staker.publicKey,
        stakeAccount: stakeAccount,
        stakerAta: stakerAta,
        tokenMint: mint,
        stakeFarmAta: stakeFarmAta,
        stakeFarm: stakeFarm,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        stakeTier: stakeTier,
        stakeMint: stakeMint
      })
      .instruction();

    const transaction = new Transaction();
    transaction.add(instruction);

    await program.provider.sendAndConfirm!(transaction, [staker]);

    const nftAtaData = await getRawTokenAccount(program.provider, stakeFarmAta);
    assert.ok(nftAtaData.amount.toString() === "1", "GemVault should own NFT");

    const stakerAtaData = await getRawTokenAccount(program.provider, stakerAta);
    assert.ok(
      stakerAtaData.amount.toString() === "0",
      "User should no longer own NFT"
    );

    const stake = await program.account.stakeAccount.fetch(stakeAccount);
    console.log(`
        Has lock: ${stake.lockPeriod.toNumber() > 0}
        Ends at: ${Date.now() / 1000 + stake.lockPeriod.toNumber()}
        Reward per tick: ${stake.reward}
        Tier reference: ${stake.stakeTier.toString()}
    `);

    console.log("leave staked for 5 seconds");
    await new Promise((r) => setTimeout(r, 5000));
  });

  it("remove mint from whitelist", async () => {
    const [stakeFarm, _] = await getStakeFarmPda(manager.publicKey, program.programId);
    const [stakeMint, _1] = await getStakeMintPda(stakeFarm, mint, program.programId);

    const instruction = await program.methods
      .removeMint()
      .accounts({
        manager: manager.publicKey,
        stakeFarm: stakeFarm,
        stakeMint: stakeMint,
        mint: mint,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .instruction();

    const transaction = new Transaction();
    transaction.add(instruction);
    await program.provider.sendAndConfirm!(transaction, [manager]);
  })

  it("delete tier", async () => {
    const [stakeFarm, _] = await getStakeFarmPda(
      manager.publicKey,
      program.programId
    );
    const stakeTier = (await program.account.stakeTier.all())[0]; //we can get the first just for testing perpouses

    const instruction = await program.methods
      .closeTier()
      .accounts({
        manager: manager.publicKey,
        stakeFarm: stakeFarm,
        stakeTier: stakeTier.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .instruction();

    const transaction = new Transaction();
    transaction.add(instruction);

    await program.provider.sendAndConfirm!(transaction, [manager]);

    const tiers = await program.account.stakeTier.all();
    assert.ok(tiers.length == 0, "All tiers are deleted");
  });

  it("claim reward", async () => {
    const [stakeFarm, _1] = await getStakeFarmPda( manager.publicKey, program.programId );
    const [stakeAccount, _2] = await getStakeAccountPda( staker.publicKey, mint, program.programId );
    const [stakeFarmRewardAta, _3] = await getAtaForMint(stakeFarm,rewardMint);
    const [stakerRewardAta, _4] = await getAtaForMint(staker.publicKey, rewardMint);

    const instruction = await program.methods
      .claim()
      .accounts({
        staker: staker.publicKey,
        stakeFarm: stakeFarm,
        stakeAccount: stakeAccount,
        stakeFarmRewardAta: stakeFarmRewardAta,
        stakerRewardAta: stakerRewardAta,
        rewardTokenMint: rewardMint,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY
      })
      .instruction();

    const transaction = new Transaction();
    transaction.add(instruction);

    await program.provider.sendAndConfirm!(transaction, [staker]);

    const farmRewardAtaData = await getRawTokenAccount(program.provider, stakeFarmRewardAta);
    const stakerRewardAtaData = await getRawTokenAccount(program.provider, stakerRewardAta);

    console.log(`
    Staker Reward Amount: ${stakerRewardAtaData.amount.toString()}
    Farm Reward Amount; ${farmRewardAtaData.amount.toString()}
    `);
  });
 
  it("unstake", async () => {
  
    const [stakeFarm, _1] = await getStakeFarmPda(manager.publicKey, program.programId);
    const [stakeAccount, _2] = await getStakeAccountPda(staker.publicKey, mint, program.programId);
    const [stakeFarmAta, _3] = await getAtaForMint(stakeFarm, mint);

    const instruction = await program.methods
      .unstake()
      .accounts({
        staker: staker.publicKey,
        stakeAccount: stakeAccount,
        stakerAta: stakerAta,
        tokenMint: mint,
        stakeFarmAta: stakeFarmAta,
        stakeFarm: stakeFarm,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .instruction();

    const transaction = new Transaction();
    transaction.add(instruction);

    await program.provider.sendAndConfirm!(transaction, [staker]);

    const nftAtaData = await getRawTokenAccount(program.provider, stakeFarmAta);
    assert.ok(
      nftAtaData.amount.toString() === "0",
      "Farm should no longer own NFT"
    );

    const stakerAtaData = await getRawTokenAccount(program.provider, stakerAta);
    assert.ok(stakerAtaData.amount.toString() === "1", "User should own NFT");

  });

});
