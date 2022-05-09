use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::state::*;
use crate::error::*;

// Accounts
#[derive(Accounts)]
pub struct InitializeFarm<'info> {
    #[account(mut)]
    pub manager: Signer<'info>,
    #[account(
        init,
        space = 8 + StakeFarm::LEN,
        seeds =[
            b"stake-farm".as_ref(),
            manager.key().as_ref()
        ],
        bump,
        payer = manager,

    )]
    pub stake_farm: Box<Account<'info, StakeFarm>>,
    pub reward_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub staker: Signer<'info>,

    #[account(
        init, 
        space = 8 + StakeAccount::LEN,
        payer = staker,
        seeds = [
            b"stake-account".as_ref(),
            token_mint.key().as_ref(),
            staker.key().as_ref()
        ],
        bump
    )]
    pub stake_account: Box<Account<'info, StakeAccount>>,

    #[account(
        seeds = [
            b"stake-farm".as_ref(),
            stake_farm.manager.as_ref()
        ],
        bump = stake_farm.bump
    )]
    pub stake_farm: Box<Account<'info, StakeFarm>>,

    #[account(
        seeds = [
            b"stake-mint".as_ref(),
            stake_farm.key().as_ref(),
            token_mint.key().as_ref()
        ],
        bump
    )]
    pub stake_mint: Box<Account<'info, StakeMint>>,

    #[account(constraint = stake_tier.farm == stake_farm.key() @StakeError::Unauthorized)]
    pub stake_tier: Box<Account<'info, StakeTier>>,

    #[account(mut)]
    pub staker_ata: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = staker,
        associated_token::mint = token_mint,
        associated_token::authority = stake_farm,
    )]
    pub stake_farm_ata: Account<'info, TokenAccount>,

    pub token_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut)]
    pub staker: Signer<'info>,

    #[account(
        seeds =[
            b"stake-farm".as_ref(),
            stake_farm.manager.key().as_ref()
        ],
        bump = stake_farm.bump
    )]
    pub stake_farm: Account<'info, StakeFarm>,

    #[account(
        mut,
        seeds = [
            b"stake-account".as_ref(),
            token_mint.key().as_ref(),
            staker.key().as_ref()
        ],
        bump = stake_account.bump,
        close = staker
    )]
    pub stake_account: Account<'info, StakeAccount>,

    #[account(
        init_if_needed,
        payer = staker,
        associated_token::mint = token_mint,
        associated_token::authority = staker,
    )]
    pub staker_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = stake_farm,
    )]
    pub stake_farm_ata: Account<'info, TokenAccount>,

    pub token_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct AddTier<'info> {
    #[account(mut)]
    pub manager: Signer<'info>,

    #[account(
        seeds = [
            b"stake-farm".as_ref(),
            manager.key().as_ref()
        ],
        bump = stake_farm.bump
    )]
    pub stake_farm: Box<Account<'info, StakeFarm>>,

    #[account(init, payer = manager, space = 8 + StakeTier::LEN)]
    pub stake_tier: Box<Account<'info, StakeTier>>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddMint<'info> {
    #[account(mut)]
    pub manager: Signer<'info>,

    #[account(
        seeds = [
            b"stake-farm".as_ref(),
            manager.key().as_ref()
        ],
        bump = stake_farm.bump
    )]
    pub stake_farm: Box<Account<'info, StakeFarm>>,

    #[account(
        init,
        payer = manager,
        space = 8 + StakeMint::LEN,
        seeds = [
            b"stake-mint".as_ref(),
            stake_farm.key().as_ref(),
            mint.key().as_ref()
        ],
        bump
    )]
    pub stake_mint: Box<Account<'info, StakeMint>>,

    pub mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RemoveMint<'info> {
    #[account(mut)]
    pub manager: Signer<'info>,

    #[account(
        seeds = [
            b"stake-farm".as_ref(),
            manager.key().as_ref()
        ],
        bump = stake_farm.bump
    )]
    pub stake_farm: Box<Account<'info, StakeFarm>>,

    #[account(
        mut,
        close = manager,
        seeds = [
            b"stake-mint".as_ref(),
            stake_farm.key().as_ref(),
            mint.key().as_ref()
        ],
        bump = stake_mint.bump
    )]
    pub stake_mint: Box<Account<'info, StakeMint>>,

    pub mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseTier<'info> {
    #[account(mut)]
    pub manager: Signer<'info>,

    #[account(
        seeds = [
            b"stake-farm".as_ref(),
            manager.key().as_ref()
        ],
        bump = stake_farm.bump
    )]
    pub stake_farm: Box<Account<'info, StakeFarm>>,

    #[account(mut, constraint = stake_tier.farm == stake_farm.key() @StakeError::Unauthorized, close = manager)]
    pub stake_tier: Box<Account<'info, StakeTier>>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundFarm<'info> {
    #[account(mut)]
    pub manager: Signer<'info>,

    #[account(
        seeds = [
            b"stake-farm".as_ref(),
            stake_farm.manager.as_ref()
        ],
        bump = stake_farm.bump
    )]
    pub stake_farm: Box<Account<'info, StakeFarm>>,

    #[account(mut)]
    pub manager_reward_ata: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = manager,
        associated_token::mint = reward_token_mint,
        associated_token::authority = stake_farm,
    )]
    pub stake_farm_reward_ata: Account<'info, TokenAccount>,

    pub reward_token_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub staker: Signer<'info>,

    #[account(
        seeds =[
            b"stake-farm".as_ref(),
            stake_farm.manager.key().as_ref()
        ],
        bump = stake_farm.bump
    )]
    pub stake_farm: Account<'info, StakeFarm>,

    #[account(
        mut,
        seeds = [
            b"stake-account".as_ref(),
            stake_account.mint.as_ref(),
            staker.key().as_ref()
        ],
        bump = stake_account.bump
    )]
    pub stake_account: Account<'info, StakeAccount>,

    #[account(
        mut,
        associated_token::mint = reward_token_mint,
        associated_token::authority = stake_farm,
    )]
    pub stake_farm_reward_ata: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = staker,
        associated_token::mint = reward_token_mint,
        associated_token::authority = staker,
    )]
    pub staker_reward_ata: Account<'info, TokenAccount>,

    pub reward_token_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}



