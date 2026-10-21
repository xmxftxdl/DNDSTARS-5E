import type { Character } from '../../types/character'
import type { BattleMap } from '../../store/maps'
import { effectiveDnd5eActiveEffects } from './activeEffects'
import { normalizeDnd5eAwakeningEvents } from './awakeningEvents'
import { getRegisteredDnd5eActivity, listRegisteredDnd5eActivityPackages } from './activities/dnd5eActivityRegistry'
import { settleDnd5eAwakeningActivity } from './activities/dnd5eAwakeningActivitySettlement'
import { createDnd5eMapCombatSnapshot, prepareDnd5eExplorationActor, planDnd5eMapResultApplication } from './mapBridge'
import type { Dnd5eFormulaRollResult } from './activities/dnd5eFormula'

type Room = { maps: readonly BattleMap[]; characters: readonly Character[] }
export interface Dnd5ePendingAwakening {
  characterId: string; eventId: string; grantEffectId: string; packageId: string; packageVersion: string; activityId: string
}

/** Only grants present when waking occurred can dispatch an automatic Activity. */
export function pendingDnd5eAwakeningActivities(room: Room): Dnd5ePendingAwakening[] {
  const pending: Dnd5ePendingAwakening[] = []
  for (const character of room.characters) {
    for (const event of normalizeDnd5eAwakeningEvents(character.dnd5eAwakeningEvents, character.id) ?? []) {
      if (character.dnd5eWorldTimeAppliedMinute == null || event.worldMinute > character.dnd5eWorldTimeAppliedMinute) continue
      for (const grant of effectiveDnd5eActiveEffects(character.dnd5eCombatState?.activeEffects)) {
        if (!grant.source.pluginId || !event.eligibleGrantEffectIds?.includes(grant.id) || event.consumedGrantEffectIds?.includes(grant.id)) continue
        const packageVersion = listRegisteredDnd5eActivityPackages().find(pkg => pkg.packageId === grant.source.pluginId)?.packageVersion
        if (!packageVersion) continue
        for (const activityId of grant.grantedActivities ?? []) {
          const activity = getRegisteredDnd5eActivity(grant.source.pluginId, activityId)
          if (activity?.requiresEffectGrant && activity.activation.kind === 'free' && activity.target.kind === 'self' &&
            activity.invocation?.kind === 'triggered' && activity.invocation.event === 'creature-awakened' && activity.invocation.confirmation === 'automatic') {
            pending.push({ characterId: character.id, eventId: event.id, grantEffectId: grant.id, packageId: grant.source.pluginId, packageVersion, activityId })
          }
        }
      }
    }
  }
  return pending
}

/** Compute one atomic room publication. The dispatcher must CAS the read revisions. */
export function settleDnd5eRoomAwakening(input: {
  room: Room; pending: Dnd5ePendingAwakening; combatRevision: number
  authoritativeRolls: Readonly<Record<string, Dnd5eFormulaRollResult>>
}) {
  const reject = (reason: string) => ({ ok: false as const, reason })
  if (!pendingDnd5eAwakeningActivities(input.room).some(value =>
    value.characterId === input.pending.characterId && value.eventId === input.pending.eventId &&
    value.grantEffectId === input.pending.grantEffectId && value.packageId === input.pending.packageId &&
    value.packageVersion === input.pending.packageVersion && value.activityId === input.pending.activityId)) return reject('awakening-request-stale')
  const owners = input.room.characters.filter(character => character.id === input.pending.characterId)
  const locations = input.room.maps.flatMap(map => map.tokens.filter(token => token.characterId === input.pending.characterId && token.type !== 'obstacle').map(token => ({ map, token })))
  if (owners.length !== 1 || locations.length !== 1) return reject('awakening-owner-ambiguous')
  const owner = owners[0], { map, token } = locations[0]
  const snapshot = createDnd5eMapCombatSnapshot({ combatId: `awakening:${owner.id}`, round: 1, map,
    characters: input.room.characters, initiativeOrder: [], additionalCreatureTokenIds: [token.id] })
  prepareDnd5eExplorationActor(snapshot.state, token.id)
  const settled = settleDnd5eAwakeningActivity({ state: snapshot.state, actorCharacter: owner,
    combatRevision: input.combatRevision, worldMinute: owner.dnd5eWorldTimeAppliedMinute!, awakeningEventId: input.pending.eventId,
    authoritativeRolls: input.authoritativeRolls, confirmedBy: 'system',
    command: { schemaVersion: 1, commandId: `wake:${input.combatRevision}:${pendingDnd5eAwakeningActivities(input.room).findIndex(value => value.characterId === owner.id && value.eventId === input.pending.eventId && value.grantEffectId === input.pending.grantEffectId && value.activityId === input.pending.activityId)}`, actorId: token.id,
      packageId: input.pending.packageId, packageVersion: input.pending.packageVersion, activityId: input.pending.activityId,
      grantEffectId: input.pending.grantEffectId, targetIds: [token.id], expectedRevision: input.combatRevision } })
  if (!settled.ok) return settled
  const plan = planDnd5eMapResultApplication({ state: structuredClone(settled.resolution.result.state), map,
    characters: input.room.characters, characterIdByCombatantId: snapshot.characterIdByCombatantId, events: [...settled.resolution.result.events] })
  const characterPatches = { ...plan.characterPatches, [owner.id]: { ...plan.characterPatches?.[owner.id], ...settled.receiptPatch } }
  return { ok: true as const, resolution: settled.resolution, publication: {
    characters: input.room.characters.map(character => characterPatches[character.id] ? { ...character, ...characterPatches[character.id] } : character),
    maps: input.room.maps.map(original => original.id === map.id ? plan.map : original),
    characterPatches, changedCharacterIds: [...new Set([...plan.changedCharacterIds, owner.id])], changedMapIds: [map.id],
  } }
}
