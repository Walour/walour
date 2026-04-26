/**
 * seed-chainabuse-csv.ts — One-time bulk seeder from Chainabuse CSV export.
 *
 * RUN ONLY IF:
 *   - /api/ingest cron has been failing for >24h, OR
 *   - threat_reports row count is < 3,500
 *
 * Usage:
 *   npm run seed:chainabuse -- /path/to/chainabuse-export.csv
 *
 * Get the CSV at: https://chainabuse.com/data
 * Download the Solana/SOL export or the full export and filter by chain below.
 *
 * CSV expected columns (flexible — script checks both casings):
 *   address | reported_address | reportedAddress
 *   chain   | blockchain
 *   type    | category
 *   evidence_url | evidenceUrl | url
 */

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/supabase'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BATCH_SIZE = 50
const SOLANA_BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const VALID_TYPES = new Set(['drainer', 'rug', 'phishing_domain', 'malicious_token'])

function normaliseType(raw: string | undefined | null): string {
  if (!raw) return 'drainer'
  const lower = raw.toLowerCase().trim()
  if (VALID_TYPES.has(lower)) return lower
  if (lower.includes('rug')) return 'rug'
  if (lower.includes('phish') || lower.includes('domain')) return 'phishing_domain'
  if (lower.includes('token')) return 'malicious_token'
  return 'drainer'
}

// ---------------------------------------------------------------------------
// CSV parser — lightweight; avoids adding csv-parse as a prod dependency.
// Handles quoted fields with commas inside.
// ---------------------------------------------------------------------------

interface CsvRow {
  [key: string]: string
}

function parseCsv(raw: string): CsvRow[] {
  const lines = raw.split(/\r?\n/).filter(l => l.trim() !== '')
  if (lines.length < 2) return []

  // Parse header
  const headers = splitCsvLine(lines[0]).map(h => h.toLowerCase().trim())

  const rows: CsvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i])
    const row: CsvRow = {}
    headers.forEach((h, idx) => {
      row[h] = (cols[idx] ?? '').trim()
    })
    rows.push(row)
  }
  return rows
}

function splitCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuote = !inQuote
      }
    } else if (ch === ',' && !inQuote) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const csvPath = process.argv[2]
  if (!csvPath) {
    console.error('[seed] Usage: npm run seed:chainabuse -- /path/to/chainabuse-export.csv')
    process.exit(1)
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !supabaseKey) {
    console.error('[seed] SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env')
    process.exit(1)
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey)

  let rawCsv: string
  try {
    rawCsv = readFileSync(csvPath, 'utf-8')
  } catch (err) {
    console.error(`[seed] Could not read file: ${csvPath}`)
    console.error(err)
    process.exit(1)
  }

  const rows = parseCsv(rawCsv)
  console.log(`[seed] Parsed ${rows.length} rows from CSV`)

  // Filter to Solana rows
  const solanaRows = rows.filter(row => {
    const chain = (row['chain'] ?? row['blockchain'] ?? '').toLowerCase()
    const addr = row['address'] ?? row['reported_address'] ?? row['reportedaddress'] ?? ''
    // Keep if chain is SOL/Solana OR if address looks like a Solana base58 address
    return chain === 'sol' || chain === 'solana' || SOLANA_BASE58_RE.test(addr)
  })

  console.log(`[seed] ${solanaRows.length} Solana rows after chain filter`)

  let processed = 0
  let errors = 0

  // Process in batches of BATCH_SIZE
  for (let i = 0; i < solanaRows.length; i += BATCH_SIZE) {
    const batch = solanaRows.slice(i, i + BATCH_SIZE)

    await Promise.all(
      batch.map(async row => {
        const address = (
          row['address'] ??
          row['reported_address'] ??
          row['reportedaddress'] ??
          ''
        ).trim()

        if (!address || !SOLANA_BASE58_RE.test(address)) {
          errors++
          return
        }

        const rawType = row['type'] ?? row['category'] ?? ''
        const evidenceUrl =
          row['evidence_url'] ?? row['evidenceurl'] ?? row['url'] ?? null

        try {
          const { error } = await supabase.rpc('upsert_threat', {
            p_address: address,
            p_type: normaliseType(rawType),
            p_source: 'chainabuse',
            p_evidence_url: evidenceUrl || null,
            p_confidence_delta: 0.9,
          })

          if (error) {
            console.warn(`[seed] Upsert error for ${address}: ${error.message}`)
            errors++
          } else {
            processed++
          }
        } catch (err) {
          console.warn(`[seed] Exception for ${address}: ${err instanceof Error ? err.message : String(err)}`)
          errors++
        }
      })
    )

    const total = Math.min(i + BATCH_SIZE, solanaRows.length)
    console.log(`[seed] processed ${processed} / ${total} (errors: ${errors})`)
  }

  console.log(`[seed] Done. Total processed: ${processed} | errors: ${errors}`)
}

main().catch(err => {
  console.error('[seed] Fatal:', err)
  process.exit(1)
})
