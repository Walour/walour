use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};

declare_id!("A2pxWB5ro7h1vh4yc7kQeQ4eydV1iA3Fgy9kQ9zhaZVQ");

// ---------------------------------------------------------------------------
// Space constants
// ---------------------------------------------------------------------------
//
// ThreatReport layout (Wave 1A — bumped + namespaced):
//   8  discriminator
// + 1  version (u8)
// + 32 address
// + 1  threat_type (1-byte enum tag)
// + 32 source
// + 128 evidence_url
// + 1  confidence
// + 8  first_seen
// + 8  last_updated
// + 4  corroborations
// + 32 first_reporter
// + 1  bump
const THREAT_REPORT_SIZE: usize = 8 + 1 + 32 + 1 + 32 + 128 + 1 + 8 + 8 + 4 + 32 + 1;

// Reporter: 8 + 32 + 4 + 1 + 8 + 1
const REPORTER_SIZE: usize = 8 + 32 + 4 + 1 + 8 + 1;

// Corroboration: 8 + 32 + 8 + 1
const CORROBORATION_SIZE: usize = 8 + 32 + 8 + 1;

// OracleConfig: 8 + 32 + 1
const ORACLE_CONFIG_SIZE: usize = 8 + 32 + 1;

// Treasury: 8 discriminator + 1 bump (PDA only used as a lamport sink)
const TREASURY_SIZE: usize = 8 + 1;

/// Current ThreatReport version. Bump when the on-chain layout changes so
/// off-chain consumers can fail-loud on unknown versions.
pub const THREAT_REPORT_VERSION: u8 = 1;

/// Lamport stake required for a community `submit_report`. 0.01 SOL.
/// Transferred from `signer` into the treasury PDA, raising the cost of
/// Sybil report-spam without requiring any slashing logic in this pass.
pub const COMMUNITY_REPORT_STAKE_LAMPORTS: u64 = 10_000_000;

#[program]
pub mod walour_oracle {
    use super::*;

    /// One-time setup: initialises the OracleConfig + Treasury PDAs and sets
    /// the authority.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let config = &mut ctx.accounts.oracle_config;
        config.authority = ctx.accounts.authority.key();
        config.bump = ctx.bumps.oracle_config;

