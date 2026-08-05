import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { listCampaignSnapshotSummaries } from '../../scripts/application/campaign-snapshot-catalog.mjs'

const roots: string[] = []
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))))

describe('campaign snapshot catalog', () => {
  it('sorts valid snapshots and isolates damaged files', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'snapshot-catalog-'))
    roots.push(root)
    await writeFile(path.join(root, 'old.json'), JSON.stringify({ exportedAt: 1, states: { maps: {} } }))
    await writeFile(path.join(root, 'new.json'), JSON.stringify({ snapshotId: 'new-id', exportedAt: 2, snapshotKind: 'auto', states: {} }))
    await writeFile(path.join(root, 'broken.json'), '{')
    await expect(listCampaignSnapshotSummaries(undefined, root)).resolves.toEqual([
      { id: 'new-id', createdAt: 2, kind: 'auto', stateCount: 0 },
      { id: 'old', createdAt: 1, kind: 'manual', stateCount: 1 },
    ])
  })
})
