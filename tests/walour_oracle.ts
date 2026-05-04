import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";
import type { WalourOracle } from "../target/types/walour_oracle";

describe("walour_oracle", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.WalourOracle as Program<WalourOracle>;
  const authority = provider.wallet;

  // Shared state across tests
  const reportAddress = Keypair.generate().publicKey;

  const evidenceUrl: number[] = Array(128).fill(0);
  const urlBytes = Buffer.from("https://walour.xyz/evidence/test", "utf8");
  for (let i = 0; i < urlBytes.length && i < 128; i++) {
    evidenceUrl[i] = urlBytes[i];
  }

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  const [threatPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("threat"), reportAddress.toBuffer()],
    program.programId
  );

  const [reporterPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("reporter"), authority.publicKey.toBuffer()],
    program.programId
  );

  const [corroborationPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("corroboration"),
      reportAddress.toBuffer(),
      authority.publicKey.toBuffer(),
    ],
    program.programId
  );

  it("initializes the oracle config", async () => {
    try {
      await program.methods
        .initialize()
        .accounts({
          authority: authority.publicKey,
        } as any)
        .rpc();
    } catch (err: any) {
      // Allow re-running against an already-initialized config on devnet
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

  it("submits a threat report (happy path)", async () => {
    await program.methods
      .submitReport(reportAddress, { drainer: {} }, evidenceUrl)
      .accounts({
        signer: authority.publicKey,
      } as any)
      .rpc();

    const report = await program.account.threatReport.fetch(threatPda);
    assert.equal(report.confidence, 40, "confidence should be 40");
    assert.equal(report.corroborations, 0, "corroborations should be 0");
    assert.ok(
      report.address.equals(reportAddress),
      "reported address should match"
    );
    assert.property(
      report.threatType,
      "drainer",
      "threat type should be Drainer"
    );
  });

  it("creates the reporter PDA on submit", async () => {
    const reporter = await program.account.reporter.fetch(reporterPda);
    assert.isAtLeast(
      reporter.reportsSubmitted,
      1,
      "reports_submitted should be at least 1"
    );
    assert.ok(
      reporter.pubkey.equals(authority.publicKey),
      "reporter pubkey should match signer"
    );
  });

  it("corroborates a report", async () => {
    await program.methods
      .corroborateReport(reportAddress)
      .accounts({
        signer: authority.publicKey,
      } as any)
      .rpc();

    const report = await program.account.threatReport.fetch(threatPda);
    assert.equal(report.corroborations, 1, "corroborations should be 1");
    assert.equal(
      report.confidence,
      45,
      "confidence should be 45 (40 + 1 * 5)"
    );

    const corroboration = await program.account.corroboration.fetch(
      corroborationPda
    );
    assert.ok(
      corroboration.reporter.equals(authority.publicKey),
      "corroboration reporter should match signer"
    );
  });

  it("blocks the same signer from corroborating twice (sybil guard)", async () => {
    let threw = false;
    try {
      await program.methods
        .corroborateReport(reportAddress)
        .accounts({
          signer: authority.publicKey,
        } as any)
        .rpc();
    } catch (err) {
      threw = true;
    }
    assert.isTrue(
      threw,
      "second corroboration from same signer should fail (PDA already exists)"
    );
  });

  it("allows the authority to update confidence", async () => {
    const newScore = 90;
    await program.methods
      .updateConfidence(reportAddress, newScore)
      .accounts({
        authority: authority.publicKey,
      } as any)
      .rpc();

    const report = await program.account.threatReport.fetch(threatPda);
    assert.equal(report.confidence, newScore, "confidence should be updated");
  });

  it("blocks non-authority from updating confidence", async () => {
    const badActor = Keypair.generate();

    // Fund bad actor via transfer from authority (avoids devnet faucet rate limit)
    const transferIx = anchor.web3.SystemProgram.transfer({
      fromPubkey: authority.publicKey,
      toPubkey: badActor.publicKey,
      lamports: 0.01 * LAMPORTS_PER_SOL,
    });
    const tx = new anchor.web3.Transaction().add(transferIx);
    const latest = await provider.connection.getLatestBlockhash();
    tx.recentBlockhash = latest.blockhash;
    tx.feePayer = authority.publicKey;
    await provider.sendAndConfirm(tx);

    let threw = false;
    let errMsg = "";
    try {
      await program.methods
        .updateConfidence(reportAddress, 10)
        .accounts({
          authority: badActor.publicKey,
        } as any)
        .signers([badActor])
        .rpc();
    } catch (err: any) {
      threw = true;
      errMsg = String(err);
    }

    assert.isTrue(threw, "non-authority update should fail");
    assert.match(
      errMsg,
      /Unauthorized|6000|constraint/i,
      "error should indicate unauthorized access"
    );
  });
});