        let treasury = &mut ctx.accounts.treasury;
        treasury.bump = ctx.bumps.treasury;
        Ok(())
    }

    /// Permissionless: anyone can submit a community threat report for an
    /// address. PDA seed is namespaced by the reporter pubkey, so two
    /// distinct reporters can each submit a report for the same address —
    /// off-chain aggregation decides the consensus.
    ///
    /// Charges `COMMUNITY_REPORT_STAKE_LAMPORTS` from `signer` into the
    /// treasury PDA so cheap-keypair report spam costs real lamports.
    pub fn submit_report(
        ctx: Context<SubmitReport>,
        address: Pubkey,
        threat_type: ThreatType,
        evidence_url: [u8; 128],
    ) -> Result<()> {
        let clock = Clock::get()?;

        // Charge the community stake into the treasury PDA before mutating
        // any state. This is a normal SystemProgram::transfer CPI; the
        // treasury PDA is owned by this program, and `system_program::transfer`
        // is happy to top up an account it doesn't own.
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.signer.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        );
        system_program::transfer(cpi_ctx, COMMUNITY_REPORT_STAKE_LAMPORTS)?;

        // Populate ThreatReport
        let report = &mut ctx.accounts.threat_report;
        report.version = THREAT_REPORT_VERSION;
        report.address = address;
        report.threat_type = threat_type.clone();
        // Default source tag: "community" left-padded to 32 bytes
        let mut source = [0u8; 32];
        let tag = b"community";
        source[..tag.len()].copy_from_slice(tag);
        report.source = source;
        report.evidence_url = evidence_url;
        report.confidence = 40; // community weight
        report.first_seen = clock.unix_timestamp;
        report.last_updated = clock.unix_timestamp;
        report.corroborations = 0;
        report.first_reporter = ctx.accounts.signer.key();
        report.bump = ctx.bumps.threat_report;

        // Populate / update Reporter
        let reporter = &mut ctx.accounts.reporter;
        if reporter.pubkey == Pubkey::default() {
            // First-time init
            reporter.pubkey = ctx.accounts.signer.key();
            reporter.reports_submitted = 0;
            reporter.confidence_avg = 0;
            reporter.bump = ctx.bumps.reporter;
        }
        let prev_count = reporter.reports_submitted as u32;
        reporter.reports_submitted = reporter.reports_submitted.saturating_add(1);
        // Running average: new_avg = (old_avg * prev_count + new_confidence) / new_count
        let new_count = reporter.reports_submitted as u32;
        let new_avg = ((reporter.confidence_avg as u32 * prev_count) + 40) / new_count;
        reporter.confidence_avg = new_avg.min(100) as u8;
        reporter.last_active = clock.unix_timestamp;

        emit!(ThreatSubmitted {
            address,
            threat_type,
            reporter: ctx.accounts.signer.key(),
            confidence: 40,
        });

        Ok(())
    }

    /// Authority-gated fast-track flagging. Writes to the *legacy* seed
    /// `[b"threat", address]` so authoritative entries have a deterministic
    /// PDA the SDK can resolve without knowing a reporter pubkey.
    ///
    /// Gated declaratively via `has_one = authority` on `oracle_config`.
    pub fn authority_submit_report(
        ctx: Context<AuthoritySubmitReport>,
        address: Pubkey,
        threat_type: ThreatType,
        evidence_url: [u8; 128],
        confidence: u8,
    ) -> Result<()> {
        require!(confidence <= 100, WalourError::InvalidConfidence);

        let clock = Clock::get()?;
        let report = &mut ctx.accounts.threat_report;
        report.version = THREAT_REPORT_VERSION;
        report.address = address;
        report.threat_type = threat_type.clone();
        let mut source = [0u8; 32];
        let tag = b"authority";
        source[..tag.len()].copy_from_slice(tag);
        report.source = source;
        report.evidence_url = evidence_url;
        report.confidence = confidence;
        report.first_seen = clock.unix_timestamp;
        report.last_updated = clock.unix_timestamp;
        report.corroborations = 0;
        report.first_reporter = ctx.accounts.authority.key();
        report.bump = ctx.bumps.threat_report;

        emit!(ThreatSubmitted {
            address,
            threat_type,
            reporter: ctx.accounts.authority.key(),
            confidence,
        });

        Ok(())
    }

    /// Permissionless: corroborate an existing namespaced threat report.
    /// Refuses if the corroborating signer is the same key that originally
    /// submitted the report (Sybil self-corroboration guard, on top of the
    /// per-(report, signer) `Corroboration` PDA collision guard).
    pub fn corroborate_report(
        ctx: Context<CorroborateReport>,
        _address: Pubkey,
        _first_reporter: Pubkey,
    ) -> Result<()> {
        let clock = Clock::get()?;
        let report = &mut ctx.accounts.threat_report;

        require!(
            ctx.accounts.signer.key() != report.first_reporter,
            WalourError::SelfCorroboration
        );

        report.corroborations = report.corroborations.saturating_add(1);
        // confidence = min(100, 40 + corroborations * 5)
        let new_confidence: u8 = 100u8.min(40u8.saturating_add(
            (report.corroborations as u32).saturating_mul(5).min(255) as u8,
        ));
        report.confidence = new_confidence;
        report.last_updated = clock.unix_timestamp;

        ctx.accounts.corroboration.reporter = ctx.accounts.signer.key();
        ctx.accounts.corroboration.timestamp = clock.unix_timestamp;
        ctx.accounts.corroboration.bump = ctx.bumps.corroboration;

        emit!(ReportCorroborated {
            address: report.address,
            corroborations: report.corroborations,
            new_confidence,
        });

        Ok(())
    }

    /// Authority-gated: update the confidence score for a threat report.
    /// Authority check is now fully declarative (`has_one = authority`) on
    /// `oracle_config` — the manual `require!` guard has been removed.
    pub fn update_confidence(
        ctx: Context<UpdateConfidence>,
        _address: Pubkey,
        _first_reporter: Pubkey,
        new_score: u8,
    ) -> Result<()> {
        require!(new_score <= 100, WalourError::InvalidConfidence);

        let clock = Clock::get()?;
        let report = &mut ctx.accounts.threat_report;
        let old_confidence = report.confidence;
        report.confidence = new_score;
        report.last_updated = clock.unix_timestamp;

        emit!(ConfidenceUpdated {
            address: report.address,
            old_confidence,
            new_confidence: new_score,
        });

        Ok(())
    }

    /// Authority-gated: rotate the oracle authority to a new key. Useful for
    /// recovery (lost key → multisig → cold-storage handover) without
    /// redeploying the program.
    pub fn transfer_authority(
        ctx: Context<TransferAuthority>,
        new_authority: Pubkey,
    ) -> Result<()> {
        let config = &mut ctx.accounts.oracle_config;
        let old_authority = config.authority;
        config.authority = new_authority;

        emit!(AuthorityTransferred {
            old_authority,
            new_authority,
        });

        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Account structs
// ---------------------------------------------------------------------------

#[account]
pub struct ThreatReport {
    /// On-chain layout version. Off-chain consumers must fail-loud if they
    /// see a version they don't understand.
    pub version: u8,
    pub address: Pubkey,
    pub threat_type: ThreatType,
    pub source: [u8; 32],
    pub evidence_url: [u8; 128],
    pub confidence: u8,
    pub first_seen: i64,
    pub last_updated: i64,
    pub corroborations: u32,
    /// The keypair that originally created this report. Used to prevent
    /// self-corroboration and to namespace the PDA seed for community
    /// reports.
    pub first_reporter: Pubkey,
    pub bump: u8,
}

#[account]
pub struct Reporter {
    pub pubkey: Pubkey,
    pub reports_submitted: u32,
    pub confidence_avg: u8,
    pub last_active: i64,
    pub bump: u8,
}

#[account]
pub struct Corroboration {
    pub reporter: Pubkey,
    pub timestamp: i64,
    pub bump: u8,
}

#[account]
pub struct OracleConfig {
    pub authority: Pubkey,
    pub bump: u8,
}

#[account]
pub struct Treasury {
    pub bump: u8,
}

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/// Marked `#[non_exhaustive]` so adding a new variant in a future program
/// version does not silently break exhaustive `match` statements in
/// downstream Rust consumers — they'll get a compile error and update.
#[non_exhaustive]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ThreatType {
    Drainer,
    Rug,
    PhishingDomain,
    MaliciousToken,
}

