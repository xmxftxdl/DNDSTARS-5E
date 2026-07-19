import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import { DND_FEET_PER_CELL, tokenFootprintDistanceCells } from '../../lib/gridCombat'
import { areOpposedCombatTokens } from '../../lib/opportunityAttacks'
import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import {
  dnd5eTargetArmorClassForAttack,
  dnd5eCombatantHasConcentrationEffect,
  dnd5eTranquilityWardCheck,
  resolveDnd5eHeadlessAction,
  type Dnd5eActionResult,
  type Dnd5eHeadlessCombatState,
  type Dnd5eMonsterActionRoll,
} from './headlessCombatEngine'
import {
  createDnd5eMapCombatSnapshot,
  planDnd5eMapResultApplication,
  type Dnd5eMapResultPlan,
} from './mapBridge'
import {
  getDnd5eSrdMonster,
  type Dnd5eMonsterAction,
  type Dnd5eMonsterStatBlock,
  type Dnd5eMonsterWeaponAttack,
} from './monsters'
import { dnd5eAttackerIsUnseen, dnd5eHasViciousMockeryAttackDisadvantage, dnd5ePreventsAttackAdvantage, dnd5eTargetGrantsAttackAdvantage, dnd5eUnseenTargetImposesDisadvantage } from './passiveDefenses'

export type Dnd5eMonsterAttackRejectReason =
  | 'invalid-actor'
  | 'invalid-target'
  | 'invalid-stat-block'
  | 'invalid-action'
  | 'target-out-of-range'
  | 'combatant-missing'

export interface PreparedDnd5eMonsterAttack {
  map: BattleMap
  characters: readonly Character[]
  characterIdByCombatantId: Record<string, string>
  state: Dnd5eHeadlessCombatState
  actorToken: Token
  targetToken: Token
  monster: Dnd5eMonsterStatBlock
  action: Dnd5eMonsterAction
  attacks: readonly { id: string; name: string; attack: Dnd5eMonsterWeaponAttack }[]
  targetArmorClass: number
  distanceFeet: number
  targetAttackMode: 'normal' | 'advantage' | 'disadvantage'
  viciousMockeryAttackDisadvantage: boolean
  tranquilityWard?: ReturnType<typeof dnd5eTranquilityWardCheck>
  blessed: boolean
  baned: boolean
}

export function prepareDnd5eMonsterAttack(input: {
  combatId: string
  round?: number
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  actorTokenId: string
  targetTokenId: string
  actionIndex?: number
  turnEconomy?: Dnd5eTurnEconomyCounts
  targetTurnEconomy?: Dnd5eTurnEconomyCounts
  turnEconomyByToken?: Readonly<Record<string, Dnd5eTurnEconomyCounts>>
}): { ok: true; prepared: PreparedDnd5eMonsterAttack } | { ok: false; reason: Dnd5eMonsterAttackRejectReason } {
  const actorToken = input.map.tokens.find((token) => token.id === input.actorTokenId && token.type !== 'obstacle')
  const actorCharacter = actorToken?.characterId
    ? input.characters.find((character) => character.id === actorToken.characterId)
    : undefined
  const statBlockId = actorToken?.type === 'enemy'
    ? actorToken.poolId
    : actorCharacter?.dnd5eCombatState?.wildShapeFormId
  if (!actorToken || !statBlockId) return { ok: false, reason: 'invalid-actor' }
  const targetToken = input.map.tokens.find((token) => token.id === input.targetTokenId && token.id !== actorToken.id && token.type !== 'obstacle')
  if (!targetToken || !areOpposedCombatTokens(actorToken, targetToken)) return { ok: false, reason: 'invalid-target' }
  const monster = getDnd5eSrdMonster(statBlockId)
  if (!monster) return { ok: false, reason: 'invalid-stat-block' }

  const indexedAction = monster.actions[input.actionIndex ?? 0]
    ?? monster.actions.find((action) => action.kind === 'weapon-attack')
  if (!indexedAction) return { ok: false, reason: 'invalid-action' }
  const multiattack = indexedAction.kind === 'weapon-attack'
    ? monster.actions.find((action) => action.kind === 'multiattack' && action.sequence?.includes(indexedAction.id))
    : undefined
  const action = multiattack ?? indexedAction
  const attackIds = action.kind === 'multiattack' ? action.sequence ?? [] : [action.id]
  const attacks = attackIds.flatMap((actionId) => {
    const definition = monster.actions.find((candidate) => candidate.id === actionId)
    return definition?.attack ? [{ id: definition.id, name: definition.name, attack: definition.attack }] : []
  })
  if (attacks.length !== attackIds.length || attacks.length === 0) return { ok: false, reason: 'invalid-action' }
  const distanceFeet = tokenFootprintDistanceCells(actorToken, targetToken, input.map)
    * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
  const allAttacksInRange = attacks.every(({ attack }) => distanceFeet <= Math.max(
    attack.reachFeet ?? 0,
    attack.rangeFeet?.long ?? attack.rangeFeet?.normal ?? 0,
  ))
  if (!allAttacksInRange) return { ok: false, reason: 'target-out-of-range' }

  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: input.combatId,
    round: input.round,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  const actorIndex = snapshot.state.initiativeOrder.indexOf(actorToken.id)
  const target = snapshot.state.combatants[targetToken.id]
  const actorCombatant = snapshot.state.combatants[actorToken.id]
  if (actorIndex < 0 || !actorCombatant || !target) {
    return { ok: false, reason: 'combatant-missing' }
  }
  for (const [tokenId, economy] of Object.entries(input.turnEconomyByToken ?? {})) {
    const combatant = snapshot.state.combatants[tokenId]
    if (!combatant) continue
    combatant.turn = {
      ...combatant.turn,
      actionAvailable: economy.action.current > 0,
      bonusActionAvailable: economy.bonusAction.current > 0,
      reactionAvailable: economy.reaction.current > 0,
      movementRemaining: economy.movement.current,
    }
  }
  if (input.turnEconomy) {
    actorCombatant.turn = {
      ...actorCombatant.turn,
      actionAvailable: input.turnEconomy.action.current > 0,
      bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
      reactionAvailable: input.turnEconomy.reaction.current > 0,
      movementRemaining: input.turnEconomy.movement.current,
    }
  }
  if (input.targetTurnEconomy) {
    target.turn = {
      ...target.turn,
      actionAvailable: input.targetTurnEconomy.action.current > 0,
      bonusActionAvailable: input.targetTurnEconomy.bonusAction.current > 0,
      reactionAvailable: input.targetTurnEconomy.reaction.current > 0,
      movementRemaining: input.targetTurnEconomy.movement.current,
    }
  }
  const actorProne = actorCombatant.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
  const targetProne = target.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
  const targetGrantsAdvantage = !dnd5ePreventsAttackAdvantage(target) &&
    (dnd5eTargetGrantsAttackAdvantage(target) || !!target.classState.recklessAttackTurnKey || !!target.classState.stunnedByActorId ||
      dnd5eAttackerIsUnseen(actorCombatant) || (targetProne && distanceFeet <= 5))
  const targetImposesDisadvantage = !!target.classState.dodgingTurnKey ||
    dnd5eUnseenTargetImposesDisadvantage(actorCombatant, target) || actorProne || (targetProne && distanceFeet > 5)
  const targetAttackMode = targetGrantsAdvantage === targetImposesDisadvantage
    ? 'normal'
    : targetGrantsAdvantage
      ? 'advantage'
      : 'disadvantage'
  return {
    ok: true,
    prepared: {
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      state: { ...snapshot.state, initiativeIndex: actorIndex },
      actorToken,
      targetToken,
      monster,
      action,
      attacks,
      targetArmorClass: dnd5eTargetArmorClassForAttack(snapshot.state, actorToken.id, targetToken.id),
      distanceFeet,
      targetAttackMode,
      viciousMockeryAttackDisadvantage: dnd5eHasViciousMockeryAttackDisadvantage(actorCombatant),
      tranquilityWard: dnd5eTranquilityWardCheck(actorCombatant, target, snapshot.state),
      blessed: dnd5eCombatantHasConcentrationEffect(snapshot.state, actorToken.id, 'bless'),
      baned: dnd5eCombatantHasConcentrationEffect(snapshot.state, actorToken.id, 'bane'),
    },
  }
}

