import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type {
  Dnd5eAdjudicatedSpellPayload,
  Dnd5eTurnEconomyCounts,
  SharedPlayerActionState,
} from '../../lib/sharedCombatTypes'
import type {
  DmAdjudicationEffect,
  DmAdjudicationInterruptResponse,
} from '../../lib/combatInterruptProtocol'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { dnd5eClassDefinitionForCharacter, dnd5ePactSlotLevel } from './classes'
import {
  resolveDnd5eHeadlessAction,
  type Dnd5eActionResult,
  type Dnd5eHeadlessCombatState,
} from './headlessCombatEngine'
import {
  createDnd5eMapCombatSnapshot,
  planDnd5eMapResultApplication,
  type Dnd5eMapResultPlan,
} from './mapBridge'
import {
  dnd5eFreeSpellCastSource,
  dnd5eSelectedSpellIds,
} from './spells'
import type { Dnd5eSpellbookEntry } from './spellbook'

export type Dnd5eAdjudicatedSpellRejectReason =
  | 'invalid-action'
  | 'invalid-actor'
  | 'spell-unavailable'
  | 'slot-unavailable'
  | 'action-unavailable'
  | 'bonus-action-unavailable'
  | 'combatant-missing'
  | 'invalid-adjudication'

export interface PreparedDnd5eAdjudicatedSpell {
  action: SharedPlayerActionState
  payload: Dnd5eAdjudicatedSpellPayload
  spell: Dnd5eSpellbookEntry
  castingTime: 'action' | 'bonus-action'
  concentration: boolean
  suggestedConcentrationRounds?: number
  description: string
  map: BattleMap
  characters: readonly Character[]
  characterIdByCombatantId: Record<string, string>
  state: Dnd5eHeadlessCombatState
  actor: Character
  actorToken: Token
  slotLevel: number
}

export function dnd5eSpellbookEntryCastingTime(
  spell: Dnd5eSpellbookEntry,
): 'action' | 'bonus-action' | 'reaction' | 'unsupported' {
  if (spell.imported) {
    if (spell.imported.castingTime.value !== 1) return 'unsupported'
    const unit = spell.imported.castingTime.unit
    return unit === 'action' || unit === 'bonus-action' || unit === 'reaction' ? unit : 'unsupported'
  }
  const value = spell.reference?.castingTime ?? ''
  if (/附赠动作|bonus\s*action/i.test(value)) return 'bonus-action'
  if (/反应|reaction/i.test(value)) return 'reaction'
  if (/动作|action/i.test(value)) return 'action'
  return 'unsupported'
}

export function dnd5eSpellbookEntryIsConcentration(spell: Dnd5eSpellbookEntry): boolean {
  return spell.imported?.duration.concentration === true || /专注|concentration/i.test(spell.reference?.duration ?? '')
}

export function dnd5eSpellbookEntrySuggestedConcentrationRounds(
  spell: Dnd5eSpellbookEntry,
): number | undefined {
  if (!dnd5eSpellbookEntryIsConcentration(spell)) return undefined
  if (spell.imported?.duration.type === 'timed') {
    const value = Math.max(1, Math.floor(spell.imported.duration.value ?? 1))
    const multiplier = spell.imported.duration.unit === 'round'
      ? 1
      : spell.imported.duration.unit === 'minute'
        ? 10
        : spell.imported.duration.unit === 'hour'
          ? 600
          : 14_400
    return Math.min(14_400, value * multiplier)
  }
  const duration = spell.reference?.duration ?? ''
  const amount = Math.max(1, Number(duration.match(/\d+/)?.[0] ?? 1))
  if (/轮|round/i.test(duration)) return Math.min(14_400, amount)
  if (/分钟|minute/i.test(duration)) return Math.min(14_400, amount * 10)
  if (/小时|hour/i.test(duration)) return Math.min(14_400, amount * 600)
  if (/日|天|day/i.test(duration)) return 14_400
  return 10
}

export function dnd5eSpellbookEntryDescription(spell: Dnd5eSpellbookEntry): string {
  const description = spell.imported?.description ?? spell.reference?.description ?? ''
  const higherLevels = spell.imported?.higherLevels ?? spell.reference?.higherLevels
  return higherLevels ? `${description}\n\n升环施法：${higherLevels}` : description
}

