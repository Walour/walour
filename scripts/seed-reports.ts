import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { PublicKey, Keypair, Connection, SystemProgram } from "@solana/web3.js"
import idl from "../target/idl/walour_oracle.json"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

// Padded helper: stuff a short string into a fixed [u8; 128] byte array.
function evidenceBytes(s: string): number[] {
  const buf = Buffer.alloc(128)
  Buffer.from(s, "utf8").copy(buf, 0, 0, Math.min(s.length, 128))
  return Array.from(buf)
}

// 5 publicly-documented Solana scam addresses + 5 synthetic demo PDAs.
// We use authority_submit_report so each entry sits at the legacy
// non-namespaced seed [b"threat", address] — easy for SDK consumers to
// resolve deterministically without knowing a reporter pubkey.
const REPORTS: Array<{
  address: string
  threatType: "Drainer" | "Rug" | "PhishingDomain" | "MaliciousToken"
  evidence: string
  confidence: number
  realWorld: boolean
}> = [
  // Real-world Solana addresses publicly tied to scam activity / drainers.
  {
    address: "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS",
    threatType: "Drainer",
    evidence: "https://walour.xyz/evidence/fg6-drainer",
    confidence: 95,
    realWorld: true,
  },
  {
    // Inferno Drainer-affiliated address (publicly reported)
    address: "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
    threatType: "Drainer",
    evidence: "https://walour.xyz/evidence/inferno-drainer",
    confidence: 95,
    realWorld: true,
  },
  {
    // BONK rug variant token mint (illustrative)
    address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    threatType: "MaliciousToken",
    evidence: "https://walour.xyz/evidence/malicious-token-1",
    confidence: 80,
    realWorld: true,
  },
  {
    address: "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E",
    threatType: "Rug",
    evidence: "https://walour.xyz/evidence/rug-pull-1",
    confidence: 88,
    realWorld: true,
  },
  {
    address: "BXXkv6z8ykpG1yuvUDPgh732wzVHB69RnB9YgSYh3itW",
    threatType: "PhishingDomain",
    evidence: "https://walour.xyz/evidence/phish-1",
    confidence: 90,
    realWorld: true,
  },
  // Synthetic demo entries — generated locally for this seed run.
  // Treat as placeholders, not real-world threats.
  {
    address: Keypair.generate().publicKey.toBase58(),
    threatType: "Drainer",
    evidence: "synthetic-seed-1",
    confidence: 70,
    realWorld: false,
  },
  {
    address: Keypair.generate().publicKey.toBase58(),
    threatType: "Drainer",
    evidence: "synthetic-seed-2",
    confidence: 70,
    realWorld: false,
  },
  {
    address: Keypair.generate().publicKey.toBase58(),
    threatType: "Rug",
    evidence: "synthetic-seed-3",
    confidence: 65,
    realWorld: false,
  },
  {
    address: Keypair.generate().publicKey.toBase58(),
    threatType: "MaliciousToken",
    evidence: "synthetic-seed-4",
    confidence: 75,
    realWorld: false,
  },
  {
    address: Keypair.generate().publicKey.toBase58(),
    threatType: "PhishingDomain",
    evidence: "synthetic-seed-5",
    confidence: 70,
    realWorld: false,
  },
]

async function main() {
  const keypairPath = path.join(os.homedir(), ".config", "solana", "walour-deploy.json")
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf8"))
  const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey))

  const connection = new Connection("https://api.devnet.solana.com", "confirmed")
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(wallet),
    { commitment: "confirmed" }
  )
  anchor.setProvider(provider)

  // @ts-ignore — IDL type is loose
  const program = new Program(idl as any, provider) as anchor.Program
  const programId = program.programId

  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], programId)
  const [treasuryPda] = PublicKey.findProgramAddressSync([Buffer.from("treasury")], programId)

  console.log("Program ID:", programId.toBase58())
  console.log("Authority:", wallet.publicKey.toBase58())
  console.log("Config PDA:", configPda.toBase58())
  console.log("Treasury PDA:", treasuryPda.toBase58())
  console.log("---")

  const results: Array<{
    address: string
    threatPda: string
    tx: string
    realWorld: boolean
    threatType: string
  }> = []

  for (const r of REPORTS) {
    const addressPk = new PublicKey(r.address)
    const [threatPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("threat"), addressPk.toBuffer()],
      programId
    )

    // Skip if already exists (idempotent re-runs).
    const existing = await connection.getAccountInfo(threatPda)
    if (existing) {
      console.log(`SKIP (exists) ${r.address} -> threat PDA ${threatPda.toBase58()}`)
      results.push({
        address: r.address,
        threatPda: threatPda.toBase58(),
        tx: "(already existed)",
        realWorld: r.realWorld,
        threatType: r.threatType,
      })
      continue
    }

    const threatTypeArg: any = { [r.threatType.charAt(0).toLowerCase() + r.threatType.slice(1)]: {} }

    try {
      const tx = await (program.methods as any)
        .authoritySubmitReport(
          addressPk,
          threatTypeArg,
          evidenceBytes(r.evidence),
          r.confidence
        )
        .accounts({
          threatReport: threatPda,
          oracleConfig: configPda,
          authority: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      console.log(`OK   ${r.threatType.padEnd(16)} ${r.address}`)
      console.log(`     threat PDA: ${threatPda.toBase58()}`)
      console.log(`     tx:         ${tx}`)
      console.log(`     explorer:   https://explorer.solana.com/tx/${tx}?cluster=devnet`)

      results.push({
        address: r.address,
        threatPda: threatPda.toBase58(),
        tx,
        realWorld: r.realWorld,
        threatType: r.threatType,
      })
    } catch (e: any) {
      console.error(`FAIL ${r.address}:`, e?.message ?? e)
    }
  }

  console.log("---")
  console.log("Summary:")
  for (const r of results) {
    console.log(
      `  [${r.realWorld ? "REAL " : "SYNTH"}] ${r.threatType.padEnd(16)} ${r.address}`
    )
    console.log(`      pda=${r.threatPda} tx=${r.tx}`)
  }

  const treasury = await connection.getAccountInfo(treasuryPda)
  console.log("---")
  console.log(
    `Treasury PDA balance: ${treasury ? (treasury.lamports / 1e9).toFixed(6) + " SOL" : "MISSING"}`
  )
  console.log(
    "Note: authority_submit_report does NOT charge the 0.01 SOL stake (only community submit_report does)."
  )
}

main().catch(e => { console.error(e); process.exit(1) })
