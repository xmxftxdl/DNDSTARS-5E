import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import {
  assertExternalArtExcludedFromBuild,
  copyBuildPublicAssets,
} from './scripts/build-public-assets.mjs'

function lightweightPublicAssetsPlugin() {
  return {
    name: 'stars-lightweight-public-assets',
    async writeBundle() {
      await copyBuildPublicAssets()
      await assertExternalArtExcludedFromBuild()
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  publicDir: command === 'serve' ? 'public' : false,
  plugins: [
    react(),
    tailwindcss(),
    ...(command === 'build' ? [lightweightPublicAssetsPlugin()] : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Multi-page (T-P2-397): the dice iframe is its own HTML entry so Vite
    // bundles the threejs engine + the diceEngine/diceNotation modules into it.
    // It was previously a verbatim public/ file that could not import app code.
    // Both dev (Vite serves root *.html at their path) and the static dist serve
    // preserve the /dice-box-frame.html URL, so the React side is unchanged (AC4).
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        diceFrame: path.resolve(__dirname, 'dice-box-frame.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('srdMonsters.generated.json')) return 'srd-monster-catalog'
        },
      },
    },
  },
}))
