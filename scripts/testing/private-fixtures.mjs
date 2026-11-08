import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const privateFixtureManifest = JSON.parse(readFileSync(
  new URL('./private-test-inputs.json', import.meta.url), 'utf8',
))

/** Private acceptance archives are deliberately absent from public checkouts. */
export function privateFixtureSelection() {
  const missingInputs = new Set()
  const unavailableSuites = []
  for (const [suite, inputs] of Object.entries(privateFixtureManifest)) {
    const missing = inputs.filter(input => !existsSync(path.resolve(repoRoot, input)))
    if (missing.length) unavailableSuites.push(suite)
    for (const input of missing) missingInputs.add(input)
  }
  return { unavailableSuites, missingInputs: [...missingInputs].sort() }
}
