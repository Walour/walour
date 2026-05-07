import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
} from "@solana/web3.js";
import { assert } from "chai";
import type { WalourOracle } from "../target/types/walour_oracle";

// Lamport stake required by `submit_report` — matches
// COMMUNITY_REPORT_STAKE_LAMPORTS in lib.rs (0.01 SOL).
const COMMUNITY_REPORT_STAKE = 10_000_000;

// Helper: build a 128-byte evidence_url payload
function makeEvidenceUrl(s: string): number[] {
  const out: number[] = Array(128).fill(0);
  const bytes = Buffer.from(s, "utf8");
  for (let i = 0; i < bytes.length && i < 128; i++) out[i] = bytes[i];
  return out;
}

// Helper: fund a fresh keypair from the provider wallet (devnet faucet is
// rate-limited; transferring is more reliable).
async function fund(
  provider: anchor.AnchorProvider,
  to: PublicKey,
  lamports: number
) {
  const tx = new anchor.web3.Transaction().add(
    SystemProgram.transfer({
      fromPubkey: provider.wallet.publicKey,
      toPubkey: to,
      lamports,
    })
  );
  const latest = await provider.connection.getLatestBlockhash();
  tx.recentBlockhash = latest.blockhash;
  tx.feePayer = provider.wallet.publicKey;
  await provider.sendAndConfirm(tx);
}

