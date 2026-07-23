import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { DND_FEET_PER_CELL, tokenFootprintDistanceCells } from '../../lib/gridCombat'
import { dnd5eClassDefinitionForCharacter } from './classes'
import { dnd5eCombatantHasConcentrationEffect, resolveDnd5eHeadlessAction, type Dnd5eActionResult, type Dnd5eHeadlessCombatState, type Dnd5eMonsterMechanicRoll, type Dnd5eMonsterRechargeRoll } from './headlessCombatEngine'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication, type Dnd5eMapResultPlan } from './mapBridge'
import { dnd5eSavingThrowMode } from './passiveDefenses'
import { dnd5eHeightenedSavingThrowMode } from './spells'
import {
  dnd5eConditionsFromActiveEffects,
  removeDnd5eActiveEffectsByStandardCondition,
  type Dnd5eActiveEffectInstance,
  type Dnd5eActiveEffectSavingThrowRoll,
} from './activeEffects'
import { getDnd5eSrdMonster } from './monsters'
import { dnd5eMonsterRechargeActions } from './monsterGenericAbilities'
import {
  dnd5eEligibleMonsterMechanics,
  dnd5eMonsterMechanicDiceRequirements,
  type Dnd5eMonsterMechanicDiceRequirement,
} from './monsterAutomation'

export type Dnd5eEndTurnRejectReason = 'invalid-action' | 'invalid-actor' | 'combatant-missing'

export interface PreparedDnd5eMonsterMechanicRoll {
  actorId: string
  actorName: string
  mechanicId: string
  mechanicName: string
  targetId?: string
  effects: readonly Dnd5eMonsterMechanicDiceRequirement[]
}

export interface PreparedDnd5ePlayerEndTurn {
  actor?: Character
  actorName: string
  actorToken: Token
  state: Dnd5eHeadlessCombatState
  characterIdByCombatantId: Record<string, string>
  activeEffectSavingThrows: readonly {
    effect: Dnd5eActiveEffectInstance
    modifier: number
    dc: number
    mode: 'normal' | 'advantage' | 'disadvantage'
    blessed: boolean
    baned: boolean
  }[]
  turnStartActiveEffectSavingThrows: readonly {
    effect: Dnd5eActiveEffectInstance
    targetId: string
    targetName: string
    modifier: number
    dc: number
    mode: 'normal' | 'advantage' | 'disadvantage'
    blessed: boolean
    baned: boolean
  }[]
  nextMonsterRechargeRolls: readonly {
    actorId: string
    actorName: string
    actionId: string
    actionName: string
    dieSides: number
    minimum: number
  }[]
  currentMonsterMechanicRolls: readonly PreparedDnd5eMonsterMechanicRoll[]
  nextMonsterMechanicRolls: readonly PreparedDnd5eMonsterMechanicRoll[]
}

