import { expect, it } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { mergeMapsDeletionHistory, normalizeDeletedMapIds } from '../../shared/map-deletion-history.mjs'
import { atomicWriteJsonStateCasLocked } from '../../scripts/shared-server-core.mjs'
import { migrateMapsState, saveMapsStateWithPendingHitPointRetry, saveMapsStateWithTokenPatchRetry } from '../store/maps'
import { validateAndMigrateSharedResource } from './sharedResourceValidation'

it('normalizes persisted deletion evidence without inferring missing maps', () => {
  expect(normalizeDeletedMapIds(['b', 'a', 'b', '', ' ', 4, null])).toEqual(['a', 'b'])
  expect(migrateMapsState({ maps: [], deletedMapIds: ['old', 'old', 3] }).deletedMapIds).toEqual(['old'])
  expect(migrateMapsState({ maps: [] }).deletedMapIds).toBeUndefined()
  expect(validateAndMigrateSharedResource('maps', { maps: [], deletedMapIds: ['old'] }).status).toBe('valid')
  expect(validateAndMigrateSharedResource('maps', { maps: [], deletedMapIds: [3] }).status).toBe('invalid')
})

it('derives evidence only from committed deletions and preserves it through older client writes', () => {
  expect(mergeMapsDeletionHistory({ maps: [{ id: 'a' }, { id: 'b' }] }, { maps: [{ id: 'b' }], deletedMapIds: ['invented'] }))
    .toEqual({ maps: [{ id: 'b' }], deletedMapIds: ['a'] })
  expect(mergeMapsDeletionHistory({ maps: [], deletedMapIds: ['a'] }, { maps: [], selectedId: null }))
    .toEqual({ maps: [], selectedId: null, deletedMapIds: ['a'] })
  expect(mergeMapsDeletionHistory(null, { maps: [], deletedMapIds: ['invented'] })).toEqual({ maps: [] })
})

it('preserves authoritative history through both HP and token-patch conflict retries', async () => {
  const map = migrateMapsState({ maps: [{ id: 'm', tokens: [{ id: 't', type: 'npc', x: 25, y: 25 }] }] }).maps[0]
  const load = async () => ({ maps: [map], selectedId: 'm', deletedMapIds: ['gone'], updatedAt: 2 })
  const saveFactory = () => {
    let attempt = 0
    return async () => ++attempt === 1 ? { status: 'conflict' as const, expectedRevision: 1, currentRevision: 2 } : { status: 'saved' as const, revision: 3 }
  }
  const payload = { maps: [map], selectedId: 'm', updatedAt: 1 }
  const hp = await saveMapsStateWithPendingHitPointRetry({ payload, retryPendingHitPoints: true, load, save: saveFactory() })
  expect(hp.payload.deletedMapIds).toEqual(['gone'])
  const patch = await saveMapsStateWithTokenPatchRetry({ payload, mapId: 'm', tokenId: 't', patch: { hp: 3 }, load, save: saveFactory() })
  expect(patch.payload.deletedMapIds).toEqual(['gone'])
})

it('persists server-derived deletion evidence across CAS writes and rejects stale replacements', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'stars-map-deletion-'))
  const file = path.join(dir, 'maps.json')
  try {
    expect(await atomicWriteJsonStateCasLocked(file, { maps: [{ id: 'source' }], deletedMapIds: ['forged'] }, { expectedRevision: 0 }))
      .toMatchObject({ ok: true })
    expect(JSON.parse(await readFile(file, 'utf8')).deletedMapIds).toBeUndefined()
    await atomicWriteJsonStateCasLocked(file, { maps: [] }, { expectedRevision: 1 })
    await atomicWriteJsonStateCasLocked(file, { maps: [{ id: 'remote' }] }, { expectedRevision: 2 })
    expect(JSON.parse(await readFile(file, 'utf8')).deletedMapIds).toEqual(['source'])
    expect(await atomicWriteJsonStateCasLocked(file, { maps: [] }, { expectedRevision: 1 })).toMatchObject({ conflict: true })
    expect(JSON.parse(await readFile(file, 'utf8')).deletedMapIds).toEqual(['source'])
  } finally {
    if (!path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(dir).startsWith('stars-map-deletion-')) throw Error('unexpected test directory')
    await rm(dir, { recursive: true, force: true })
  }
})