// ---------------------------------------------------------------------------
// Instruction contexts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = ORACLE_CONFIG_SIZE,
        seeds = [b"config"],
        bump
    )]
    pub oracle_config: Account<'info, OracleConfig>,

    #[account(
        init,
        payer = authority,
        space = TREASURY_SIZE,
        seeds = [b"treasury"],
        bump
    )]
    pub treasury: Account<'info, Treasury>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(address: Pubkey)]
pub struct SubmitReport<'info> {
    #[account(
        init,
        payer = signer,
        space = THREAT_REPORT_SIZE,
        seeds = [b"threat", address.as_ref(), signer.key().as_ref()],
        bump
    )]
    pub threat_report: Account<'info, ThreatReport>,

    #[account(
        init_if_needed,
        payer = signer,
        space = REPORTER_SIZE,
        seeds = [b"reporter", signer.key().as_ref()],
        bump
    )]
    pub reporter: Account<'info, Reporter>,

    #[account(
        mut,
        seeds = [b"treasury"],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, Treasury>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(address: Pubkey)]
pub struct AuthoritySubmitReport<'info> {
    #[account(
        init,
        payer = authority,
        space = THREAT_REPORT_SIZE,
        // Legacy non-namespaced seed for authority-issued fast-track reports.
        seeds = [b"threat", address.as_ref()],
        bump
    )]
    pub threat_report: Account<'info, ThreatReport>,

    #[account(
        seeds = [b"config"],
        bump = oracle_config.bump,
        has_one = authority,
    )]
    pub oracle_config: Account<'info, OracleConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(_address: Pubkey, _first_reporter: Pubkey)]
pub struct CorroborateReport<'info> {
    #[account(
        mut,
        seeds = [b"threat", _address.as_ref(), _first_reporter.as_ref()],
        bump = threat_report.bump
    )]
    pub threat_report: Account<'info, ThreatReport>,

    #[account(
        init,
        payer = signer,
        space = CORROBORATION_SIZE,
        seeds = [b"corroboration", _address.as_ref(), _first_reporter.as_ref(), signer.key().as_ref()],
        bump
    )]
    pub corroboration: Account<'info, Corroboration>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(_address: Pubkey, _first_reporter: Pubkey)]
pub struct UpdateConfidence<'info> {
    #[account(
        mut,
        seeds = [b"threat", _address.as_ref(), _first_reporter.as_ref()],
        bump = threat_report.bump
    )]
    pub threat_report: Account<'info, ThreatReport>,

    #[account(
        seeds = [b"config"],
        bump = oracle_config.bump,
        has_one = authority,
    )]
    pub oracle_config: Account<'info, OracleConfig>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct TransferAuthority<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = oracle_config.bump,
        has_one = authority,
    )]
    pub oracle_config: Account<'info, OracleConfig>,

    pub authority: Signer<'info>,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[event]
pub struct ThreatSubmitted {
    pub address: Pubkey,
    pub threat_type: ThreatType,
    pub reporter: Pubkey,
    pub confidence: u8,
}

#[event]
pub struct ReportCorroborated {
    pub address: Pubkey,
    pub corroborations: u32,
    pub new_confidence: u8,
}

#[event]
pub struct ConfidenceUpdated {
    pub address: Pubkey,
    pub old_confidence: u8,
    pub new_confidence: u8,
}

#[event]
pub struct AuthorityTransferred {
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[error_code]
pub enum WalourError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Confidence score must be 0-100")]
    InvalidConfidence,
    #[msg("Reporter cannot corroborate their own report")]
    SelfCorroboration,
}
