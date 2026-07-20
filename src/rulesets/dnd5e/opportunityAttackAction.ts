import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import { DND_FEET_PER_CELL, cellDistance, tokenAnchorCellFromPixel } from '../../lib/gridCombat'
import { areOpposedCombatTokens } from '../../lib/opportunityAttacks'
import type { Dnd5eTurnEconomyByToken, Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import type { D20RollMode } from '../contracts'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import { dnd5eWeaponAttackProfile } from './equipment'
import {
  dnd5eAttackerIsUnseenForAttack,
  dnd5eCombatantHasConcentrationEffect,
  dnd5eCombatantCanSee,
  dnd5eFrightenedAttackDisadvantage,
  dnd5eHelpAttackApplies,
  dnd5eTargetArmorClassForAttack,
  dnd5eTargetIsUnseenForAttack,
  dnd5eTranquilityWardCheck,
  resolveDnd5eHeadlessAction,
  type Dnd5eActionResult,
  type Dnd5eCuttingWordsUse,
  type Dnd5eHeadlessCombatState,
  type Dnd5eTranquilitySaveRoll,
  type Dnd5eStandAgainstTideUse,
} from './headlessCombatEngine'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication, type Dnd5eMapResultPlan } from './mapBridge'
import { getDnd5eSrdMonster, type Dnd5eDamageType } from './monsters'
import { dnd5eHasViciousMockeryAttackDisadvantage, dnd5eReactionsPrevented, dnd5eTargetGrantsAttackAdvantage } from './passiveDefenses'
import { resolveDnd5eRollMode } from './rollMode'

export function findDnd5eOpportunityAttackersForMove(input: {
  map: BattleMap
  characters: readonly Character[]
  movingToken: Token
  to: { x: number; y: number }
  path?: Array<{ x: number; y: number }>
  turnEconomyByToken: Dnd5eTurnEconomyByToken
  disengaged?: boolean
}): Token[] {
  if (input.disengaged) return []
  const pathCells = (input.path?.length ? input.path : [input.movingToken, input.to]).map((point) =>
    tokenAnchorCellFromPixel(point.x, point.y, input.movingToken, input.map),
  )
  return input.map.tokens.filter((token) => {
    if (token.id === input.movingToken.id || !areOpposedCombatTokens(token, input.movingToken)) return false
    const character = token.characterId
      ? input.characters.find((candidate) => candidate.id === token.characterId)
      : undefined
    if (character ? character.currentHp <= 0 : (token.hp ?? 1) <= 0) return false
    if ((input.turnEconomyByToken[token.id]?.reaction.current ?? 1) < 1) return false
    const noReactions = character
      ? Object.keys(character.dnd5eCombatState?.openHandNoReactionsAppliedTurnKeysBySource ?? {}).length > 0
      : Object.keys(token.dnd5eCombatState?.openHandNoReactionsAppliedTurnKeysBySource ?? {}).length > 0
    if (noReactions) return false
    const playerProfile = character?.rulesetId === 'dnd5e-2014-srd-5.1'
      ? dnd5eWeaponAttackProfile(character)
      : undefined
    const monster = token.poolId ? getDnd5eSrdMonster(token.poolId) : undefined
    const monsterReach = monster?.actions
      .filter((action) => action.attack && (action.attack.mode === 'melee' || action.attack.mode === 'melee-or-ranged'))
      .reduce((maximum, action) => Math.max(maximum, action.attack?.reachFeet ?? 5), 0)
    const reachFeet = playerProfile?.mode === 'melee' ? (playerProfile.reachFeet ?? 5) : (monsterReach ?? 0)
    if (reachFeet <= 0) return false
    const attackerCell = tokenAnchorCellFromPixel(token.x, token.y, token, input.map)
    const feetPerCell = Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
    return pathCells.slice(0, -1).some((cell, index) =>
      cellDistance(attackerCell, cell) * feetPerCell <= reachFeet &&
      cellDistance(attackerCell, pathCells[index + 1]) * feetPerCell > reachFeet,
    )
  })
}

export type Dnd5eOpportunityAttackRejectReason =
  | 'invalid-actor'
  | 'invalid-target'
  | 'reaction-unavailable'
  | 'no-melee-weapon'
  | 'target-out-of-range'
  | 'target-not-visible'
  | 'combatant-missing'

export interface PreparedDnd5eOpportunityAttack {
  map: BattleMap
  characters: readonly Character[]
  state: Dnd5eHeadlessCombatState
  characterIdByCombatantId: Record<string, string>
  actorToken: Token
  targetToken: Token
  actorName: string
  targetName: string
  weaponName: string
  attackModifier: number
  attackMode: D20RollMode
  targetArmorClass: number
  damage: { count: number; sides: number; bonus: number; type: Dnd5eDamageType }
  reachFeet: number
  reactionFeature?: 'berserker-retaliation' | 'hunter-giant-killer'
  tranquilityWard?: ReturnType<typeof dnd5eTranquilityWardCheck>
  blessed: boolean
  baned: boolean
}

