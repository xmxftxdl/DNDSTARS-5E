import type { Character } from '../../types/character'
import { dnd5eAttackActionSlot } from './attackActionSlot'
import { canUseDnd5eDistinctTargetBonusAttack, dnd5eOrdinaryAttacksUsed } from './attackActionHistory'
import { dnd5eCharacterHasPluginFeature, dnd5ePluginFeaturesAvailableForCharacter } from './pluginApi'

export function dnd5eCharacterAttackTeleportRange(character: Character): number | undefined {
  const feature = dnd5ePluginFeaturesAvailableForCharacter(character).find(candidate =>
    candidate.automation === 'full' && candidate.declarativeAbility?.mechanic?.kind === 'attack-action-teleport' &&
    dnd5eCharacterHasPluginFeature(character, candidate.id))
  return feature?.declarativeAbility?.mechanic?.kind === 'attack-action-teleport'
    ? feature.declarativeAbility.mechanic.rangeFeet : undefined
}

export function dnd5eCharacterDistinctTargetBonusFeature(character: Character, turnKey: string | undefined, targetId?: string) {
  if (!turnKey) return undefined
  return dnd5ePluginFeaturesAvailableForCharacter(character).find(candidate => {
    const mechanic = candidate.declarativeAbility?.mechanic
    return candidate.automation === 'full' && mechanic?.kind === 'distinct-target-bonus-attack' &&
      dnd5eCharacterHasPluginFeature(character, candidate.id) &&
      canUseDnd5eDistinctTargetBonusAttack(character.dnd5eCombatState?.attackActionHistory, {
        turnKey, targetId, featureId: candidate.id, minimumDistinctTargets: mechanic.minimumDistinctTargets,
      })
  })
}

/** Preview the same weapon-only slots as Host; an extra slot also needs its live grant. */
export function dnd5eCharacterWeaponAttackSlot(input: {
  character: Character
  turnKey?: string
  attacksUsed: number
  attacksPerAction: number
  actionCount: number
  extraWeaponEligible: boolean
  loadingLimited?: boolean
  distinctTargetEligible?: boolean
}) {
  const state = input.character.dnd5eCombatState
  const feature = !input.loadingLimited && input.turnKey &&
    state?.firstOwnCombatTurn?.turnKey === input.turnKey
    ? dnd5ePluginFeaturesAvailableForCharacter(input.character).find(candidate =>
      candidate.automation === 'full' &&
      candidate.declarativeAbility?.mechanic?.kind === 'first-own-turn-extra-weapon-attack' &&
      dnd5eCharacterHasPluginFeature(input.character, candidate.id))
    : undefined
  const ordinaryAttacksUsed = dnd5eOrdinaryAttacksUsed(state?.attackActionHistory, input.turnKey, input.attacksUsed)
  if (!Number.isSafeInteger(ordinaryAttacksUsed)) return undefined
  const slot = dnd5eAttackActionSlot({
    attacksPerAction: input.attacksPerAction, actionCount: input.actionCount,
    attacksUsed: ordinaryAttacksUsed,
    extraWeaponAttacksPerAction: feature ? 1 : 0,
    attackKind: input.extraWeaponEligible ? 'weapon' : 'replacement',
  })
  if ((!slot || slot.spendsAction) && input.turnKey && !input.loadingLimited && input.distinctTargetEligible !== false) {
    const bonus = dnd5eCharacterDistinctTargetBonusFeature(input.character, input.turnKey)
    if (bonus) return { attackNumber: input.attacksUsed + 1, attacksAllowed: input.attacksUsed + 1,
      spendsAction: false, weaponOnly: undefined, distinctTargetBonusFeatureId: bonus.id }
  }
  if (slot?.weaponOnly && (!feature || state?.firstOwnTurnWeaponAttack?.featureId !== feature.id ||
    state.firstOwnTurnWeaponAttack.turnKey !== input.turnKey)) return undefined
  return slot
}
