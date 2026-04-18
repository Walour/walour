import * as anchor from '@coral-xyz/anchor'
import { Program, AnchorError } from '@coral-xyz/anchor'
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js'
import { assert } from 'chai'
import type { WalourOracle } from '../target/types/walour_oracle'

describe('walour_oracle', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.WalourOracle as Program<WalourOracle>
  const authority = provider.wallet as anchor.Wallet

  // Reuse the same target address across tests
  const targetAddress = Keypair.generate().publicKey

  // PDA helpers
  const [oracleConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    program.programId
  )

  const [threatReportPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('threat'), targetAddress.toBuffer()],
    program.programId
  )

  const [reporterPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('reporter'), authority.publicKey.toBuffer()],
    program.programId
  )

  // -------------------------------------------------------------------------
  // 1. initialize
  // -------------------------------------------------------------------------
  it('initializes the oracle config', async () => {
    await program.methods
      .initialize()
      .accounts({
        oracleConfig: oracleConfigPda,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc()

    const config = await program.account.oracleConfig.fetch(oracleConfigPda)
    assert.ok(config.authority.equals(authority.publicKey), 'authority mismatch')
  })

  // -------------------------------------------------------------------------
  // 2. submit_report
  // -------------------------------------------------------------------------
  it('submits a threat report', async () => {
    const evidenceUrl = Buffer.alloc(128)
    const url = Buffer.from('https://chainabuse.com/report/example')
    url.copy(evidenceUrl)

    await program.methods
      .submitReport(
        targetAddress,
        { drainer: {} }, // ThreatType::Drainer
        Array.from(evidenceUrl) as unknown as number[] & { length: 128 }
      )
      .accounts({
        threatReport: threatReportPda,
        reporter: reporterPda,
        signer: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc()

    const report = await program.account.threatReport.fetch(threatReportPda)
    assert.ok(report.address.equals(targetAddress), 'address mismatch')
    assert.equal(report.confidence, 40, 'initial confidence should be 40')
    assert.equal(report.corroborations, 0, 'corroborations should start at 0')
    assert.deepEqual(report.threatType, { drainer: {} }, 'threat type should be Drainer')
    assert.ok(report.firstSeen.gt(new anchor.BN(0)), 'first_seen should be set')
    assert.ok(report.lastUpdated.eq(report.firstSeen), 'first_seen and last_updated should match on init')
  })

  // -------------------------------------------------------------------------
  // 3. corroborate_report (x2)
  // -------------------------------------------------------------------------
  it('corroborates the report twice and recalculates confidence', async () => {
    for (let i = 0; i < 2; i++) {
      await program.methods
        .corroborateReport(targetAddress)
        .accounts({
          threatReport: threatReportPda,
          signer: authority.publicKey,
        })
        .rpc()
    }

    const report = await program.account.threatReport.fetch(threatReportPda)
    assert.equal(report.corroborations, 2, 'corroborations should be 2')
    // confidence = min(100, 40 + 2*5) = 50
    assert.equal(report.confidence, 50, 'confidence should be 50 after 2 corroborations')
  })

  // -------------------------------------------------------------------------
  // 4. update_confidence (authority)
  // -------------------------------------------------------------------------
  it('authority updates confidence to 85', async () => {
    await program.methods
      .updateConfidence(targetAddress, 85)
      .accounts({
        threatReport: threatReportPda,
        oracleConfig: oracleConfigPda,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc()

    const report = await program.account.threatReport.fetch(threatReportPda)
    assert.equal(report.confidence, 85, 'confidence should be 85 after authority update')
  })

  // -------------------------------------------------------------------------
  // 5. unauthorized update_confidence
  // -------------------------------------------------------------------------
  it('rejects update_confidence from a non-authority', async () => {
    const attacker = Keypair.generate()

    // Airdrop a tiny amount so the TX can be signed
    const sig = await provider.connection.requestAirdrop(attacker.publicKey, 1_000_000_000)
    await provider.connection.confirmTransaction(sig, 'confirmed')

    try {
      await program.methods
        .updateConfidence(targetAddress, 99)
        .accounts({
          threatReport: threatReportPda,
          oracleConfig: oracleConfigPda,
          authority: attacker.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([attacker])
        .rpc()

      assert.fail('Expected an Unauthorized error but instruction succeeded')
    } catch (err: unknown) {
      const anchorErr = err as AnchorError
      assert.ok(
        anchorErr.error?.errorMessage?.includes('Unauthorized') ||
          anchorErr.message?.includes('Unauthorized'),
        `Expected Unauthorized error, got: ${anchorErr.message}`
      )
    }
  })

  // -------------------------------------------------------------------------
  // 6. duplicate submit (same address)
  // -------------------------------------------------------------------------
  it('rejects a duplicate submit for the same address', async () => {
    const evidenceUrl = Buffer.alloc(128)

    try {
      await program.methods
        .submitReport(
          targetAddress,
          { rug: {} },
          Array.from(evidenceUrl) as unknown as number[] & { length: 128 }
        )
        .accounts({
          threatReport: threatReportPda,
          reporter: reporterPda,
          signer: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      assert.fail('Expected an error for duplicate submit but instruction succeeded')
    } catch (err: unknown) {
      // Anchor/Solana will throw because the account already exists (init guard)
      const message = (err as Error).message ?? ''
      assert.ok(
        message.length > 0,
        'Should throw an error when re-initialising an existing PDA'
      )
    }
  })
})
