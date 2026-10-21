import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import type { SharedCombatState } from '../../lib/sharedCombatTypes'
import { normalizeSharedCampaignTime, validateSharedCampaignTime, type SharedCampaignTimeState } from '../../lib/campaignTime'
import { normalizeSharedMapGeometry, type SharedMapGeometryState } from '../../lib/mapGeometry'
import { createDnd5eMapCombatSnapshot } from '../../rulesets/dnd5e/mapBridge'
import { prepareDnd5eCampaignInteractionStart } from '../../rulesets/dnd5e/campaignInteractionAuthority'
import { planDnd5eCampaignInteractionCompletion } from './campaignInteractionCompletion'
import { publishDnd5eCampaignInteractionCompletion } from './publishCampaignInteractionCompletion'
import * as shared from '../../composition/browserSharedRoomResources'
import { appRoomAuthorityScheduler } from '../../lib/roomAuthorityScheduler'
import { getRoomSession } from '../../lib/roomSession'
import { useCampaignTimeStore } from '../../store/campaignTime'

type Revisioned<T> = T & { _sync?: { revision?: number } }
type Actors = { characters: Character[]; selectedId?: string | null }
type Maps = { maps: BattleMap[]; selectedId?: string | null }

/** Read each revision from its own returned snapshot, never a mutable global watermark. */
export async function readCampaignInteractionContext(mapId: string, read = shared.loadSharedResource) {
  const values = await Promise.all([
    read<Revisioned<Actors>>('characters'), read<Revisioned<Maps>>('maps'),
    read<Revisioned<SharedCampaignTimeState>>('campaign-time'),
    read<Revisioned<SharedCombatState>>('combat'), read<Revisioned<SharedMapGeometryState>>('map-geometry'),
  ])
  const names = ['characters', 'maps', 'campaign-time', 'combat', 'map-geometry'] as const
  const revisions: Record<string, number> = {}
  values.forEach((value, index) => {
    const revision = value == null ? 0 : value._sync?.revision
    if (!Number.isSafeInteger(revision) || revision! < 0) throw Error(`interaction-snapshot-revision-required:${names[index]}`)
    revisions[names[index]] = revision!
  })
  const [actors, maps, rawClock, combat, rawGeometry] = values
  if (!actors || !maps || !rawClock || !validateSharedCampaignTime(rawClock)) throw Error('interaction-snapshot-unavailable')
  const map = maps.maps.find(row => row.id === mapId)
  if (!map) throw Error('interaction-map-participant-missing')
  const normalizedGeometry = rawGeometry ? normalizeSharedMapGeometry(rawGeometry) : undefined
  if (rawGeometry && !normalizedGeometry) throw Error('interaction-geometry-invalid')
  const geometry = normalizedGeometry?.maps.find(row => row.mapId === mapId) ?? null
  const snapshot = createDnd5eMapCombatSnapshot({ combatId: `interaction:${mapId}`, map, geometry, characters: actors.characters,
    initiativeOrder: map.tokens.filter(token => ['player', 'enemy', 'npc'].includes(token.type)).map(token => ({ tokenId: token.id, label: token.label, emoji: token.emoji, color: token.color, roll: 0 })) })
  snapshot.state.active = combat?.active === true
  return { ...snapshot, map, maps: maps.maps, characters: actors.characters, geometry, clock: normalizeSharedCampaignTime(rawClock), rawCombat: combat,
    characterSelectedId: actors.selectedId, mapSelectedId: maps.selectedId,
    expectedRevisions: { characters: revisions.characters, maps: revisions.maps, 'campaign-time': revisions['campaign-time'] },
    readRevisions: { combat: revisions.combat, 'map-geometry': revisions['map-geometry'] } }
}

function hostRoomGuard() {
  const session = getRoomSession()
  if (session && session.role !== 'dm') throw Error('interaction-host-required')
  const roomId = session?.roomId
  return () => {
    const current = getRoomSession()
    if (current?.roomId !== roomId || (current && current.role !== 'dm')) throw Error('interaction-room-changed')
  }
}