export function prepareDnd5eAdjudicatedSpell(input: {
  action: SharedPlayerActionState
  spell: Dnd5eSpellbookEntry | undefined
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  turnEconomy?: Dnd5eTurnEconomyCounts
  turnEconomyByToken?: Readonly<Record<string, Dnd5eTurnEconomyCounts>>
}): { ok: true; prepared: PreparedDnd5eAdjudicatedSpell } | { ok: false; reason: Dnd5eAdjudicatedSpellRejectReason } {
  const payload = input.action.dnd5eAdjudicatedSpell
  if (input.action.type !== 'dnd5e-adjudicated-spell' || !payload || !input.spell || input.spell.headless) {
    return { ok: false, reason: 'invalid-action' }
  }
  if (
    payload.spellId !== input.spell.id || !Number.isInteger(payload.slotLevel) ||
    payload.slotLevel < 0 || payload.slotLevel > 9
  ) return { ok: false, reason: 'invalid-action' }
  const actor = input.characters.find((character) => character.id === input.action.characterId)
  const actorToken = input.map.tokens.find((token) =>
    token.id === input.action.actorTokenId && token.characterId === input.action.characterId,
  )
  if (!actor || !actorToken || actor.currentHp <= 0) return { ok: false, reason: 'invalid-actor' }
  const definition = dnd5eClassDefinitionForCharacter(actor)
  if (
    !definition?.spellcasting || !dnd5eSelectedSpellIds(actor).includes(input.spell.id) ||
    (actor.dnd5eCombatState?.wildShapeFormId && (definition.id !== 'druid' || actor.level < 18))
  ) return { ok: false, reason: 'spell-unavailable' }
  const castingTime = dnd5eSpellbookEntryCastingTime(input.spell)
  if (castingTime === 'reaction' || castingTime === 'unsupported') return { ok: false, reason: 'invalid-action' }

  const slotLevel = input.spell.level === 0
    ? 0
    : definition.spellcasting.kind === 'pact' && input.spell.level <= 5
      ? dnd5ePactSlotLevel(actor.level)
      : payload.slotLevel
  const selections = actor.dnd5eClassChoices?.classes?.[definition.id]?.selections ?? {}
  if (input.spell.level > 0) {
    const resourceKey = definition.spellcasting.kind === 'pact' && input.spell.level <= 5
      ? 'dnd5e-pact-slot'
      : `dnd5e-spell-slot-${slotLevel}`
    const freeCastSource = dnd5eFreeSpellCastSource({
      classId: definition.id,
      level: actor.level,
      classSelections: selections,
      classResources: actor.classResources ?? {},
    }, { id: input.spell.id, level: input.spell.level }, slotLevel)
    if (
      slotLevel < input.spell.level ||
      (!freeCastSource && (actor.classResources?.[resourceKey]?.current ?? 0) < 1)
    ) return { ok: false, reason: 'slot-unavailable' }
  }
  if (input.turnEconomy) {
    if (castingTime === 'action' && input.turnEconomy.action.current < 1) {
      return { ok: false, reason: 'action-unavailable' }
    }
    if (castingTime === 'bonus-action' && input.turnEconomy.bonusAction.current < 1) {
      return { ok: false, reason: 'bonus-action-unavailable' }
    }
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
  const actorCombatant = snapshot.state.combatants[actorToken.id]
  if (actorIndex < 0 || !actorCombatant) return { ok: false, reason: 'combatant-missing' }
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
  return {
    ok: true,
    prepared: {
      action: input.action,
      payload,
      spell: input.spell,
      castingTime,
      concentration: dnd5eSpellbookEntryIsConcentration(input.spell),
      suggestedConcentrationRounds: dnd5eSpellbookEntrySuggestedConcentrationRounds(input.spell),
      description: dnd5eSpellbookEntryDescription(input.spell),
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      state: { ...snapshot.state, initiativeIndex: actorIndex },
      actor,
      actorToken,
      slotLevel,
    },
  }
}

function sanitizeEffects(
  prepared: PreparedDnd5eAdjudicatedSpell,
  effects: readonly DmAdjudicationEffect[],
) {
  return effects.slice(0, 32).map((effect) => ({
    targetId: effect.targetTokenId,
    ...(effect.operation ? { operation: effect.operation } : {}),
    ...(effect.amount != null ? { amount: effect.amount } : {}),
    ...(effect.addCondition?.trim() ? { addCondition: effect.addCondition.trim() } : {}),
    ...(effect.removeCondition?.trim() ? { removeCondition: effect.removeCondition.trim() } : {}),
  })).filter((effect) => {
    const token = prepared.map.tokens.find((candidate) => candidate.id === effect.targetId)
    return !!token && token.type !== 'obstacle'
  })
}

export function resolvePreparedDnd5eAdjudicatedSpell(input: {
  prepared: PreparedDnd5eAdjudicatedSpell
  response: DmAdjudicationInterruptResponse
}): { result: Dnd5eActionResult; application?: Dnd5eMapResultPlan } {
  const { prepared, response } = input
  if (response.decision !== 'approved') {
    return {
      result: {
        ok: false,
        state: prepared.state,
        events: [],
        reason: 'invalid-class-feature',
      },
    }
  }
  const effects = sanitizeEffects(prepared, Array.isArray(response.effects) ? response.effects : [])
  if (effects.length !== response.effects.length) {
    return {
      result: { ok: false, state: prepared.state, events: [], reason: 'invalid-target' },
    }
  }
  const concentrationRounds = prepared.concentration && response.concentrationRounds != null
    ? response.concentrationRounds
    : undefined
  const result = resolveDnd5eHeadlessAction(prepared.state, {
    type: 'adjudicated-spell',
    actorId: prepared.actorToken.id,
    spellId: prepared.spell.id,
    spellName: prepared.spell.name,
    spellLevel: prepared.spell.level,
    slotLevel: prepared.slotLevel,
    castingTime: prepared.castingTime,
    effects,
    concentrationRounds,
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
