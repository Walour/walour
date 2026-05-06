import { createWriteStream, readdirSync, statSync } from 'fs'
import { resolve, relative, join } from 'path'
import { createGzip } from 'zlib'

const distDir = resolve('dist')
const outFile = resolve('walour-extension.zip')

const { default: archiver } = await import('archiver').catch(async () => {
  // fallback: use built-in zip via zip CLI if archiver not installed
  const { execSync } = await import('child_process')
  execSync(`cd dist && zip -r ../walour-extension.zip .`, { stdio: 'inherit' })
  console.log(`\n✓ Created walour-extension.zip`)
  process.exit(0)
})

const output = createWriteStream(outFile)
const archive = archiver('zip', { zlib: { level: 9 } })

output.on('close', () => {
  console.log(`\n✓ Created walour-extension.zip (${(archive.pointer() / 1024).toFixed(1)} KB)`)
})

archive.pipe(output)
archive.directory(distDir, false)
await archive.finalize()
