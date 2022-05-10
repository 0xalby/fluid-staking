import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { Transaction, Connection } from "@solana/web3.js";
import {
  getAtaForMint,
  getRawTokenAccount,
  getStakeFarmPda,
  getStakeMintPda,
} from "../tests/utils";

import { FluidStaking } from "../target/types/fluid_staking"
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";

const connection = new Connection('https://metaplex.devnet.rpcpool.com/');

const manager = anchor.web3.Keypair.fromSecretKey(new Uint8Array([233,88,35,74,58,42,23,197,219,17,247,252,114,16,96,179,193,158,185,114,2,121,244,191,14,115,194,130,202,235,140,209,133,123,47,77,111,135,91,152,38,109,79,106,73,2,83,196,44,217,114,86,164,113,96,45,93,41,57,212,105,49,0,32]));

let anchor_wallet = new anchor.Wallet(manager);
anchor.setProvider(
  new anchor.AnchorProvider(connection, anchor_wallet, {
    skipPreflight: false,
  })
);

const program = anchor.workspace.FluidStaking as Program<FluidStaking>;

const createFarm = async () => {
  const [stakeFarm, _] = await getStakeFarmPda(manager.publicKey, program.programId);

  let tickrate = new anchor.BN(60);

  const instruction = await program.methods
    .createFarm(tickrate)
    .accounts({
      manager: manager.publicKey,
      stakeFarm: stakeFarm,
      rewardMint: new anchor.web3.PublicKey('HNzH6WfHrjCi5rhbAgirygMcP1ygss7iCbu7UaKBvnBR'),
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .instruction();

  const transaction = new Transaction();
  transaction.add(instruction);

  const tx = await program.provider.sendAndConfirm!(transaction, [manager]);
  console.log("Your transaction signature", tx);

};

const createTier = async (lockPeriod: number, baseReward: number) => {

  const [stakeFarm, _] = await getStakeFarmPda(manager.publicKey, program.programId);
  const stakeTier = anchor.web3.Keypair.generate();

  //if lock period is set - the nft will stop earning rewards after the period has finished
  let lock_period = new anchor.BN(lockPeriod); // if set will lock the NFT inside the vault for said period of time
  let reward = new anchor.BN(baseReward * 1000); // reward handed out once every tick

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

  const tx = await program.provider.sendAndConfirm!(transaction, [manager, stakeTier]);
  console.log("Your transaction signature", tx);

};

const deleteTier = async () => {

  const [stakeFarm, _] = await getStakeFarmPda(manager.publicKey, program.programId);
  const stakeTier = new anchor.web3.PublicKey('BMHrWAtn1CkphPLD7nifq2P9ubFnH9nFSMc6d7BAvkb8')

  const instruction = await program.methods
    .closeTier()
    .accounts({
      manager: manager.publicKey,
      stakeFarm: stakeFarm,
      stakeTier: stakeTier,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .instruction();

  const transaction = new Transaction();
  transaction.add(instruction);

  await program.provider.sendAndConfirm!(transaction, [manager]);
}

const addFunds = async () => {

  const rewardMint = new anchor.web3.PublicKey('HNzH6WfHrjCi5rhbAgirygMcP1ygss7iCbu7UaKBvnBR');

  const [stakeFarm, _] = await getStakeFarmPda(manager.publicKey, program.programId);
  const [stakeFarmRewardAta, _2] = await getAtaForMint(stakeFarm, rewardMint);
  const [managerRewardAta, _3] = await getAtaForMint(manager.publicKey, rewardMint);

  let reward_fund_amount = new anchor.BN(9090 * 1000)

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

  const tx = await program.provider.sendAndConfirm!(transaction, [manager]);

  console.log('tx', tx);

  const farmRewardAtaData = await getRawTokenAccount(program.provider, stakeFarmRewardAta);
  const managerRewardAtaData = await getRawTokenAccount(program.provider, managerRewardAta);

  console.log(`
  Manager Reward Amount: ${managerRewardAtaData.amount.toString()}
  Farm Reward Amount; ${farmRewardAtaData.amount.toString()}
  `);
}

const addMint = async () => {

  const mint = new anchor.web3.PublicKey('B9ZqBr8vbreUdSSAi8kZCB6a2yEP7gM92M3x1oVHLiEW');

  const [stakeFarm, _] = await getStakeFarmPda(manager.publicKey, program.programId);
  const [stakeMint, _1] = await getStakeMintPda(stakeFarm, mint, program.programId);

  let bonus_reward = new anchor.BN(3 * 1000);

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
}

const getTiers = async () => {
  const tiers = await program.account.stakeTier.all();
  console.log(tiers.map(tier => {
    return {
      pubkey: tier.publicKey.toString(),
      lockup: tier.account.lockPeriod.toString(),
      farm: tier.account.farm.toString(),
      reward: tier.account.reward.toString(),
    }
  }));
}

getTiers();

//createTier(840, 17);