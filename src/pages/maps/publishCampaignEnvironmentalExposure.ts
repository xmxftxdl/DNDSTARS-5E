import type { BattleMap } from '../../store/maps'
import { validateSharedCampaignTime, type SharedCampaignTimeState } from '../../lib/campaignTime'
import type { SharedRoomGatewayPort } from '../../ports/sharedRoomGateway'
import type { planDnd5eCampaignEnvironmentalExposure } from './campaignEnvironmentalExposure'

type Completion = Extract<ReturnType<typeof planDnd5eCampaignEnvironmentalExposure>, { ok: true }>
const resources = ['characters', 'maps', 'campaign-time'] as const

/** A lost response can be recovered from the same transaction's durable receipt.
 * Never replay the exhaustion result against a newer actor snapshot. */
export async function publishCampaignEnvironmentalExposure(input: {
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
  for (const [name, revision] of [
    ...resources.map(name => [name, input.expectedRevisions[name]] as const),
    ...(['combat', 'map-geometry'] as const).map(name => [name, input.readRevisions[name]] as const),
  ]) if (!Number.isSafeInteger(revision) || revision < 0) throw Error(`exposure-snapshot-revision-required:${name}`)
  const { completion } = input
  const sameReceipt = (row: typeof completion.receipt | undefined) => !!row &&
    Object.keys(completion.receipt).every(key => row[key as keyof typeof row] === completion.receipt[key as keyof typeof row]) &&
    Object.keys(row).length === Object.keys(completion.receipt).length
  if (!validateSharedCampaignTime(completion.clock) || !sameReceipt(completion.clock.environmentalExposures?.find(row => row.id === completion.receipt.id))) throw Error('invalid-exposure-completion')
  const mapId = completion.application.map.id
  if (input.maps.filter(map => map.id === mapId).length !== 1) throw Error('exposure-map-snapshot-missing')
  const data = {
    characters: { characters: completion.application.characters, selectedId: input.characterSelectedId ?? null, updatedAt: input.updatedAt },
    maps: { maps: input.maps.map(map => map.id === mapId ? completion.application.map : map), selectedId: input.mapSelectedId ?? null, updatedAt: input.updatedAt },
    'campaign-time': completion.clock,
  }
  const transactionId = `environmental-exposure:${completion.receipt.id}`
  const writes = resources.map(name => ({ name: name as string, data: data[name] as unknown, expectedRevision: input.expectedRevisions[name] }))
  if (completion.combat) writes.push({ name: 'combat', data: completion.combat, expectedRevision: input.readRevisions.combat })
  const readRevisions = completion.combat ? { 'map-geometry': input.readRevisions['map-geometry'] } : input.readRevisions
  try {
    await input.gateway.saveResourcesAtomically(writes, {
      transactionId, undoGroupId: transactionId, undoLabel: '结算气候暴露', readRevisions,
    })
    return { recovered: false }
  } catch (error) {
    if (!/failed to fetch|fetch failed|networkerror|network request failed|load failed|(?:shared-)?state-transaction-(?:conflict|unavailable|502|503|504)/i.test(String(error))) throw error
    try {
      const clock = await input.gateway.loadResource('campaign-time')
      if (clock && validateSharedCampaignTime(clock) && sameReceipt(clock.environmentalExposures?.find(row => row.id === completion.receipt.id))) return { recovered: true }
    } catch { /* Keep the original publication failure. */ }
    throw error
  }
}