export function previewDnd5eMonsterAttack(
  prepared: PreparedDnd5eMonsterAttack,
  attackIndex: number,
  d20: number,
  d20Second?: number,
  protectedAttack = false,
  blessRoll?: number,
  baneRoll?: number,
) {
  const definition = prepared.attacks[attackIndex]
  if (!definition) throw new RangeError('monster attack index is out of range')
  const mode = dnd5eMonsterAttackModeWithProtection(
    dnd5ePreparedMonsterAttackMode(prepared, attackIndex),
    protectedAttack,
  )
  const rolls = mode === 'normal' ? [d20] : [d20, d20Second ?? d20]
  return rules.resolveAttack({ rolls, mode, modifier: definition.attack.toHit + (blessRoll ?? 0) - (baneRoll ?? 0), targetAc: prepared.targetArmorClass })
}

export function dnd5eMonsterAttackModeWithProtection(
  mode: PreparedDnd5eMonsterAttack['targetAttackMode'],
  protectedAttack: boolean,
): PreparedDnd5eMonsterAttack['targetAttackMode'] {
  if (!protectedAttack || mode === 'disadvantage') return mode
  return mode === 'advantage' ? 'normal' : 'disadvantage'
}

export function dnd5ePreparedMonsterAttackMode(
  prepared: Pick<PreparedDnd5eMonsterAttack, 'targetAttackMode' | 'viciousMockeryAttackDisadvantage'>,
  attackIndex: number,
): PreparedDnd5eMonsterAttack['targetAttackMode'] {
  if (!prepared.viciousMockeryAttackDisadvantage || attackIndex !== 0) return prepared.targetAttackMode
  return prepared.targetAttackMode === 'advantage' ? 'normal' : 'disadvantage'
}

export function resolvePreparedDnd5eMonsterAttack(input: {
  prepared: PreparedDnd5eMonsterAttack
  rolls: readonly Omit<Dnd5eMonsterActionRoll, 'targetId'>[]
}): { result: Dnd5eActionResult; application?: Dnd5eMapResultPlan } {
  const { prepared } = input
  const result = resolveDnd5eHeadlessAction(prepared.state, {
    type: 'monster-action',
    actorId: prepared.actorToken.id,
    actionId: prepared.action.id,
    rolls: input.rolls.map((roll, attackIndex) => ({
      ...roll,
      mode: dnd5eMonsterAttackModeWithProtection(
        dnd5ePreparedMonsterAttackMode(prepared, attackIndex),
        !!roll.protectionReactionActorId,
      ),
      targetId: prepared.targetToken.id,
    })),
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