export function prepareDnd5eOpportunityAttack(input: {
  combatId: string
  round?: number
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  actorTokenId: string
  targetTokenId: string
  turnEconomy: Dnd5eTurnEconomyCounts
  targetTurnEconomy?: Dnd5eTurnEconomyCounts
  reactionFeature?: 'berserker-retaliation' | 'hunter-giant-killer'
}): { ok: true; prepared: PreparedDnd5eOpportunityAttack } | { ok: false; reason: Dnd5eOpportunityAttackRejectReason } {
  const actorToken = input.map.tokens.find((token) => token.id === input.actorTokenId)
  const targetToken = input.map.tokens.find((token) => token.id === input.targetTokenId)
  if (!actorToken || !targetToken || !areOpposedCombatTokens(actorToken, targetToken)) return { ok: false, reason: 'invalid-actor' }
  if (input.turnEconomy.reaction.current < 1) return { ok: false, reason: 'reaction-unavailable' }

  const actor = actorToken.characterId
    ? input.characters.find((character) => character.id === actorToken.characterId)
    : undefined
  const target = targetToken.characterId
    ? input.characters.find((character) => character.id === targetToken.characterId)
    : undefined
  if (actor ? actor.currentHp <= 0 : (actorToken.hp ?? 1) <= 0) return { ok: false, reason: 'invalid-actor' }
  if (target ? target.currentHp <= 0 : (targetToken.hp ?? 1) <= 0) return { ok: false, reason: 'invalid-target' }
  if (
    input.reactionFeature === 'berserker-retaliation' &&
    (!actor || actor.charClass !== '野蛮人' || actor.level < 14 || actor.dnd5eClassChoices?.classes?.barbarian?.subclass !== 'berserker')
  ) return { ok: false, reason: 'invalid-actor' }
  if (
    input.reactionFeature === 'hunter-giant-killer' &&
    (
      !actor || actor.charClass !== '游侠' || actor.level < 3 ||
      actor.dnd5eClassChoices?.classes?.ranger?.subclass !== 'hunter' ||
      !actor.dnd5eClassChoices?.classes?.ranger?.selections?.['hunters-prey']?.includes('giant-killer')
    )
  ) return { ok: false, reason: 'invalid-actor' }

  const playerProfile = actor?.rulesetId === 'dnd5e-2014-srd-5.1' ? dnd5eWeaponAttackProfile(actor) : undefined
  const monster = actorToken.poolId ? getDnd5eSrdMonster(actorToken.poolId) : undefined
  const monsterAction = monster?.actions.find((action) =>
    action.kind === 'weapon-attack' && action.attack && (action.attack.mode === 'melee' || action.attack.mode === 'melee-or-ranged'),
  )
  const monsterDamage = monsterAction?.attack?.damage[0]
  const isPlayerMelee = playerProfile?.mode === 'melee'
  if (!isPlayerMelee && (!monsterAction?.attack || !monsterDamage)) return { ok: false, reason: 'no-melee-weapon' }
  const reachFeet = input.reactionFeature
    ? 5
    : isPlayerMelee ? (playerProfile.reachFeet ?? 5) : (monsterAction!.attack!.reachFeet ?? 5)
  const distanceFeet = cellDistance(
    tokenAnchorCellFromPixel(actorToken.x, actorToken.y, actorToken, input.map),
    tokenAnchorCellFromPixel(targetToken.x, targetToken.y, targetToken, input.map),
  ) * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
  if (distanceFeet > reachFeet) return { ok: false, reason: 'target-out-of-range' }

  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: input.combatId,
    round: input.round,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  const actorCombatant = snapshot.state.combatants[actorToken.id]
  const targetCombatant = snapshot.state.combatants[targetToken.id]
  if (!actorCombatant || !targetCombatant) return { ok: false, reason: 'combatant-missing' }
  if (dnd5eReactionsPrevented(actorCombatant)) return { ok: false, reason: 'reaction-unavailable' }
  if (!dnd5eCombatantCanSee(snapshot.state, actorToken.id, targetToken.id)) {
    return { ok: false, reason: 'target-not-visible' }
  }
  actorCombatant.turn = {
    actionAvailable: input.turnEconomy.action.current > 0,
    bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
    reactionAvailable: true,
    movementRemaining: input.turnEconomy.movement.current,
  }
  if (input.targetTurnEconomy) {
    targetCombatant.turn = {
      actionAvailable: input.targetTurnEconomy.action.current > 0,
      bonusActionAvailable: input.targetTurnEconomy.bonusAction.current > 0,
      reactionAvailable: input.targetTurnEconomy.reaction.current > 0,
      movementRemaining: input.targetTurnEconomy.movement.current,
    }
  }
  return {
    ok: true,
    prepared: {
      map: input.map,
      characters: input.characters,
      state: snapshot.state,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      actorToken,
      targetToken,
      actorName: actor?.name ?? actorToken.label,
      targetName: target?.name ?? targetToken.label,
      weaponName: isPlayerMelee ? playerProfile.weaponName : monsterAction!.name,
      attackModifier: isPlayerMelee ? playerProfile.attackModifier : monsterAction!.attack!.toHit,
      attackMode: (() => {
        const advantage = dnd5eTargetGrantsAttackAdvantage(targetCombatant) ||
          dnd5eHelpAttackApplies(snapshot.state, actorCombatant, targetCombatant) ||
          dnd5eAttackerIsUnseenForAttack(snapshot.state, actorToken.id, targetToken.id) || actorCombatant.classState.hiddenCheckTotal != null ||
          targetCombatant.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
        const disadvantage = dnd5eHasViciousMockeryAttackDisadvantage(actorCombatant) ||
          dnd5eFrightenedAttackDisadvantage(snapshot.state, actorCombatant) ||
          dnd5eTargetIsUnseenForAttack(snapshot.state, actorToken.id, targetToken.id) ||
          actorCombatant.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase())) ||
          (targetCombatant.classId === 'ranger' && targetCombatant.subclassId === 'hunter' &&
            targetCombatant.level >= 7 && targetCombatant.classSelections['defensive-tactics']?.includes('escape-the-horde'))
        return resolveDnd5eRollMode({
          advantage: [{ active: advantage, reason: 'opportunity-attack-advantage' }],
          disadvantage: [{ active: disadvantage, reason: 'opportunity-attack-disadvantage' }],
        }).mode
      })(),
      targetArmorClass: dnd5eTargetArmorClassForAttack(snapshot.state, actorToken.id, targetToken.id),
      damage: isPlayerMelee ? { ...playerProfile.damage } : { ...monsterDamage! },
      reachFeet,
      reactionFeature: input.reactionFeature,
      tranquilityWard: dnd5eTranquilityWardCheck(actorCombatant, targetCombatant, snapshot.state),
      blessed: dnd5eCombatantHasConcentrationEffect(snapshot.state, actorToken.id, 'bless'),
      baned: dnd5eCombatantHasConcentrationEffect(snapshot.state, actorToken.id, 'bane'),
    },
  }
}

