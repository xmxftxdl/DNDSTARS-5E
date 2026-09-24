import { build } from 'vite'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

await build({ configFile: false, publicDir: false, build: {
  ssr: 'scripts/content/build-srd-activities.ts', outDir: '.codex-temp/srd-compiler',
  rollupOptions: { output: { entryFileNames: 'compile.mjs' } },
} })
await import(pathToFileURL(path.resolve('.codex-temp/srd-compiler/compile.mjs')).href)
