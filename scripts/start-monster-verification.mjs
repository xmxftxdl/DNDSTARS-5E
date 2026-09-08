import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import { spawn } from 'node:child_process'

const root = path.resolve('.codex-temp/monster-verification-20260904')
const sourceRoot = path.resolve(process.env.STARS_MONSTER_SOURCE_DIR ?? '.')
const relativeSource = path.relative(process.cwd(), sourceRoot)
if (relativeSource.startsWith('..') || path.isAbsolute(relativeSource)) throw new Error('Source must stay inside this repository')
if (!fs.existsSync(path.join(sourceRoot, 'scripts/vite-server.mjs'))) throw new Error('Missing verification source')
const ports = [6973, 6974]
// Fail rather than attaching the fixture writer to an existing table.
for (const port of ports) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer()
    probe.once('error', () => reject(new Error(`Port ${port} is occupied; leave that task running and use its own launcher.`)))
    probe.listen(port, '127.0.0.1', () => probe.close(resolve))
  })
}
for (const folder of ['shared', 'empty-ai', 'empty-voice']) fs.mkdirSync(path.join(root, folder), { recursive: true })
const children = ports.map((port, index) => spawn(process.execPath, [
  'scripts/vite-server.mjs', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--art-asset-root', 'public',
], {
  windowsHide: true,
  cwd: sourceRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    ASTRALTRACE_LOCAL_AI_CONFIG_DIR: path.join(root, 'empty-ai'),
    ASTRALTRACE_LOCAL_VOICE_CONFIG_DIR: path.join(root, 'empty-voice'),
    STARS_SHARED_ROOT: path.join(root, 'shared'),
    STARS_ACCOUNT_STORAGE: 'json',
    STARS_VITE_CACHE_DIR: path.join(root, `vite-${port}`),
    VITE_BYPASS_ROOM_LOBBY: '1',
    VITE_APP_MODE: index === 0 ? 'dm' : 'player',
    VITE_PLAYER_SLOT: 'player1',
    VITE_SHARED_API_BASES: ports.map(value => `http://127.0.0.1:${value}/api`).join(','),
  },
}))
let stopping = false
function stop() {
  if (stopping) return
  stopping = true
  for (const child of children) if (child.exitCode == null) child.kill()
}
for (const child of children) {
  child.on('error', error => { console.error(error.message); process.exitCode = 1; stop() })
  child.on('exit', code => { if (!stopping && code !== 0) process.exitCode = code ?? 1; stop() })
}
process.once('SIGINT', stop)
process.once('SIGTERM', stop)
console.log('Isolated monster verification: DM 6973, player 6974. Press Ctrl+C to stop these two services.')