export function previewDnd5eOpportunityAttack(prepared: PreparedDnd5eOpportunityAttack, d20: number, d20Second?: number, blessRoll?: number, baneRoll?: number) {
  const rolls = prepared.attackMode === 'normal' ? [d20] : [d20, d20Second ?? d20]
  return rules.resolveAttack({ rolls, mode: prepared.attackMode, modifier: prepared.attackModifier + (blessRoll ?? 0) - (baneRoll ?? 0), targetAc: prepared.targetArmorClass })
}

export function resolvePreparedDnd5eOpportunityAttack(input: {
  prepared: PreparedDnd5eOpportunityAttack
  d20: number
  d20Second?: number
  blessRoll?: number
  baneRoll?: number
  bardicInspirationRoll?: number
  strokeOfLuck?: boolean
  cuttingWords?: Dnd5eCuttingWordsUse
  cuttingWordsDamage?: Dnd5eCuttingWordsUse
  shieldSpellReaction?: boolean
  uncannyDodge?: boolean
  tranquilitySave?: Dnd5eTranquilitySaveRoll
  hurlThroughHellDamageRolls?: readonly number[]
  standAgainstTide?: Dnd5eStandAgainstTideUse
  damageRolls: readonly number[]
}): { result: Dnd5eActionResult; application?: Dnd5eMapResultPlan } {
  const { prepared } = input
  const result = resolveDnd5eHeadlessAction(prepared.state, {
    type: 'opportunity-attack',
    actorId: prepared.actorToken.id,
    targetId: prepared.targetToken.id,
    attackModifier: prepared.attackModifier,
    d20: input.d20,
    d20Second: input.d20Second,
    blessRoll: input.blessRoll,
    baneRoll: input.baneRoll,
    bardicInspirationRoll: input.bardicInspirationRoll,
    strokeOfLuck: input.strokeOfLuck,
    cuttingWords: input.cuttingWords,
    cuttingWordsDamage: input.cuttingWordsDamage,
    shieldSpellReaction: input.shieldSpellReaction,
    uncannyDodge: input.uncannyDodge,
    tranquilitySave: input.tranquilitySave,
    hurlThroughHellDamageRolls: input.hurlThroughHellDamageRolls,
    standAgainstTide: input.standAgainstTide,
    mode: prepared.attackMode,
    reactionFeature: prepared.reactionFeature,
    damage: { ...prepared.damage, rolls: input.damageRolls },
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
