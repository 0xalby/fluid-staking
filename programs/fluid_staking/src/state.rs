use anchor_lang::prelude::*;

#[account]
pub struct StakeFarm {
    pub bump: u8,//1
    pub manager: Pubkey,//32
    pub tickrate: i64, // 16
    pub reward_mint: Pubkey, //32
}

#[account]
pub struct StakeTier {
    pub farm: Pubkey, //32
    pub reward: u64, //8
    pub lock_period: i64, //16
}

#[account]
pub struct StakeMint {
    pub bump: u8,
    pub farm: Pubkey, //32
    pub mint: Pubkey, //32
    pub bonus_reward: u64, //8
}

#[account]
pub struct StakeAccount {
    pub bump: u8, // 1
    pub staker: Pubkey, // 32,
    pub mint: Pubkey, // 32

    pub staked_timestamp: i64, //16
    pub claimed_timestamp: i64, // 16

    pub claimed_tokens: u64, //8

    pub lock_period: i64, //16
    pub stake_tier: Pubkey, //32
    pub reward: u64, //8
}

impl StakeFarm {
    pub const LEN: usize = 1 + 32 + 16 + 32;
}
impl StakeTier {
    pub const LEN: usize =  32 + 16 + 8;
}
impl StakeAccount {
    pub const LEN: usize = 1 + 32 + 32 +  16 +  16 +  8 +  16 + 32 + 8;
}
impl StakeMint {
    pub const LEN: usize = 1 + 32 + 32 + 8;
}
