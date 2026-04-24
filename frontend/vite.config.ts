import { defineConfig } from 'vite'
import path from 'path'
import { statSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// Timestamp of the most-recently-modified data file. Surfaced to the client
// as the compile-time constant __LAST_UPDATED__ so the footer can show a
// "last updated" counter that reflects real data changes (not build time).
function latestDataMtimeISO(): string {
  const files = [
    '../data/pipeline_2/aiadmk.enriched.json',
    '../data/pipeline_2/dmk.enriched.json',
    '../data/pipeline_2/tvk_en.enriched.json',
    'src/app/manifestoData.ts',
    'src/app/tamilnadu.geo.json',
  ].map((p) => path.resolve(__dirname, p))
  let maxMs = 0
  for (const f of files) {
    try {
      const m = statSync(f).mtimeMs
      if (m > maxMs) maxMs = m
    } catch {
      // missing file — skip
    }
  }
  return new Date(maxMs || Date.now()).toISOString()
}

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  base: '/tn-2026/',
  define: {
    __LAST_UPDATED__: JSON.stringify(latestDataMtimeISO()),
  },
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    fs: {
      // Allow importing the enriched JSON files from ../data/pipeline_2
      allow: [path.resolve(__dirname, '..')],
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