describe("walour_oracle", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.WalourOracle as Program<WalourOracle>;
  const authority = provider.wallet;

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );
  const [treasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("treasury")],
    program.programId
  );

  // -------------------------------------------------------------------------
  // T0: initialize (idempotent against an already-initialized devnet config)
  // -------------------------------------------------------------------------
  it("initializes the oracle config + treasury", async () => {
    try {
      await program.methods
        .initialize()
        .accounts({
          authority: authority.publicKey,
        } as any)
        .rpc();
    } catch (err: any) {
      // Allow re-running against an already-initialized devnet account.
      if (!String(err).includes("already in use")) {
        throw err;
      }
    }

    const config = await program.account.oracleConfig.fetch(configPda);
    assert.ok(
      config.authority.equals(authority.publicKey),
      "authority should match provider wallet"
    );
  });

  // -------------------------------------------------------------------------
  // T6 (happy path) — submit + corroborate by a *different* signer.
  //
  // Also serves as a precondition for the namespaced PDA layout: each
  // (address, reporter) pair has its own threat_report PDA.
  // -------------------------------------------------------------------------
  it("submit_report (community) writes a namespaced PDA + corroborate works", async () => {
    const reportAddress = Keypair.generate().publicKey;
    const reporterA = Keypair.generate();
    const reporterB = Keypair.generate();
    await fund(provider, reporterA.publicKey, 0.05 * LAMPORTS_PER_SOL);
    await fund(provider, reporterB.publicKey, 0.05 * LAMPORTS_PER_SOL);

    const [threatPdaA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("threat"),
        reportAddress.toBuffer(),
        reporterA.publicKey.toBuffer(),
      ],
      program.programId
    );

    await program.methods
      .submitReport(reportAddress, { drainer: {} }, makeEvidenceUrl("https://walour.xyz/e/1"))
      .accounts({ signer: reporterA.publicKey } as any)
      .signers([reporterA])
      .rpc();

    const report = await program.account.threatReport.fetch(threatPdaA);
    assert.equal(report.version, 1, "version should be 1");
    assert.equal(report.confidence, 40);
    assert.equal(report.corroborations, 0);
    assert.ok(report.address.equals(reportAddress));
    assert.ok(
      report.firstReporter.equals(reporterA.publicKey),
      "first_reporter should be set to original submitter"
    );

    // Different signer corroborates A's report.
    await program.methods
      .corroborateReport(reportAddress, reporterA.publicKey)
      .accounts({ signer: reporterB.publicKey } as any)
      .signers([reporterB])
      .rpc();

    const after = await program.account.threatReport.fetch(threatPdaA);
    assert.equal(after.corroborations, 1);
    assert.equal(after.confidence, 45, "confidence should be 40 + 1*5");
  });

  // -------------------------------------------------------------------------
  // T1 — Sybil corroboration: same keypair tries to submit AND corroborate.
  // The dedicated SelfCorroboration error must fire (not just the PDA
  // collision on the corroboration account).
  // -------------------------------------------------------------------------
  it("blocks self-corroboration (Sybil guard)", async () => {
    const reportAddress = Keypair.generate().publicKey;
    const reporter = Keypair.generate();
    await fund(provider, reporter.publicKey, 0.05 * LAMPORTS_PER_SOL);

    await program.methods
      .submitReport(reportAddress, { rug: {} }, makeEvidenceUrl("https://walour.xyz/e/2"))
      .accounts({ signer: reporter.publicKey } as any)
      .signers([reporter])
      .rpc();

    let threw = false;
    let errMsg = "";
    try {
      await program.methods
        .corroborateReport(reportAddress, reporter.publicKey)
        .accounts({ signer: reporter.publicKey } as any)
        .signers([reporter])
        .rpc();
    } catch (err: any) {
      threw = true;
      errMsg = String(err);
    }
    assert.isTrue(threw, "self-corroboration should fail");
    assert.match(
      errMsg,
      /SelfCorroboration|6002/,
      "error should be SelfCorroboration (code 6002), not just PDA collision"
    );
  });

  // -------------------------------------------------------------------------
  // T2 — Squat resistance: A submits at evil_addr; B can also submit for the
  // SAME evil_addr because seeds are namespaced. Both PDAs end up live.
  // -------------------------------------------------------------------------
  it("two reporters can both file reports for the same address (namespaced PDAs)", async () => {
    const evilAddress = Keypair.generate().publicKey;
    const reporterA = Keypair.generate();
    const reporterB = Keypair.generate();
    await fund(provider, reporterA.publicKey, 0.05 * LAMPORTS_PER_SOL);
    await fund(provider, reporterB.publicKey, 0.05 * LAMPORTS_PER_SOL);

    const [pdaA] = PublicKey.findProgramAddressSync(
      [Buffer.from("threat"), evilAddress.toBuffer(), reporterA.publicKey.toBuffer()],
      program.programId
    );
    const [pdaB] = PublicKey.findProgramAddressSync(
      [Buffer.from("threat"), evilAddress.toBuffer(), reporterB.publicKey.toBuffer()],
      program.programId
    );
    assert.ok(!pdaA.equals(pdaB), "namespaced PDAs must differ between reporters");

    await program.methods
      .submitReport(evilAddress, { phishingDomain: {} }, makeEvidenceUrl("https://walour.xyz/A"))
      .accounts({ signer: reporterA.publicKey } as any)
      .signers([reporterA])
      .rpc();

    // B must succeed even though A already squatted the address — squat
    // resistance is the whole point of the namespaced seed.
    await program.methods
      .submitReport(evilAddress, { phishingDomain: {} }, makeEvidenceUrl("https://walour.xyz/B"))
      .accounts({ signer: reporterB.publicKey } as any)
      .signers([reporterB])
      .rpc();

    const repA = await program.account.threatReport.fetch(pdaA);
    const repB = await program.account.threatReport.fetch(pdaB);
    assert.ok(repA.firstReporter.equals(reporterA.publicKey));
    assert.ok(repB.firstReporter.equals(reporterB.publicKey));
  });

  // -------------------------------------------------------------------------
  // T3 — authority_submit_report: legacy [b"threat", address] seed; only
  // the configured authority can call it.
  // -------------------------------------------------------------------------
  it("authority_submit_report: only authority can write the legacy PDA", async () => {
    const targetAddress = Keypair.generate().publicKey;
    const [legacyPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("threat"), targetAddress.toBuffer()],
      program.programId
    );

    // Bad actor attempt — should fail on has_one constraint.
    const badActor = Keypair.generate();
    await fund(provider, badActor.publicKey, 0.05 * LAMPORTS_PER_SOL);

    let badThrew = false;
    let badErr = "";
    try {
      await program.methods
        .authoritySubmitReport(
          targetAddress,
          { drainer: {} },
          makeEvidenceUrl("https://walour.xyz/bad"),
          90
        )
        .accounts({ authority: badActor.publicKey } as any)
        .signers([badActor])
        .rpc();
    } catch (err: any) {
      badThrew = true;
      badErr = String(err);
    }
    assert.isTrue(badThrew, "non-authority authority_submit_report must fail");
    assert.match(
      badErr,
      /has_one|ConstraintHasOne|2001/i,
      "error should indicate has_one violation"
    );

    // Authority succeeds.
    await program.methods
      .authoritySubmitReport(
        targetAddress,
        { drainer: {} },
        makeEvidenceUrl("https://walour.xyz/auth"),
        95
      )
      .accounts({ authority: authority.publicKey } as any)
      .rpc();

    const report = await program.account.threatReport.fetch(legacyPda);
    assert.equal(report.confidence, 95);
    assert.equal(report.version, 1);
    assert.ok(
      report.firstReporter.equals(authority.publicKey),
      "authority report's first_reporter is the authority"
    );
    // Source tag should be "authority"
    const sourceStr = Buffer.from(report.source).toString("utf8").replace(/\0+$/, "");
    assert.equal(sourceStr, "authority");
  });

  // -------------------------------------------------------------------------
  // T4 — Authority transfer round-trip.
  //
  // The provider wallet is the persistent devnet authority. We can't safely
  // transfer it away permanently (other tests + future devnet runs depend
  // on it), so we transfer A → B → A within this test.
  // -------------------------------------------------------------------------
  it("transfer_authority: rotation works and old authority loses access", async () => {
    const newAuthority = Keypair.generate();
    await fund(provider, newAuthority.publicKey, 0.05 * LAMPORTS_PER_SOL);

    // Setup: a community report we'll try to update_confidence on.
    const reportAddress = Keypair.generate().publicKey;
    const reporter = Keypair.generate();
    await fund(provider, reporter.publicKey, 0.05 * LAMPORTS_PER_SOL);
    await program.methods
      .submitReport(reportAddress, { rug: {} }, makeEvidenceUrl("https://walour.xyz/t4"))
      .accounts({ signer: reporter.publicKey } as any)
      .signers([reporter])
      .rpc();

    // A → B
    await program.methods
      .transferAuthority(newAuthority.publicKey)
      .accounts({ authority: authority.publicKey } as any)
      .rpc();

    let configAfter = await program.account.oracleConfig.fetch(configPda);
    assert.ok(configAfter.authority.equals(newAuthority.publicKey));

    // Old authority can no longer update_confidence.
    let oldThrew = false;
    let oldErr = "";
    try {
      await program.methods
        .updateConfidence(reportAddress, reporter.publicKey, 77)
        .accounts({ authority: authority.publicKey } as any)
        .rpc();
    } catch (err: any) {
      oldThrew = true;
      oldErr = String(err);
    }
    assert.isTrue(oldThrew, "old authority must lose access after rotation");
    assert.match(oldErr, /has_one|ConstraintHasOne|2001/i);

    // New authority CAN update.
    await program.methods
      .updateConfidence(reportAddress, reporter.publicKey, 77)
      .accounts({ authority: newAuthority.publicKey } as any)
      .signers([newAuthority])
      .rpc();

    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("threat"), reportAddress.toBuffer(), reporter.publicKey.toBuffer()],
      program.programId
    );
    const r = await program.account.threatReport.fetch(pda);
    assert.equal(r.confidence, 77, "new authority should have updated confidence");

    // Rotate B → A so subsequent test runs on this devnet config still work.
    await program.methods
      .transferAuthority(authority.publicKey)
      .accounts({ authority: newAuthority.publicKey } as any)
      .signers([newAuthority])
      .rpc();

    configAfter = await program.account.oracleConfig.fetch(configPda);
    assert.ok(
      configAfter.authority.equals(authority.publicKey),
      "authority should be rotated back to the provider wallet"
    );
  });

  // -------------------------------------------------------------------------
  // T5 — Stake transfer: submit_report deducts COMMUNITY_REPORT_STAKE
  // lamports and the treasury PDA balance grows by the same amount (modulo
  // signer transaction fees — we only check the treasury delta, since fees
  // are non-deterministic).
  // -------------------------------------------------------------------------
  it("submit_report transfers stake into the treasury PDA", async () => {
    const reportAddress = Keypair.generate().publicKey;
    const reporter = Keypair.generate();
    await fund(provider, reporter.publicKey, 0.05 * LAMPORTS_PER_SOL);

    const treasuryBefore = await provider.connection.getBalance(treasuryPda);
    const reporterBefore = await provider.connection.getBalance(reporter.publicKey);

    await program.methods
      .submitReport(reportAddress, { maliciousToken: {} }, makeEvidenceUrl("https://walour.xyz/t5"))
      .accounts({ signer: reporter.publicKey } as any)
      .signers([reporter])
      .rpc();

    const treasuryAfter = await provider.connection.getBalance(treasuryPda);
    const reporterAfter = await provider.connection.getBalance(reporter.publicKey);

    assert.equal(
      treasuryAfter - treasuryBefore,
      COMMUNITY_REPORT_STAKE,
      "treasury PDA should grow by exactly the stake amount"
    );
    // Reporter delta = stake + tx fee + rent for threat_report PDA + (maybe) rent for reporter PDA.
    // Tighter bound: reporter must lose at least the stake.
    assert.isAtLeast(
      reporterBefore - reporterAfter,
      COMMUNITY_REPORT_STAKE,
      "reporter should be debited at least the stake amount"
    );
  });
});
