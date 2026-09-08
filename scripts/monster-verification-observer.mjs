import fs from 'node:fs'
import path from 'node:path'

// Read-only observer for the isolated verification services. It never issues
// game commands: actions must come from the actual DM/player UI.
const base = process.env.STARS_MONSTER_VERIFY_URL ?? 'http://127.0.0.1:6973'
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw new Error('verification observer requires localhost')
const directory = path.resolve(process.env.STARS_MONSTER_INVENTORY_DIR ?? '.codex-temp/monster-verification-20260904')
if (path.relative(process.cwd(), directory).startsWith('..')) throw new Error('output must be inside repository')
fs.mkdirSync(directory, { recursive: true })
const destination = path.join(directory, 'ui-observer.json')
const records = fs.existsSync(destination) ? JSON.parse(fs.readFileSync(destination, 'utf8')) : {}
let stopped = false
process.on('SIGINT', () => { stopped = true })
process.on('SIGTERM', () => { stopped = true })
while (!stopped) {
  try {
    const entries = await Promise.all(['maps', 'characters', 'combat', 'combat-log', 'dice-events'].map(async name => {
      const response = await fetch(`${base}/api/state/${name}`, { signal: AbortSignal.timeout(5_000) })
      if (!response.ok) throw new Error(`${name}: ${response.status}`)
      return [name, await response.json()]
    }))
    const snapshot = Object.fromEntries(entries)
    const mapId = snapshot.combat.mapId
    if (mapId?.startsWith('verify-') && snapshot.maps.selectedId === mapId && snapshot['combat-log'].mapId === mapId) {
      const record = records[mapId] ?? { mapId, firstObservedAt: new Date().toISOString(), logs: {}, dice: {} }
      for (const log of snapshot['combat-log'].entries ?? []) record.logs[log.id] = log
      for (const dice of snapshot['dice-events'].events ?? []) record.dice[dice.id] = dice
      record.lastObservedAt = new Date().toISOString()
      record.snapshot = snapshot
      records[mapId] = record
      fs.writeFileSync(destination, JSON.stringify(records, null, 2))
    }
  } catch (error) {
    console.error(String(error))
  }
  await new Promise(resolve => setTimeout(resolve, 750))
}
