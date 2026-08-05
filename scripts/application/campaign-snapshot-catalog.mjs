import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

async function snapshotIds(snapshotStore, root) {
  if (snapshotStore) return snapshotStore.list()
  try {
    return (await readdir(root))
      .filter((entry) => entry.endsWith('.json'))
      .map((entry) => entry.slice(0, -5))
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
}

export async function readCampaignSnapshot(snapshotStore, root, id) {
  if (snapshotStore) return snapshotStore.read(id)
  try {
    return JSON.parse(await readFile(path.join(root, `${id}.json`), 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined
    throw error
  }
}

export async function listCampaignSnapshotSummaries(snapshotStore, root) {
  const snapshots = []
  for (const id of await snapshotIds(snapshotStore, root)) {
    try {
      const bundle = await readCampaignSnapshot(snapshotStore, root, id)
      if (!bundle) continue
      snapshots.push({
        id: bundle.snapshotId ?? id,
        createdAt: bundle.exportedAt,
        kind: bundle.snapshotKind ?? 'manual',
        stateCount: Object.keys(bundle.states ?? {}).length,
      })
    } catch {
      // One broken recovery point must not hide healthy snapshots.
    }
  }
  return snapshots.sort((left, right) => right.createdAt - left.createdAt)
}
