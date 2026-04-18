import { defineConfig } from 'vite'
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
      // icons dir — skipped if missing (add manually before CWS submit)
      try {
        mkdirSync('dist/icons', { recursive: true })
      } catch { /* ignore */ }
    },
  }
}

export default defineConfig({
  define: {
    '__SUPABASE_URL__': JSON.stringify(process.env.VITE_SUPABASE_URL ?? ''),
    '__SUPABASE_ANON_KEY__': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY ?? ''),
    '__API_BASE__': JSON.stringify(process.env.VITE_API_BASE ?? 'https://walour-worker.vercel.app'),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.ts'),
        content: resolve(__dirname, 'src/content.ts'),
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
})
