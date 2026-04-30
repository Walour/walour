import { defineConfig, loadEnv } from 'vite'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, existsSync } from 'fs'

function copyStaticAssets() {
  return {
    name: 'copy-static',
    closeBundle() {
      const files = ['manifest.json', 'popup.html', 'options.html']
      for (const f of files) {
        if (existsSync(f)) copyFileSync(f, `dist/${f}`)
      }
      // copy shared design tokens (Phase 4) — fail loudly if missing
      const tokensSrc = resolve(__dirname, '../../packages/tokens/tokens.css')
      if (!existsSync(tokensSrc)) {
        throw new Error(`[copy-static] packages/tokens/tokens.css not found at ${tokensSrc} — popup will be unstyled. Run \`pnpm -w build\` for the tokens package or verify Wave 1 created it.`)
      }
      copyFileSync(tokensSrc, 'dist/tokens.css')
      // copy icons
      try {
        mkdirSync('dist/icons', { recursive: true })
        for (const size of [16, 32, 48, 128]) {
          const src = `icons/icon${size}.png`
          if (existsSync(src)) copyFileSync(src, `dist/icons/icon${size}.png`)
        }
      } catch { /* ignore */ }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
  define: {
    '__SUPABASE_URL__': JSON.stringify(env.VITE_SUPABASE_URL ?? ''),
    '__SUPABASE_ANON_KEY__': JSON.stringify(env.VITE_SUPABASE_ANON_KEY ?? ''),
    '__API_BASE__': JSON.stringify(env.VITE_API_BASE ?? 'https://walour-worker.vercel.app'),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.ts'),
        content: resolve(__dirname, 'src/content.ts'),
        bridge: resolve(__dirname, 'src/bridge.ts'),
        popup: resolve(__dirname, 'src/popup.ts'),
        options: resolve(__dirname, 'src/options.ts'),
      },
      output: {
        format: 'es',
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
    modulePreload: false,
    cssCodeSplit: false,
  },
  plugins: [copyStaticAssets()],
  }
})
