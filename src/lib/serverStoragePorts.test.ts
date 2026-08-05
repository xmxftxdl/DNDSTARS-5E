import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  createFileSystemServerStorage,
  createInMemoryPresenceStore,
} from '../../scripts/adapters/file-system-server-storage.mjs'

const roots: string[] = []
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))))

describe('server storage ports', () => {
  it('isolates room state and snapshots while sharing room metadata', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'astraltrace-storage-'))
    roots.push(root)
    const storage = createFileSystemServerStorage({
      lobbyRoot: path.join(root, 'lobby'),
      campaignRoot: path.join(root, 'campaigns'),
      stateRoot: path.join(root, 'state'),
      assetRoot: path.join(root, 'assets'),
      pluginRoot: path.join(root, 'plugins'),
      snapshotRoot: path.join(root, 'snapshots'),
    })
    await storage.roomRepository.write('ROOM1', { title: 'Shared room' })
    await storage.scopeRoom('ROOM1').sharedStateRepository.write('combat', { round: 1 })
    await storage.scopeRoom('ROOM2').sharedStateRepository.write('combat', { round: 2 })
    await storage.scopeRoom('ROOM1').snapshotStore.write('one', { revision: 1 })

    expect(await storage.scopeRoom('ROOM1').sharedStateRepository.read('combat')).toEqual({ round: 1 })
    expect(await storage.scopeRoom('ROOM2').sharedStateRepository.read('combat')).toEqual({ round: 2 })
    expect(await storage.scopeRoom('ROOM2').snapshotStore.list()).toEqual([])
    expect(await storage.scopeRoom('ROOM2').roomRepository.read('ROOM1')).toEqual({ title: 'Shared room' })
  })

  it('expires presence without writing durable state', () => {
    let now = 100
    const presence = createInMemoryPresenceStore({ now: () => now, defaultTtlMs: 10 })
    presence.touch('member-1', { online: true })
    expect(presence.read('member-1')).toEqual({ online: true })
    now = 111
    expect(presence.read('member-1')).toBeUndefined()
    expect(presence.list()).toEqual([])
  })

  it('rejects traversal identifiers', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'astraltrace-storage-'))
    roots.push(root)
    const storage = createFileSystemServerStorage({
      lobbyRoot: root, campaignRoot: root, stateRoot: root,
      assetRoot: root, pluginRoot: root, snapshotRoot: root,
    })
    await expect(storage.sharedStateRepository.write('../escape', {})).rejects.toThrow('invalid-storage-id')
  })
})
