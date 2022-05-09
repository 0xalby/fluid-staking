import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { Transaction, Connection } from "@solana/web3.js";
import {
  getGemVaultPda,
} from "../tests/utils";

import { FluidStaking } from "../target/types/fluid_staking"

const connection = new Connection('https://metaplex.devnet.rpcpool.com/');

const manager = anchor.web3.Keypair.fromSecretKey(new Uint8Array([33,33,104,152,184,8,12,119,84,44,66,44,36,167,69,99,30,157,141,136,187,22,125,222,249,182,2,60,186,18,134,202,239,228,249,101,162,142,241,184,72,187,166,36,233,206,244,173,45,179,194,218,254,249,141,55,134,148,154,4,60,37,158,136]));

const initialize = async () => {
  let anchor_wallet = new anchor.Wallet(manager);
  anchor.setProvider(
    new anchor.AnchorProvider(connection, anchor_wallet, {
      skipPreflight: false,
    })
  );

  const program = anchor.workspace.FluidStaking as Program<FluidStaking>;

  const [gemVault, _] = await getGemVaultPda(program.programId);

  const instruction = await program.methods
    .initialize()
    .accounts({
      authority: manager.publicKey,
      gemVault: gemVault,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .instruction();

  const transaction = new Transaction();
  transaction.add(instruction);

  const tx = await program.provider.sendAndConfirm!(transaction, [manager]);
  console.log("Your transaction signature", tx);

};

initialize();