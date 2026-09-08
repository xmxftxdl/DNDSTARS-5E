import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { strToU8, zipSync } from 'fflate'
import {
  compareVersions,
  installClientBundle,
  parseClientReleaseManifest,
  readActiveClientVersion,
  safeArchiveEntryPath,
} from './client-update.mjs'

test('desktop version comparison handles stable and beta releases', () => {
  assert.equal(compareVersions('1.2.0', '1.1.9'), 1)
  assert.equal(compareVersions('1.2.0-beta.2', '1.2.0-beta.1'), 1)
  assert.equal(compareVersions('1.2.0-beta.2', '1.2.0'), -1)
  assert.equal(compareVersions('1.2.0', '1.2.0'), 0)
})

test('desktop manifest parser only accepts the selected Windows channel and secure package URL', () => {
  const base = {
    schemaVersion: 1,
    service: 'astraltrace-desktop-client',
    channel: 'beta',
    platform: 'win32',
    arch: 'x64',
    version: '0.1.0-beta.1',
    protocolVersion: 5,
    minimumShellVersion: '0.1.0-beta.1',
    package: { url: 'https://downloads.example/client.zip', sha256: 'a'.repeat(64) },
  }
  assert.equal(parseClientReleaseManifest(base, { channel: 'stable' }), null)
  assert.equal(parseClientReleaseManifest({ ...base, package: { ...base.package, url: 'http://downloads.example/client.zip' } }, { channel: 'beta' }), null)
  assert.equal(parseClientReleaseManifest(base, { channel: 'beta' })?.version, base.version)
})

test('archive paths cannot escape the version directory', () => {
  assert.equal(safeArchiveEntryPath('assets/main.js'), 'assets/main.js')
  assert.equal(safeArchiveEntryPath('../outside.txt'), null)
  assert.equal(safeArchiveEntryPath('C:\\outside.txt'), null)
  assert.equal(safeArchiveEntryPath('/outside.txt'), null)
})

test('client bundle activation verifies integrity and writes an atomic current pointer', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'astraltrace-desktop-client-'))
  try {
    const archive = Buffer.from(zipSync({
      'index.html': strToU8('<main>Astral Trace</main>'),
      'assets/main.js': strToU8('globalThis.astralTrace = true'),
    }))
    const manifest = {
      version: '0.1.0-beta.1',
      package: {
        url: 'https://downloads.example/client.zip',
        sha256: createHash('sha256').update(archive).digest('hex'),
      },
    }
    const installed = await installClientBundle({ archiveBytes: archive, manifest, clientRoot: root })
    assert.equal(installed.version, manifest.version)
    assert.equal(await readFile(path.join(installed.root, 'index.html'), 'utf8'), '<main>Astral Trace</main>')
    assert.equal((await readActiveClientVersion(root))?.version, manifest.version)
    await stat(path.join(root, 'current.json'))
    const nextManifest = { ...manifest, version: '0.1.0-beta.2' }
    await installClientBundle({ archiveBytes: archive, manifest: nextManifest, clientRoot: root })
    assert.equal((await readActiveClientVersion(root))?.version, nextManifest.version)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
