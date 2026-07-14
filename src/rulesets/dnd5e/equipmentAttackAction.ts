import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import { DND_FEET_PER_CELL, cellDistance, tokenAnchorCellFromPixel } from '../../lib/gridCombat'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import { dnd5eWeaponAttackProfile, dnd5eWeaponRangeFeet, type Dnd5eWeaponAttackProfile } from './equipment'
import { fighterAttacksPerAttackAction } from './fighter'
import { resolveDnd5eHeadlessAction, type Dnd5eActionResult, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication, type Dnd5eMapResultPlan } from './mapBridge'

export type Dnd5eEquipmentAttackRejectReason =
  | 'invalid-action'
  | 'invalid-actor'
  | 'invalid-target'
  | 'not-fighter'
  | 'no-weapon'
  | 'target-out-of-range'
  | 'attack-action-spent'
  | 'combatant-missing'

export interface PreparedDnd5eEquipmentAttack {
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
  characterIdByCombatantId: Record<string, string>
  state: Dnd5eHeadlessCombatState
  actor: Character
  actorToken: Token
  targetToken: Token
  profile: Dnd5eWeaponAttackProfile
  targetArmorClass: number
  distanceFeet: number
  attackNumber: number
  attacksAllowed: number
}

export function prepareDnd5eEquipmentAttack(input: {
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  attacksUsed: number
  attackActionsAvailable?: number
}): { ok: true; prepared: PreparedDnd5eEquipmentAttack } | { ok: false; reason: Dnd5eEquipmentAttackRejectReason } {
  const { action } = input
  if (action.type !== 'dnd5e-weapon-attack' || !action.targetTokenId) return { ok: false, reason: 'invalid-action' }
  const actor = input.characters.find((character) => character.id === action.characterId)
  const actorToken = input.map.tokens.find((token) => token.id === action.actorTokenId && token.characterId === action.characterId)
  if (!actor || !actorToken || actor.currentHp <= 0) return { ok: false, reason: 'invalid-actor' }
  if (actor.charClass !== '战士') return { ok: false, reason: 'not-fighter' }
  const targetToken = input.map.tokens.find((token) => token.id === action.targetTokenId)
  if (!targetToken || targetToken.id === actorToken.id || targetToken.type === 'obstacle') return { ok: false, reason: 'invalid-target' }
  const profile = dnd5eWeaponAttackProfile(actor)
  if (!profile) return { ok: false, reason: 'no-weapon' }
  const actorCell = tokenAnchorCellFromPixel(actorToken.x, actorToken.y, actorToken, input.map)
  const targetCell = tokenAnchorCellFromPixel(targetToken.x, targetToken.y, targetToken, input.map)
  const distanceFeet = cellDistance(actorCell, targetCell) * DND_FEET_PER_CELL
  if (distanceFeet > dnd5eWeaponRangeFeet(profile)) return { ok: false, reason: 'target-out-of-range' }
  const attacksAllowed = fighterAttacksPerAttackAction(actor.level) * Math.max(1, Math.floor(input.attackActionsAvailable ?? 1))
  if (input.attacksUsed >= attacksAllowed) return { ok: false, reason: 'attack-action-spent' }
  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: action.combatId ?? `map-${input.map.id}`,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  const actorIndex = snapshot.state.initiativeOrder.indexOf(actorToken.id)
  const target = snapshot.state.combatants[targetToken.id]
  if (actorIndex < 0 || !snapshot.state.combatants[actorToken.id] || !target) return { ok: false, reason: 'combatant-missing' }
  return {
    ok: true,
    prepared: {
      action,
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      state: { ...snapshot.state, initiativeIndex: actorIndex },
      actor,
      actorToken,
      targetToken,
      profile,
      targetArmorClass: target.armorClass,
      distanceFeet,
      attackNumber: input.attacksUsed + 1,
      attacksAllowed,
    },
  }
}

export function previewDnd5eEquipmentAttack(prepared: PreparedDnd5eEquipmentAttack, d20: number) {
  const resolved = rules.resolveAttack({ rolls: [d20], modifier: prepared.profile.attackModifier, targetAc: prepared.targetArmorClass })
  const critical = resolved.roll.d20 >= prepared.profile.criticalThreshold
  return { ...resolved, hit: resolved.hit || critical, critical }
}

export function resolvePreparedDnd5eEquipmentAttack(input: {
  prepared: PreparedDnd5eEquipmentAttack
  d20: number
  damageRolls: readonly number[]
}): { result: Dnd5eActionResult; application?: Dnd5eMapResultPlan } {
  const { prepared } = input
  const result = resolveDnd5eHeadlessAction(prepared.state, {
    type: 'attack',
    actorId: prepared.actorToken.id,
    targetId: prepared.targetToken.id,
    attackModifier: prepared.profile.attackModifier,
    criticalThreshold: prepared.profile.criticalThreshold,
    d20: input.d20,
    damage: {
      count: prepared.profile.damage.count,
      sides: prepared.profile.damage.sides,
      bonus: prepared.profile.damage.bonus,
      rolls: input.damageRolls,
    },
  })
  if (!result.ok) return { result }
  return {
    result,
    application: planDnd5eMapResultApplication({
      state: result.state,
      map: prepared.map,
      characters: prepared.characters,
      characterIdByCombatantId: prepared.characterIdByCombatantId,
    }),
  }
}