export function prepareDnd5ePlayerEndTurn(input: {
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
}): { ok: true; prepared: PreparedDnd5ePlayerEndTurn } | { ok: false; reason: Dnd5eEndTurnRejectReason } {
  if (input.action.type !== 'end-turn' && input.action.type !== 'dnd5e-death-save') {
    return { ok: false, reason: 'invalid-action' }
  }
  const actorToken = input.map.tokens.find((token) => token.id === input.action.actorTokenId)
  const actor = actorToken?.characterId
    ? input.characters.find((character) => character.id === actorToken.characterId)
    : undefined
  const monster = actorToken?.poolId ? getDnd5eSrdMonster(actorToken.poolId) : undefined
  if (!actorToken || (actor ? !dnd5eClassDefinitionForCharacter(actor) : !monster)) {
    return { ok: false, reason: 'invalid-actor' }
  }
  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: input.action.combatId ?? `map-${input.map.id}`,
    round: input.action.round,
    turnSlotId: input.initiativeOrder[input.action.initiativeIndex]?.slotId,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  const actorIndex = snapshot.state.initiativeOrder.indexOf(actorToken.id)
  if (actorIndex < 0 || !snapshot.state.combatants[actorToken.id]) return { ok: false, reason: 'combatant-missing' }
  const actorCombatant = snapshot.state.combatants[actorToken.id]
  const fearSourceId = actorCombatant.classState.intimidatingPresenceSourceId
  const fearSourceToken = fearSourceId ? input.map.tokens.find((token) => token.id === fearSourceId) : undefined
  if (
    fearSourceToken &&
    tokenFootprintDistanceCells(actorToken, fearSourceToken, input.map) *
      Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL) > 60
  ) {
    actorCombatant.classState.intimidatingPresenceSourceId = undefined
    actorCombatant.classState.intimidatingPresenceRoundsRemaining = undefined
    actorCombatant.classState.activeEffects = removeDnd5eActiveEffectsByStandardCondition({
      effects: actorCombatant.classState.activeEffects,
      condition: 'frightened',
    }).effects
    actorCombatant.conditions = dnd5eConditionsFromActiveEffects(actorCombatant.classState.activeEffects)
  }
  const activeEffectSavingThrows = (actorCombatant.classState.activeEffects ?? []).flatMap((effect) => {
    if (effect.repeatSave?.timing !== 'target-turn-end') return []
    const repeatSave = effect.repeatSave
    const source = effect.source.actorId ? snapshot.state.combatants[effect.source.actorId] : undefined
    let mode = dnd5eSavingThrowMode(actorCombatant, repeatSave.ability, {
      effectVisible: effect.visibility !== 'dm-only',
      sourceCreatureType: source?.creatureType,
      sourceIsSpell: effect.source.kind === 'spell',
    })
    const creatureType = (actorCombatant.creatureType ?? '').trim().toLowerCase()
    if (
      effect.source.rulesId === 'sunburst' &&
      (creatureType === 'undead' || creatureType.includes('亡灵') || creatureType === 'ooze' || creatureType.includes('泥怪'))
    ) mode = dnd5eHeightenedSavingThrowMode(mode, true)
    return [{
      effect,
      modifier: actorCombatant.savingThrowBonuses[repeatSave.ability] ??
        Math.floor((actorCombatant.abilities[repeatSave.ability] - 10) / 2),
      dc: repeatSave.dc,
      mode,
      blessed: dnd5eCombatantHasConcentrationEffect(snapshot.state, actorToken.id, 'bless'),
      baned: dnd5eCombatantHasConcentrationEffect(snapshot.state, actorToken.id, 'bane'),
    }]
  })
  const nextCombatantId = snapshot.state.initiativeOrder[(actorIndex + 1) % snapshot.state.initiativeOrder.length]
  const nextCombatant = snapshot.state.combatants[nextCombatantId]
  const nextMonster = nextCombatant?.statBlockId ? getDnd5eSrdMonster(nextCombatant.statBlockId) : undefined
  const nextMonsterRechargeRolls = nextCombatant ? dnd5eMonsterRechargeActions(nextMonster).flatMap((monsterAction) => {
    const usage = monsterAction.usage
    if (usage?.kind !== 'recharge' || nextCombatant.classState.monsterRechargeReadyByActionId?.[monsterAction.id] !== false) return []
    return [{
      actorId: nextCombatant.id,
      actorName: nextCombatant.name,
      actionId: monsterAction.id,
      actionName: monsterAction.name,
      dieSides: usage.dieSides,
      minimum: usage.minimum,
    }]
  }) : []
  const currentMonsterMechanicRolls = dnd5eEligibleMonsterMechanics(monster, 'turn-end', {
    combatId: snapshot.state.combatId,
    round: snapshot.state.round,
    actorId: actorCombatant.id,
    currentHp: actorCombatant.currentHp,
    maxHp: actorCombatant.maxHp,
    usedKeys: actorCombatant.classState.declarativeUsedTurnKeys,
  }).map((mechanic) => ({
    actorId: actorCombatant.id,
    actorName: actorCombatant.name,
    mechanicId: mechanic.id,
    mechanicName: mechanic.name,
    effects: dnd5eMonsterMechanicDiceRequirements(mechanic),
  }))
  const nextMonsterMechanicRolls = nextCombatant ? dnd5eEligibleMonsterMechanics(nextMonster, 'turn-start', {
    combatId: snapshot.state.combatId,
    round: actorIndex + 1 >= snapshot.state.initiativeOrder.length ? snapshot.state.round + 1 : snapshot.state.round,
    actorId: nextCombatant.id,
    currentHp: nextCombatant.currentHp,
    maxHp: nextCombatant.maxHp,
    usedKeys: nextCombatant.classState.declarativeUsedTurnKeys,
  }).map((mechanic) => ({
    actorId: nextCombatant.id,
    actorName: nextCombatant.name,
    mechanicId: mechanic.id,
    mechanicName: mechanic.name,
    effects: dnd5eMonsterMechanicDiceRequirements(mechanic),
  })) : []
  const turnStartActiveEffectSavingThrows = (nextCombatant?.classState.activeEffects ?? []).flatMap((effect) => {
    if (effect.repeatSave?.timing !== 'target-turn-start') return []
    const repeatSave = effect.repeatSave
    const source = effect.source.actorId ? snapshot.state.combatants[effect.source.actorId] : undefined
    return [{
      effect,
      targetId: nextCombatant.id,
      targetName: nextCombatant.name,
      modifier: nextCombatant.savingThrowBonuses[repeatSave.ability] ??
        Math.floor((nextCombatant.abilities[repeatSave.ability] - 10) / 2),
      dc: repeatSave.dc,
      mode: dnd5eSavingThrowMode(nextCombatant, repeatSave.ability, {
        effectVisible: effect.visibility !== 'dm-only',
        sourceCreatureType: source?.creatureType,
        sourceIsSpell: effect.source.kind === 'spell',
      }),
      blessed: dnd5eCombatantHasConcentrationEffect(snapshot.state, nextCombatant.id, 'bless'),
      baned: dnd5eCombatantHasConcentrationEffect(snapshot.state, nextCombatant.id, 'bane'),
    }]
  })
  return {
    ok: true,
    prepared: {
      actor,
      actorName: actor?.name ?? actorToken.label,
      actorToken,
      state: { ...snapshot.state, initiativeIndex: actorIndex },
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      activeEffectSavingThrows,
      turnStartActiveEffectSavingThrows,
      nextMonsterRechargeRolls,
      currentMonsterMechanicRolls,
      nextMonsterMechanicRolls,
    },
  }
}

