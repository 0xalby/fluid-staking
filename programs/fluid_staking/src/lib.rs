use anchor_lang::prelude::*;
use anchor_spl::token::{self};

use instructions::*;
use error::*;

declare_id!("HX1JgCTVJ3LiTFaua9J6zqjYWm2SsA1Cnac3qsH2XPcM");

pub mod instructions;
pub mod state;
pub mod error;

#[program]
pub mod fluid_staking {
    use super::*;

    pub fn create_farm(ctx: Context<InitializeFarm>, tickrate: i64) -> Result<()> {

        let stake_farm = &mut ctx.accounts.stake_farm;
        stake_farm.manager = ctx.accounts.manager.key();
        stake_farm.bump = *ctx.bumps.get("stake_farm").unwrap();
        stake_farm.tickrate = tickrate;
        stake_farm.reward_mint = ctx.accounts.reward_mint.key();
        Ok(())
    }

    pub fn fund_farm(ctx: Context<FundFarm>, amount: u64) -> Result<()> {

        require_keys_eq!(
            ctx.accounts.reward_token_mint.key(),
            ctx.accounts.stake_farm.reward_mint,
            StakeError::Unauthorized
        );

        require_keys_eq!(
            ctx.accounts.manager.key(),
            ctx.accounts.stake_farm.manager,
            StakeError::Unauthorized
        );

        let token_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                authority: ctx.accounts.manager.to_account_info(),
                from: ctx.accounts.manager_reward_ata.to_account_info(),
                to: ctx.accounts.stake_farm_reward_ata.to_account_info(),
            },
        );

        token::transfer(token_ctx, amount)?;      

        Ok(())
    }

    pub fn add_mint(ctx: Context<AddMint>, bonus_reward: u64) -> Result<()> {

        require_keys_eq!(
            ctx.accounts.stake_farm.manager,
            ctx.accounts.manager.key(),
            StakeError::Unauthorized
        );

        let stake_mint = &mut ctx.accounts.stake_mint;
        stake_mint.mint = ctx.accounts.mint.key();
        stake_mint.bump = *ctx.bumps.get("stake_mint").unwrap();
        stake_mint.bonus_reward = bonus_reward;
        stake_mint.farm = ctx.accounts.stake_farm.key();
        Ok(())
    }

    pub fn remove_mint(ctx: Context<RemoveMint>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.stake_farm.manager,
            ctx.accounts.manager.key(),
            StakeError::Unauthorized
        );
        require_keys_eq!(
            ctx.accounts.stake_mint.farm,
            ctx.accounts.stake_farm.key(),
            StakeError::Unauthorized
        );
        Ok(())
    }

    pub fn create_tier(ctx: Context<AddTier>, lock_period: i64, reward: u64) -> Result<()> {

        //must be owner of farm
        require_keys_eq!(
            ctx.accounts.stake_farm.manager,
            ctx.accounts.manager.key(),
            StakeError::Unauthorized
        );

        let stake_farm = &ctx.accounts.stake_farm;
        let stake_tier = &mut ctx.accounts.stake_tier;
        stake_tier.farm = stake_farm.key();

        stake_tier.lock_period = lock_period;
        stake_tier.reward = reward;

        Ok(())
    }

    pub fn close_tier(ctx: Context<CloseTier>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.stake_farm.manager,
            ctx.accounts.manager.key(),
            StakeError::Unauthorized
        );
        Ok(())
    }

    pub fn stake(ctx: Context<Stake>) -> Result<()> {

        require_keys_eq!(
            ctx.accounts.stake_farm.key(),
            ctx.accounts.stake_tier.farm,
            StakeError::Unauthorized
        );

        require_keys_eq!(
            ctx.accounts.stake_mint.mint,
            ctx.accounts.token_mint.key(),
            StakeError::Unauthorized
        );

        let clock: Clock = Clock::get().unwrap();

        let stake_account = &mut ctx.accounts.stake_account;
        let stake_tier = &ctx.accounts.stake_tier;

        stake_account.bump = *ctx.bumps.get("stake_account").unwrap();
        stake_account.staker = ctx.accounts.staker.key();
        stake_account.mint = ctx.accounts.token_mint.key();

        stake_account.staked_timestamp = clock.unix_timestamp;
        stake_account.claimed_timestamp = clock.unix_timestamp;
        stake_account.claimed_tokens = 0;

        stake_account.stake_tier = ctx.accounts.stake_tier.key();
        stake_account.lock_period = stake_tier.lock_period;
        stake_account.reward = stake_tier.reward + ctx.accounts.stake_mint.bonus_reward;

        let token_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                authority: ctx.accounts.staker.to_account_info(),
                from: ctx.accounts.staker_ata.to_account_info(),
                to: ctx.accounts.stake_farm_ata.to_account_info(),
            },
        );
        token::transfer(token_ctx, 1)?;
        Ok(())
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {

        let stake_account = &mut ctx.accounts.stake_account;
        let stake_farm = &ctx.accounts.stake_farm;

        // ✨ logic ✨ //

        let clock: Clock = Clock::get().unwrap();
        let now = clock.unix_timestamp;

        let time_staked = now - stake_account.claimed_timestamp;
        let time_staked_remain = time_staked % stake_farm.tickrate;
        let time_staked_divis = ((time_staked - time_staked_remain) / stake_farm.tickrate) as u64;

        let lock_time_remain = stake_account.lock_period % stake_farm.tickrate;
        let lock_time_divis = ((stake_account.lock_period - lock_time_remain) / stake_farm.tickrate) as u64;

        let mut reward: u64 = time_staked_divis * stake_account.reward;

        if stake_account.lock_period > 0 {
            //we have lock period (limited)
            let max_reward = stake_account.reward * lock_time_divis;
            if reward + stake_account.claimed_tokens >= max_reward {
                //reward is more than whats left - give them everything left
                reward = max_reward - stake_account.claimed_tokens;
            }
        }
        
        let manager = ctx.accounts.stake_farm.manager;
        let stake_farm_bump = ctx.accounts.stake_farm.bump;
        let seeds = &[b"stake-farm".as_ref(), manager.as_ref(), &[stake_farm_bump]];
        let signer =  &[&seeds[..]];

        let token_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                authority: ctx.accounts.stake_farm.to_account_info(),
                from: ctx.accounts.stake_farm_reward_ata.to_account_info(),
                to: ctx.accounts.staker_reward_ata.to_account_info(),
            },
            signer,
        );
        token::transfer(token_ctx, reward)?;

        stake_account.claimed_timestamp = now - time_staked_remain;
        stake_account.claimed_tokens = stake_account.claimed_tokens + reward;
    
        Ok(())

    }

    pub fn unstake(ctx: Context<Unstake>) -> Result<()> {

        require_keys_eq!(
            ctx.accounts.token_mint.key(),
            ctx.accounts.stake_account.mint,
            StakeError::MintMismatch
        );

        require_keys_eq!(
            ctx.accounts.stake_account.staker,
            ctx.accounts.staker.key(),
            StakeError::KeyMismatch
        );

        let clock: Clock = Clock::get().unwrap();
        let now = clock.unix_timestamp;
        let stake_account =  &ctx.accounts.stake_account;

        //throw err if stake timestamp x > (y - z)
        if stake_account.lock_period > 0 {
            if stake_account.staked_timestamp > (now - stake_account.lock_period) {
                return Err(StakeError::Unauthorized.into());
            }
        }

        let manager = ctx.accounts.stake_farm.manager.key();
        let stake_farm_bump = ctx.accounts.stake_farm.bump;
        let seeds = &[b"stake-farm".as_ref(), manager.as_ref(), &[stake_farm_bump]];
        let signer =  &[&seeds[..]];

        let token_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                authority: ctx.accounts.stake_farm.to_account_info(),
                from: ctx.accounts.stake_farm_ata.to_account_info(),
                to: ctx.accounts.staker_ata.to_account_info(),
            },
            signer,
        );
        token::transfer(token_ctx, 1)?;
        Ok(())
    }
    
}

