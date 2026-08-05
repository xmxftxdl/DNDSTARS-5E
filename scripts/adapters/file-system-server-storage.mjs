import { mkdir, readFile, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { atomicWriteLocked } from './file-atomic-store.mjs'
import { assertServerStoragePorts } from '../ports/server-storage.mjs'

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,239}$/

function checkedId(id) {
  const normalized = String(id ?? '').trim()
  if (!IDENTIFIER.test(normalized) || normalized.includes('..')) throw new Error('invalid-storage-id')
  return normalized
}

function createFileJsonRepository(root) {
  const file = (id) => path.join(root, `${checkedId(id)}.json`)
  return {
    async read(id) {
      try {
        return JSON.parse(await readFile(file(id), 'utf8'))
      } catch (error) {
        if (error?.code === 'ENOENT') return undefined
        throw error
      }
    },
    async write(id, value) {
      await mkdir(root, { recursive: true })
      await atomicWriteLocked(file(id), JSON.stringify(value))
    },
    async remove(id) {
      await rm(file(id), { force: true })
    },
    async list() {
      try {
        return (await readdir(root))
          .filter((entry) => entry.endsWith('.json'))
          .map((entry) => entry.slice(0, -5))
          .filter((entry) => IDENTIFIER.test(entry))
          .sort()
      } catch (error) {
        if (error?.code === 'ENOENT') return []
        throw error
      }
    },
  }
}

function createFileBinaryStore(root) {
  const blob = (id) => path.join(root, checkedId(id))
  const meta = (id) => path.join(root, `${checkedId(id)}.json`)
  return {
    async read(id) {
      try {
        const bytes = await readFile(blob(id))
        let metadata
        try { metadata = JSON.parse(await readFile(meta(id), 'utf8')) } catch (error) {
          if (error?.code !== 'ENOENT') throw error
        }
        return { bytes, ...(metadata === undefined ? {} : { metadata }) }
      } catch (error) {
        if (error?.code === 'ENOENT') return undefined
        throw error
      }
    },
    async write(id, bytes, metadata) {
      await mkdir(root, { recursive: true })
      await atomicWriteLocked(blob(id), Buffer.from(bytes))
      if (metadata !== undefined) await atomicWriteLocked(meta(id), JSON.stringify(metadata))
    },
    async remove(id) {
      await Promise.all([rm(blob(id), { force: true }), rm(meta(id), { force: true })])
    },
    async list() {
      try {
        return (await readdir(root))
          .filter((entry) => !entry.endsWith('.json') && !entry.endsWith('.lock') && !entry.endsWith('.tmp'))
          .sort()
      } catch (error) {
        if (error?.code === 'ENOENT') return []
        throw error
      }
    },
  }
}

export function createInMemoryPresenceStore(options = {}) {
  const now = options.now ?? Date.now
  const defaultTtlMs = options.defaultTtlMs ?? 45_000
  const entries = new Map()
  const live = (entry) => entry && entry.expiresAt > now()
  return {
    touch(id, value, ttlMs = defaultTtlMs) {
      entries.set(checkedId(id), { value, expiresAt: now() + Math.max(1, ttlMs) })
    },
    read(id) {
      const key = checkedId(id)
      const entry = entries.get(key)
      if (!live(entry)) {
        entries.delete(key)
        return undefined
      }
      return entry.value
    },
    remove(id) {
      entries.delete(checkedId(id))
    },
    list() {
      const result = []
      for (const [id, entry] of entries) {
        if (!live(entry)) entries.delete(id)
        else result.push({ id, value: entry.value, expiresAt: entry.expiresAt })
      }
      return result
    },
  }
}

function scopedRoot(root, roomId) {
  return roomId === 'default' ? root : path.join(root, 'rooms', checkedId(roomId))
}

export function createFileSystemServerStorage(options) {
  const roots = {
    lobby: path.resolve(options.lobbyRoot),
    campaign: path.resolve(options.campaignRoot),
    state: path.resolve(options.stateRoot),
    asset: path.resolve(options.assetRoot),
    plugin: path.resolve(options.pluginRoot),
    snapshot: path.resolve(options.snapshotRoot),
  }
  const presenceStore = options.presenceStore ?? createInMemoryPresenceStore(options)
  const create = (roomId = 'default') => {
    const ports = {
      roomRepository: createFileJsonRepository(roots.lobby),
      campaignRepository: createFileJsonRepository(roots.campaign),
      sharedStateRepository: createFileJsonRepository(scopedRoot(roots.state, roomId)),
      assetStore: createFileBinaryStore(scopedRoot(roots.asset, roomId)),
      pluginBundleStore: createFileBinaryStore(scopedRoot(roots.plugin, roomId)),
      presenceStore,
      snapshotStore: createFileJsonRepository(scopedRoot(roots.snapshot, roomId)),
      scopeRoom(nextRoomId) { return create(nextRoomId) },
    }
    return assertServerStoragePorts(ports)
  }
  return create()
}
