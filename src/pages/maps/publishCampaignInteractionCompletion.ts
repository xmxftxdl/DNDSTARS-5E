import type { BattleMap } from '../../store/maps'
import { validateSharedCampaignTime, type SharedCampaignTimeState } from '../../lib/campaignTime'
import type { SharedRoomGatewayPort } from '../../ports/sharedRoomGateway'
import type { planDnd5eCampaignInteractionCompletion } from './campaignInteractionCompletion'

type Completion = Extract<ReturnType<typeof planDnd5eCampaignInteractionCompletion>, { ok: true }>
const resources = ['characters', 'maps', 'campaign-time'] as const

/** Publish the entire planned result once. A conflict requires fresh planning, never a blind retry. */
export async function publishDnd5eCampaignInteractionCompletion(input: {
  completion: Completion
  maps: readonly BattleMap[]
  characterSelectedId?: string | null
  mapSelectedId?: string | null
  updatedAt: number
  expectedRevisions: Readonly<Record<typeof resources[number], number>>
  readRevisions: Readonly<Record<'combat' | 'map-geometry', number>>
  gateway: Pick<SharedRoomGatewayPort, 'saveResourcesAtomically'> & {
    loadResource: (name: 'campaign-time') => Promise<SharedCampaignTimeState | null>
  }
}): Promise<{ recovered: boolean }> {
  for (const name of resources) {
    if (!Number.isSafeInteger(input.expectedRevisions[name]) || input.expectedRevisions[name] < 0) {
      throw new Error(`interaction-snapshot-revision-required:${name}`)
    }
  }
  for (const name of ['combat', 'map-geometry'] as const) {
    if (!Number.isSafeInteger(input.readRevisions?.[name]) || input.readRevisions[name] < 0) {
      throw new Error(`interaction-snapshot-revision-required:${name}`)
    }
  }
  const { completion } = input
  const record = completion.clock.interactions?.find(row => row.id === completion.interactionId)
  if (!validateSharedCampaignTime(completion.clock) || record?.status !== 'completed' ||
    record.startedAtWorldMinute !== completion.expectedWorldMinute) throw new Error('invalid-interaction-completion')
  const mapId = completion.application.map.id
  if (input.maps.filter(map => map.id === mapId).length !== 1) throw new Error('interaction-map-snapshot-missing')
  const data = {
    characters: { characters: completion.application.characters, selectedId: input.characterSelectedId ?? null, updatedAt: input.updatedAt },
    maps: { maps: input.maps.map(map => map.id === mapId ? completion.application.map : map), selectedId: input.mapSelectedId ?? null, updatedAt: input.updatedAt },
    'campaign-time': completion.clock,
  }
  const transactionId = `campaign-interaction:${completion.interactionId}`
  try {
    await input.gateway.saveResourcesAtomically(resources.map(name => ({ name, data: data[name], expectedRevision: input.expectedRevisions[name] })), {
      transactionId, undoGroupId: transactionId, undoLabel: '完成持续交互', readRevisions: input.readRevisions,
    })
    return { recovered: false }
  } catch (error) {
    // The clock's exact terminal record is written in the same transaction as
    // both actor collections. It survives subsequent aging/consumption of the
    // reward, so recovery must not reapply that reward or restore old actors.
    if (!/failed to fetch|fetch failed|networkerror|network request failed|load failed|(?:shared-)?state-transaction-(?:conflict|unavailable|502|503|504)/i.test(String(error))) throw error
    try {
      const clock = await input.gateway.loadResource('campaign-time')
      const saved = clock?.interactions?.find(row => row.id === record.id)
      if (clock && validateSharedCampaignTime(clock) && saved &&
        Object.keys(record).every(key => saved[key as keyof typeof saved] === record[key as keyof typeof record]) &&
        Object.keys(saved).length === Object.keys(record).length) return { recovered: true }
    } catch { /* Preserve the original commit error when recovery cannot prove success. */ }
    throw error
  }
}
