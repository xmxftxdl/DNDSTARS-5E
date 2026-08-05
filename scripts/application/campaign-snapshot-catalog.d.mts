import type { JsonRepositoryPort } from '../ports/server-storage.mjs'

export interface CampaignSnapshotSummary {
  id: string
  createdAt: number
  kind: string
  stateCount: number
}

export function readCampaignSnapshot(
  snapshotStore: JsonRepositoryPort | undefined,
  root: string,
  id: string,
): Promise<any | undefined>

export function listCampaignSnapshotSummaries(
  snapshotStore: JsonRepositoryPort | undefined,
  root: string,
): Promise<CampaignSnapshotSummary[]>
