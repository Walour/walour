use anchor_lang::prelude::*;

declare_id!("11111111111111111111111111111111");

// Space constants
// ThreatReport: 8 discriminator + 32 address + 1 threat_type + 32 source + 128 evidence_url + 1 confidence + 8 first_seen + 8 last_updated + 4 corroborations + 1 bump
const THREAT_REPORT_SIZE: usize = 8 + 32 + 1 + 32 + 128 + 1 + 8 + 8 + 4 + 1;

// Reporter: 8 + 32 + 4 + 1 + 8 + 1
const REPORTER_SIZE: usize = 8 + 32 + 4 + 1 + 8 + 1;

// OracleConfig: 8 + 32 + 1
const ORACLE_CONFIG_SIZE: usize = 8 + 32 + 1;

#[program]
pub mod walour_oracle {
    use super::*;

    /// One-time setup: initialises the OracleConfig PDA and sets the authority.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let config = &mut ctx.accounts.oracle_config;
        config.authority = ctx.accounts.authority.key();
        config.bump = ctx.bumps.oracle_config;
        Ok(())
    }

    /// Permissionless: anyone can submit a threat report for an address.
    pub fn submit_report(
        ctx: Context<SubmitReport>,
        address: Pubkey,
        threat_type: ThreatType,
        evidence_url: [u8; 128],
    ) -> Result<()> {
        let clock = Clock::get()?;

        // Populate ThreatReport
        let report = &mut ctx.accounts.threat_report;
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
        reporter.reports_submitted = reporter.reports_submitted.saturating_add(1);
        reporter.last_active = clock.unix_timestamp;

        emit!(ThreatSubmitted {
            address,
            threat_type,
            reporter: ctx.accounts.signer.key(),
            confidence: 40,
        });

        Ok(())
    }

    /// Permissionless: corroborate an existing threat report.
    pub fn corroborate_report(ctx: Context<CorroborateReport>, _address: Pubkey) -> Result<()> {
        let clock = Clock::get()?;
        let report = &mut ctx.accounts.threat_report;

        report.corroborations = report.corroborations.saturating_add(1);
        // confidence = min(100, 40 + corroborations * 5)
        let new_confidence: u8 = 100u8.min(40u8.saturating_add(
            (report.corroborations as u32).saturating_mul(5).min(255) as u8,
        ));
        report.confidence = new_confidence;
        report.last_updated = clock.unix_timestamp;

        emit!(ReportCorroborated {
            address: report.address,
            corroborations: report.corroborations,
            new_confidence,
        });

        Ok(())
    }

    /// Authority-gated: update the confidence score for a threat report.
    pub fn update_confidence(
        ctx: Context<UpdateConfidence>,
        _address: Pubkey,
        new_score: u8,
    ) -> Result<()> {
        require!(new_score <= 100, WalourError::InvalidConfidence);
        require!(
            ctx.accounts.authority.key() == ctx.accounts.oracle_config.authority,
            WalourError::Unauthorized
        );

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
}

// ---------------------------------------------------------------------------
// Account structs
// ---------------------------------------------------------------------------

#[account]
pub struct ThreatReport {
    pub address: Pubkey,
    pub threat_type: ThreatType,
    pub source: [u8; 32],
    pub evidence_url: [u8; 128],
    pub confidence: u8,
    pub first_seen: i64,
    pub last_updated: i64,
    pub corroborations: u32,
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
pub struct OracleConfig {
    pub authority: Pubkey,
    pub bump: u8,
}

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

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
        seeds = [b"threat", address.as_ref()],
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

    #[account(mut)]
    pub signer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(_address: Pubkey)]
pub struct CorroborateReport<'info> {
    #[account(
        mut,
        seeds = [b"threat", _address.as_ref()],
        bump = threat_report.bump
    )]
    pub threat_report: Account<'info, ThreatReport>,

    pub signer: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(_address: Pubkey)]
pub struct UpdateConfidence<'info> {
    #[account(
        mut,
        seeds = [b"threat", _address.as_ref()],
        bump = threat_report.bump
    )]
    pub threat_report: Account<'info, ThreatReport>,

    #[account(
        seeds = [b"config"],
        bump = oracle_config.bump
    )]
    pub oracle_config: Account<'info, OracleConfig>,

    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
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

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[error_code]
pub enum WalourError {
    #[msg("Report already exists for this address")]
    ReportAlreadyExists,
    #[msg("Report not found for this address")]
    ReportNotFound,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Evidence URL too long")]
    EvidenceUrlTooLong,
    #[msg("Confidence score must be 0-100")]
    InvalidConfidence,
}