export function resolveDnd5ePlayerEndTurn(input: {
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  activeEffectSavingThrows?: readonly Dnd5eActiveEffectSavingThrowRoll[]
  turnStartActiveEffectSavingThrows?: readonly Dnd5eActiveEffectSavingThrowRoll[]
  nextMonsterRechargeRolls?: readonly Dnd5eMonsterRechargeRoll[]
  currentMonsterMechanicRolls?: readonly Dnd5eMonsterMechanicRoll[]
  nextMonsterMechanicRolls?: readonly Dnd5eMonsterMechanicRoll[]
}): {
  ok: true
  actor?: Character
  actorName: string
  actorToken: Token
  result: Dnd5eActionResult
  application: Dnd5eMapResultPlan
} | { ok: false; reason: Dnd5eEndTurnRejectReason } {
  const prepared = prepareDnd5ePlayerEndTurn(input)
  if (!prepared.ok) return prepared
  const { actor, actorName, actorToken, state, characterIdByCombatantId } = prepared.prepared
  const result = resolveDnd5eHeadlessAction(
    state,
    {
      type: 'end-turn', actorId: actorToken.id,
      activeEffectSavingThrows: input.activeEffectSavingThrows,
      turnStartActiveEffectSavingThrows: input.turnStartActiveEffectSavingThrows,
      currentMonsterMechanicRolls: input.currentMonsterMechanicRolls,
      nextMonsterRechargeRolls: input.nextMonsterRechargeRolls,
      nextMonsterMechanicRolls: input.nextMonsterMechanicRolls,
    },
  )
  if (!result.ok) return { ok: false, reason: 'invalid-action' }
  return {
    ok: true,
    actor,
    actorName,
    actorToken,
    result,
    application: planDnd5eMapResultApplication({
      state: result.state,
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId,
    }),
  }
}
