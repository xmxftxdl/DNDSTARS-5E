import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cp, mkdtemp, rm, symlink, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

test('server imports with the Docker runtime files and no frontend source', { timeout: 60_000 }, async () => {
  const runtimeRoot = await mkdtemp(path.join(os.tmpdir(), 'astraltrace-runtime-boundary-'))
  try {
    // Match the runtime stage: server modules and shared rules, without src or build tools.
    await cp(path.join(repoRoot, 'scripts'), path.join(runtimeRoot, 'scripts'), { recursive: true })
    await cp(path.join(repoRoot, 'shared'), path.join(runtimeRoot, 'shared'), { recursive: true })
    const dependencies = require.resolve.paths('pg')?.find(directory =>
      existsSync(path.join(directory, 'pg', 'package.json')))
    assert.ok(dependencies, 'Install the server dependencies before checking the runtime boundary')
    await symlink(dependencies, path.join(runtimeRoot, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
    assert.equal(existsSync(path.join(runtimeRoot, 'src')), false)
    const result = spawnSync(process.execPath, [
      '--input-type=module', '-e', "await import('./scripts/shared-server-core.mjs')",
    ], { cwd: runtimeRoot, encoding: 'utf8', timeout: 45_000 })
    assert.ifError(result.error)
    assert.equal(result.status, 0, `Runtime import failed:\n${result.stderr}\n${result.stdout}`)
  } finally {
    assert.equal(path.dirname(runtimeRoot), path.resolve(os.tmpdir()))
    assert.ok(path.basename(runtimeRoot).startsWith('astraltrace-runtime-boundary-'))
    // Remove the dependency link explicitly; cleanup never traverses its target.
    if (existsSync(path.join(runtimeRoot, 'node_modules'))) await unlink(path.join(runtimeRoot, 'node_modules'))
    await rm(runtimeRoot, { recursive: true, force: true })
  }
})
