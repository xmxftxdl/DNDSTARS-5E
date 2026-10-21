import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { hashDnd5eArcaneLockPasswordV1 } from './mapObjectState'
import { createDnd5eMapCombatSnapshot } from './mapBridge'
import { dnd5eCombatantCanSpeakAudibly } from './headlessCombatEngine'
import { dnd5eConditionIncapacitated } from './conditions'
import { dnd5eConditionsFromActiveEffects } from './activeEffects'

/** Host-only transaction. Caller authenticates actor ownership before publishing.
 * The spell does not restrict where its password may be spoken or charge an action.
 * The phrase is used transiently and is not returned with the application.
 */
export function prepareDnd5eGrovePassword(input: {
  map: BattleMap; characters: readonly Character[]; actorTokenId: string;
  areaId: string; spokenPassword: string; round: number; worldMinute: number;
}) {
  if (typeof input.spokenPassword !== 'string' || input.spokenPassword.length > 120 ||
    !Number.isSafeInteger(input.round) || input.round < 1 || !Number.isSafeInteger(input.worldMinute) || input.worldMinute < 0) {
    return { ok: false as const, reason: 'invalid-grove-password-request' }
  }
  const selected = input.map.dnd5ePluginAreas?.find(area => area.id === input.areaId)
  const digest = hashDnd5eArcaneLockPasswordV1(input.spokenPassword)
  const live = (area: NonNullable<BattleMap['dnd5ePluginAreas']>[number]) => area.permanent ||
    (area.expiresAtWorldMinute != null ? input.worldMinute < area.expiresAtWorldMinute : input.round <= area.expiresAfterRound)
  if (!selected?.effectGroup || !selected.grovePasswordDigest || !digest ||
    selected.grovePasswordDigest !== digest || !live(selected)) return { ok: false as const, reason: 'grove-password-invalid' }
  const actorToken = input.map.tokens.find(t => t.id === input.actorTokenId && t.type !== 'obstacle')
  if (!actorToken) return { ok: false as const, reason: 'invalid-actor' }
  const snapshot = createDnd5eMapCombatSnapshot({ map: input.map, characters: input.characters, combatId: 'grove-password',
    round: input.round, initiativeOrder: input.map.tokens.filter(t => t.type !== 'obstacle')
      .map(t => ({ tokenId: t.id, label: t.label, emoji: t.emoji, color: t.color, roll: 0 })) })
  const actor = snapshot.state.combatants[actorToken.id]
  if (!actor || actor.currentHp <= 0 || actor.deathSaves.dead || dnd5eConditionIncapacitated(actor) ||
    !dnd5eCombatantCanSpeakAudibly(actor)) return { ok: false as const, reason: 'cannot-speak' }
  const belongs = (area: NonNullable<BattleMap['dnd5ePluginAreas']>[number]) =>
    area.effectGroup?.castId === selected.effectGroup!.castId && area.pluginId === selected.pluginId &&
    area.sourceTokenId === selected.sourceTokenId && area.featureId === selected.featureId &&
    area.grovePasswordDigest === digest && live(area)
  const ids = new Set(input.map.dnd5ePluginAreas!.filter(belongs).map(a => a.id))
  const clearBinding = <T extends { conditions?: Character['conditions']; dnd5eCombatState?: Character['dnd5eCombatState'] }>(entity: T): T => {
    const effects = entity.dnd5eCombatState?.activeEffects
    if (!effects) return entity
    const activeEffects = effects.filter(effect => !(effect.areaLifetime?.mapId === input.map.id &&
      effect.areaLifetime.sourceActorId === selected.sourceTokenId && ids.has(effect.areaLifetime.areaId)))
    if (effects.length === activeEffects.length) return entity
    return { ...entity, conditions: dnd5eConditionsFromActiveEffects(activeEffects),
      dnd5eCombatState: { ...entity.dnd5eCombatState, activeEffects } }
  }
  return { ok: true as const, map: { ...input.map,
    tokens: input.map.tokens.map(t => t.id === actorToken.id ? clearBinding(t) : t),
    dnd5ePluginAreas: input.map.dnd5ePluginAreas!.map(area => belongs(area) ? { ...area,
      excludedTargetIds: [...new Set([...(area.excludedTargetIds ?? []), actorToken.id])],
      triggers: area.triggers?.map(trigger => ({ ...trigger, excludedTokenIds: [...new Set([...(trigger.excludedTokenIds ?? []), actorToken.id])] })),
      obscurationExcludedTokenIds: area.obscuration ? [...new Set([...(area.obscurationExcludedTokenIds ?? []), actorToken.id])] : area.obscurationExcludedTokenIds,
    } : area),
  }, characters: input.characters.map(c => c.id === actorToken.characterId ? clearBinding(c) : c) }
}
