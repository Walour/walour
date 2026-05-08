import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { PublicKey, Keypair, Connection, SystemProgram } from "@solana/web3.js"
import idl from "../target/idl/walour_oracle.json"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

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

  const existingConfig = await connection.getAccountInfo(configPda)
  if (existingConfig) {
    console.log("OracleConfig already exists — skipping initialize")
  } else {
    console.log("Calling initialize()...")
    const tx = await (program.methods as any)
      .initialize()
      .accounts({
        oracleConfig: configPda,
        treasury: treasuryPda,
        authority: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc()
    console.log("Initialize tx:", tx)
    console.log("Explorer:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`)
  }

  const cfg = await connection.getAccountInfo(configPda)
  const trs = await connection.getAccountInfo(treasuryPda)
  console.log("OracleConfig now:", cfg ? `EXISTS (${cfg.data.length} bytes)` : "MISSING")
  console.log("Treasury now:", trs ? `EXISTS (${trs.data.length} bytes, lamports=${trs.lamports})` : "MISSING")
}

main().catch(e => { console.error(e); process.exit(1) })
