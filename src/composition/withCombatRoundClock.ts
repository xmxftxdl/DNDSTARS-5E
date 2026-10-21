import type { SharedRoomGatewayPort, SharedResourceTransactionWrite, SharedResourceWriteOptions } from '../ports/sharedRoomGateway'
import { advanceCampaignTimeSnapshot, type SharedCampaignTimeState } from '../lib/campaignTime'
import { planCombatRoundClock, type CombatRoundClockCursor, type CombatRoundClockState } from '../lib/combatRoundClock'
import { characterCombatClockKey, tokenCombatClockKey } from '../../shared/combat-round-credits.mjs'

type Versioned = { _sync?: { revision?: number } }
type Combat = CombatRoundClockState & Versioned & {
  mapId?: string
  initiativeOrder?: readonly { tokenId: string }[]
  campaignRoundClock?: CombatRoundClockCursor
}
type Maps = Versioned & { maps: readonly { id: string; tokens: readonly { id: string; characterId?: string }[] }[] }
type Options = SharedResourceWriteOptions & { transactionId?: string }

/** All browser combat publications, including atomic action ACKs, share this boundary. */
export function withCombatRoundClock(gateway: SharedRoomGatewayPort): SharedRoomGatewayPort {
  const performCommit = async (writes: readonly SharedResourceTransactionWrite[], options?: Options) => {
    const combatWrite = writes.find(write => write.name === 'combat')
    const after = combatWrite?.data as Combat | undefined
    if (!after || typeof after !== 'object') return gateway.saveResourcesAtomically(writes, options)
    const [before, storedClock, storedMaps] = await Promise.all([
      gateway.loadResource<Combat>('combat'),
      gateway.loadResource<SharedCampaignTimeState & Versioned>('campaign-time'),
      gateway.loadResource<Maps>('maps'),
    ])
    if (!storedClock) return gateway.saveResourcesAtomically(writes, options)
    const mapsWrite = writes.find(write => write.name === 'maps')
    const maps = (mapsWrite?.data as Maps | undefined) ?? storedMaps
    const map = maps?.maps.find(candidate => candidate.id === before?.mapId)
    const participantIds = new Set(before?.initiativeOrder?.map(entry => entry.tokenId) ?? [])
    const roundParticipantKeys = map?.tokens.flatMap(token => participantIds.has(token.id)
      ? [tokenCombatClockKey(map.id, token.id), ...(token.characterId ? [characterCombatClockKey(token.characterId)] : [])]
      : []) ?? []
    const plan = !after.combatId && after.active !== true
      ? before?.campaignRoundClock ? { cursor: before.campaignRoundClock, elapsedMinutes: 0, combatRoundCredits: undefined } : undefined
      : planCombatRoundClock({ before: before ?? undefined, after,
        cursor: before?.campaignRoundClock, roundParticipantKeys })
    if (!plan && !after.combatId && after.active !== true) return gateway.saveResourcesAtomically(writes, options)
    if (!plan) throw new Error('invalid-combat-round-clock')
    const revision = (snapshot: Versioned | null) => snapshot?._sync?.revision ?? 0
    const combatRevision = combatWrite!.expectedRevision ?? revision(before)
    const clockWrite = writes.find(write => write.name === 'campaign-time')
    const clock = (clockWrite?.data as SharedCampaignTimeState | undefined) ?? storedClock
    const nextWrites = writes.map(write => write === combatWrite
      ? { ...write, expectedRevision: combatRevision, data: { ...after, campaignRoundClock: plan.cursor } }
      : write)
    const readRevisions = { ...options?.readRevisions }
    if (!mapsWrite) readRevisions.maps ??= revision(storedMaps)
    if (plan.elapsedMinutes > 0) {
      const nextClock = advanceCampaignTimeSnapshot({ state: clock, minutes: plan.elapsedMinutes,
        reason: '战斗轮次推进', now: Date.now(), advanceId: `combat-minute:${crypto.randomUUID()}` })
      if (!nextClock) throw new Error('invalid-combat-clock-advance')
      nextClock.advances[nextClock.advances.length - 1].combatRoundCredits = plan.combatRoundCredits
      const nextWrite = { name: 'campaign-time', data: nextClock,
        expectedRevision: clockWrite?.expectedRevision ?? revision(storedClock) }
      if (clockWrite) nextWrites[nextWrites.indexOf(clockWrite)] = nextWrite
      else nextWrites.push(nextWrite)
    } else if (!clockWrite) readRevisions['campaign-time'] ??= revision(storedClock)
    return gateway.saveResourcesAtomically(nextWrites, { ...options, readRevisions })
  }
  // Planning reads belong to the same queue as their commit. Otherwise two
  // publications can both freeze the same combat revision before HTTP queuing.
  let pending: Promise<unknown> = Promise.resolve()
  const commit = (writes: readonly SharedResourceTransactionWrite[], options?: Options) => {
    if (!writes.some(write => write.name === 'combat')) return gateway.saveResourcesAtomically(writes, options)
    const next = pending.catch(() => undefined).then(() => performCommit(writes, options))
    pending = next
    return next
  }
  return {
    ...gateway,
    saveResourcesAtomically: commit,
    saveResource: async (name, data, options) => {
      if (name !== 'combat') return gateway.saveResource(name, data, options)
      await commit([{ name, data }], options)
    },
    saveResourceWithResult: async (name, data, options) => {
      if (name !== 'combat') return gateway.saveResourceWithResult(name, data, options)
      const result = await commit([{ name, data }], options)
      return { status: 'saved', revision: result.revisions.combat }
    },
  }
}