export async function loadCampaignInteractionChoices(mapId: string) {
  const guard = hostRoomGuard(), context = await readCampaignInteractionContext(mapId)
  guard()
  const choices = Object.values(context.state.combatants).flatMap(bearer => (bearer.classState.activeEffects ?? []).flatMap(effect => {
    if (!effect.completionGrant) return []
    const record = context.clock.interactions?.find(row => row.bearerId === bearer.id && row.effectId === effect.id && row.packageId === effect.source.pluginId)
    if (record && record.status !== 'active') return []
    const prepared = prepareDnd5eCampaignInteractionStart({ state: context.state, bearerId: bearer.id, effectId: effect.id, interactionId: record?.id ?? 'preview', worldMinute: context.clock.worldMinute })
    return [{ bearerId: bearer.id, effectId: effect.id, label: effect.label, bearer: bearer.name,
      source: context.state.combatants[effect.source.actorId ?? '']?.name ?? '', minutes: effect.duration.type === 'rounds' ? Math.ceil(effect.duration.remainingRounds / 10) : 0,
      interactionId: record?.id, issue: prepared.ok ? undefined : prepared.reason }]
  }))
  for (const record of context.clock.interactions ?? []) {
    if (record.status !== 'active' || choices.some(choice => choice.interactionId === record.id)) continue
    if (!context.map.tokens.some(token => token.id === record.bearerId || token.id === record.sourceId)) continue
    choices.push({ bearerId: record.bearerId, effectId: record.effectId, label: '持续交互',
      bearer: context.map.tokens.find(token => token.id === record.bearerId)?.label ?? '目标已离开',
      source: context.map.tokens.find(token => token.id === record.sourceId)?.label ?? '来源已离开',
      minutes: Math.ceil(record.requiredRounds / 10), interactionId: record.id, issue: 'interaction-effect-unavailable' })
  }
  return choices
}

export function runCampaignInteraction(input: { mapId: string; bearerId: string; effectId: string; interactionId?: string;
  action: 'start' | 'interrupt' | 'complete'; continuityConfirmed?: boolean }) {
  const guard = hostRoomGuard()
  return appRoomAuthorityScheduler.run(`interaction-ui:${input.mapId}:${input.bearerId}:${input.effectId}`, async () => {
    guard()
    const context = await readCampaignInteractionContext(input.mapId)
    guard()
    if (input.action === 'start') {
      const prepared = prepareDnd5eCampaignInteractionStart({ ...context, bearerId: input.bearerId, effectId: input.effectId,
        interactionId: crypto.randomUUID(), worldMinute: context.clock.worldMinute })
      if (!prepared.ok) throw Error(prepared.reason)
      await shared.mutateSharedRoomResource('campaign-time', '/state/campaign-time/mutation', prepared.mutation)
    } else {
      const record = context.clock.interactions?.find(row => row.id === input.interactionId)
      if (!record || record.bearerId !== input.bearerId || record.effectId !== input.effectId) throw Error('interaction-not-active')
      if (input.action === 'interrupt') {
        await shared.mutateSharedRoomResource('campaign-time', '/state/campaign-time/mutation', {
          operation: 'interrupt-interaction', id: record.id, expectedWorldMinute: context.clock.worldMinute,
        })
      } else {
        const completion = planDnd5eCampaignInteractionCompletion({ ...context, interactionId: record.id,
          continuityConfirmed: input.continuityConfirmed === true, now: Date.now() })
        if (!completion.ok) throw Error(completion.reason)
        await publishDnd5eCampaignInteractionCompletion({ ...context, completion, updatedAt: Date.now(), gateway: {
          saveResourcesAtomically: shared.saveSharedResourcesAtomically,
          loadResource: name => shared.loadSharedResource<SharedCampaignTimeState>(name),
        } })
      }
    }
    guard()
    await useCampaignTimeStore.getState().loadShared()
  })
}
