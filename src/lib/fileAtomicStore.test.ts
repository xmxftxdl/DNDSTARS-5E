import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { atomicWriteLocked, safeName } from '../../scripts/adapters/file-atomic-store.mjs'

const roots: string[] = []
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))))

describe('file atomic store adapter', () => {
  it('writes atomically and keeps unsafe logical names distinct', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'astraltrace-atomic-'))
    roots.push(root)
    const file = path.join(root, 'state.json')
    await atomicWriteLocked(file, '{"ok":true}')
    expect(await readFile(file, 'utf8')).toBe('{"ok":true}')
    expect(safeName('a/b')).not.toBe(safeName('ab'))
  })
})
