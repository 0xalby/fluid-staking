use anchor_lang::prelude::*;

#[error_code]
pub enum StakeError {
    #[msg("Keys should be equal")]
    KeyMismatch,
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Mint should be equal")]
    MintMismatch,
    #[msg("Authority should be equal")]
    AccountMismatch,
    #[msg("Invalid Stake Type")]
    InvalidStakeType,
    #[msg("Staking period not over")]
    InvalidUnstake,
    #[msg("Claiming too early")]
    InvalidClaim,
}