import {
  VersionedTransaction,
  TransactionMessage,
  SystemProgram,
  Keypair,
} from '@solana/web3.js'

void (async () => {
  // Build a minimal self-transfer transaction that deserializes cleanly
  const keypair = Keypair.generate()
  const message = new TransactionMessage({
    payerKey: keypair.publicKey,
    recentBlockhash: '11111111111111111111111111111111',
    instructions: [
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: keypair.publicKey,
        lamports: 1,
      }),
    ],
  }).compileToV0Message()

  const tx = new VersionedTransaction(message)
  const txBase64 = Buffer.from(tx.serialize()).toString('base64')

  const url = process.argv[2] ?? 'http://localhost:3000/api/decode'

  console.log(`[test-decode] sending to ${url}`)
  console.log(`[test-decode] txBase64 = ${txBase64.slice(0, 60)}...`)

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txBase64 }),
  })

  console.log(`[test-decode] status: ${res.status}`)

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    process.stdout.write(decoder.decode(value))
  }
})()
