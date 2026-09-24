import { build } from 'vite'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const [source, output, script] = process.argv.slice(2)
if (!source || !output) throw new Error('Usage: node scripts/build-community-module.mjs content.json output.starmod [main.mjs]')
await build({ configFile:false, publicDir:false, build:{
 ssr:'scripts/content/build-community-module.ts', outDir:'.codex-temp/community-module-compiler',
 rollupOptions:{output:{entryFileNames:'compile.mjs'}},
} })
const compiler = await import(pathToFileURL(path.resolve('.codex-temp/community-module-compiler/compile.mjs')).href)
await compiler.buildCommunityModule(path.resolve(source),path.resolve(output),script ? path.resolve(script) : undefined)
