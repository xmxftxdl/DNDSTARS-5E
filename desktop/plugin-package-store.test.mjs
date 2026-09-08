import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createDesktopPluginPackageStore } from './plugin-package-store.mjs'

function integrity(bytes) {
  return `sha256-${createHash('sha256').update(bytes).digest('base64')}`
}

test('desktop plugin store persists verified packages outside renderer storage', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'astraltrace-plugin-store-'))
  try {
    const store = createDesktopPluginPackageStore(root)
    const bytes = Buffer.from('{"manifest":{"id":"test.rules"}}')
    await store.put({
      pluginId: 'test.rules',
      version: '1.0.0',
      fileName: 'test-rules.json',
      integrity: integrity(bytes),
      bytes,
    })
    const loaded = await store.get('test.rules')
    assert.equal(loaded?.version, '1.0.0')
    assert.deepEqual(loaded?.bytes, bytes)
    const secondBytes = Buffer.from('{"manifest":{"id":"test.rules","version":"2"}}')
    await store.put({
      pluginId: 'test.rules',
      version: '2.0.0',
      fileName: 'test-rules-v2.json',
      integrity: integrity(secondBytes),
      bytes: secondBytes,
    })
    assert.deepEqual((await store.get('test.rules', integrity(bytes)))?.bytes, bytes)
    assert.equal((await store.list()).length, 1)
    await store.remove('test.rules')
    assert.equal(await store.get('test.rules'), null)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('desktop plugin store quarantines a package whose content no longer matches the pinned integrity', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'astraltrace-plugin-quarantine-'))
  try {
    const store = createDesktopPluginPackageStore(root)
    const bytes = Buffer.from('verified plugin')
    const entry = await store.put({
      pluginId: 'test.quarantine',
      version: '1.0.0',
      fileName: 'plugin.bin',
      integrity: integrity(bytes),
      bytes,
    })
    await writeFile(path.join(root, 'packages', `${entry.hash}.astralplugin`), 'tampered')
    await assert.rejects(store.get('test.quarantine'), /desktop-plugin-package-corrupted/)
    const index = JSON.parse(await readFile(path.join(root, 'index.json'), 'utf8'))
    assert.equal(index.active['test.quarantine'], undefined)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
