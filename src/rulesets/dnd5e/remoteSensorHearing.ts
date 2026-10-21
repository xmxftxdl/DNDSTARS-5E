import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { effectiveDnd5eActiveEffects } from './activeEffects'
import { dnd5eCombatantCanHearSource } from './audibility'
import { dnd5ePersistentAreaOccupantModifiersAt } from './persistentAreaGeometry'

/** Host-only room snapshot. Sound content and audibility distance remain with
 * the caller; this checks mechanical hearing restrictions at the remote origin. */
export function dnd5eRemoteSensorCanHearToken(input: {
  maps: readonly BattleMap[]; characters: readonly Character[]
  sensorId: string; soundSourceTokenId: string; worldMinute: number
}): boolean {
  const matches = input.maps.flatMap(map => map.tokens.filter(token => token.id === input.sensorId).map(sensor => ({ map, sensor })))
  if (matches.length !== 1 || !Number.isFinite(input.worldMinute)) return false
  const { map, sensor } = matches[0], effect = sensor.dnd5eSpellEffect
  if (!effect?.hearingFromSource || effect.sensorSense === 'sight' || !effect.concentrationId) return false
  const owners = input.characters.filter(character => character.id === effect.sourceCharacterId)
  const bodies = input.maps.flatMap(scene => scene.tokens.filter(token => token.id === effect.sourceTokenId))
  if (owners.length > 1 || (!owners.length && bodies.length !== 1)) return false
  const owner = owners[0], body = bodies.length === 1 ? bodies[0] : undefined
  const state = owner?.dnd5eCombatState ?? body?.dnd5eCombatState
  if (state?.concentrationSpellId !== effect.concentrationId) return false
  const areas = (map.dnd5ePluginAreas ?? []).filter(area => area.anchorTokenId === sensor.id &&
    area.concentrationId === effect.concentrationId && area.sourceTokenId === effect.sourceTokenId &&
    area.sourceCharacterId === effect.sourceCharacterId &&
    (area.expiresAtWorldMinute == null || input.worldMinute < area.expiresAtWorldMinute))
  if (areas.length !== 1) return false
  const soundSources = map.tokens.filter(token => token.id === input.soundSourceTokenId)
  if (soundSources.length !== 1) return false
  const soundSource = soundSources[0]
  const liveMap = { ...map, dnd5ePluginAreas: map.dnd5ePluginAreas?.filter(area => area.expiresAtWorldMinute == null || input.worldMinute < area.expiresAtWorldMinute) }
  // Area occupant queries exclude obstacle tokens. This ephemeral listener
  // probes the sensor location; it never changes the stored entity or grants
  // creature actions, hit points or targeting eligibility to the sensor.
  const listener = { ...sensor, type: owner ? 'player' as const : 'enemy' as const,
    characterId: owner?.id, poolId: body?.poolId }
  const listening = dnd5ePersistentAreaOccupantModifiersAt({ map: liveMap, token: listener, position: sensor })
  const speaking = dnd5ePersistentAreaOccupantModifiersAt({ map: liveMap, token: soundSource, position: soundSource })
  if (listening.suppressesMagic) return false
  const effects = effectiveDnd5eActiveEffects(state?.activeEffects)
  const conditions = [...(owner?.conditions ?? body?.dnd5eCombatState?.conditions ?? []), ...effects.flatMap(entry => entry.legacyCondition ? [entry.legacyCondition] : [])]
  const sourceCharacter = input.characters.find(character => character.id === soundSource.characterId)
  return dnd5eCombatantCanHearSource({ conditions, position: sensor, elevationFeet: sensor.elevationFeet,
    classState: { activeEffects: effects }, soundSuppressed: listening.preventsVerbalComponents ||
      listening.conditionSources.some(entry => entry.conditions.includes('deafened')) }, {
    conditions: [...(sourceCharacter?.conditions ?? soundSource.dnd5eCombatState?.conditions ?? []),
      ...effectiveDnd5eActiveEffects(sourceCharacter?.dnd5eCombatState?.activeEffects ?? soundSource.dnd5eCombatState?.activeEffects)
        .flatMap(entry => entry.legacyCondition ? [entry.legacyCondition] : [])], position: soundSource,
    elevationFeet: soundSource.elevationFeet, soundSuppressed: speaking.preventsVerbalComponents,
  }, map.id)
}
