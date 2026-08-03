import {
  appendRollLedgerEntry,
  commitCombatTransaction,
  createCombatTransaction,
  rollbackCombatTransaction,
  type CombatTransaction,
  type RollLedgerKind,
} from '../../lib/combatTransaction'
import { dnd5ePluginHeadlessActionDefinition } from './pluginApi'
import { getDnd5eSrdCombatSpell } from './spells'
import { dnd5eMonsterAreaSavingThrowEffect, getDnd5eSrdMonster } from './monsters'
import { dnd5eMonsterMultiattackRuntimeActionIds } from './monsterDynamicMultiattack'
import type { Dnd5eAction, Dnd5eActionResult, Dnd5eHeadlessCombatState } from './headlessCombatEngine'

export interface Dnd5eHeadlessTransactionOptions {
  transaction?: CombatTransaction
  transactionId?: string
  mapId?: string
  now?: number
}

let automaticTransactionSequence = 0

export function beginDnd5eHeadlessActionTransaction(
  state: Dnd5eHeadlessCombatState,
  action: Dnd5eAction,
  options: Dnd5eHeadlessTransactionOptions = {},
): CombatTransaction {
  const now = options.now ?? Date.now()
  const actionId = options.transactionId ?? (action.type === 'plugin' ? action.transactionId : undefined) ?? nextActionId(state, action)
  let transaction = options.transaction ?? createCombatTransaction({
    id: actionId,
    mapId: options.mapId ?? state.mapId ?? state.combatId,
    combatId: state.combatId,
    actorId: action.actorId,
    actionId,
    actionKind: action.type,
    now,
  })
  for (const entry of actionRollLedgerEntries(state, action, now)) {
    const indexedMonsterOnHitRoll = entry.id.includes(':on-hit:')
    if (transaction.rollLedger.entries.some((candidate) =>
      candidate.id === entry.id || (!indexedMonsterOnHitRoll && (
        candidate.kind === entry.kind && candidate.dice.sides === entry.dice.sides &&
        candidate.dice.values.length === entry.dice.values.length &&
        candidate.dice.values.every((value, index) => value === entry.dice.values[index])
      ))
    )) continue
    transaction = appendRollLedgerEntry(transaction, entry)
  }
  return transaction
}

export function settleDnd5eHeadlessActionTransaction(
  transaction: CombatTransaction,
  result: Dnd5eActionResult,
  now = Date.now(),
): CombatTransaction {
  if (transaction.status === 'committed' || transaction.status === 'rolled-back') return transaction
  return result.ok
    ? commitCombatTransaction(transaction, now)
    : rollbackCombatTransaction(transaction, result.reason, now)
}

function nextActionId(state: Dnd5eHeadlessCombatState, action: Dnd5eAction): string {
  automaticTransactionSequence += 1
  return `${state.combatId}:${state.round}:${state.initiativeIndex}:${action.actorId}:${action.type}:${automaticTransactionSequence}`
}

function actionRollLedgerEntries(state: Dnd5eHeadlessCombatState, action: Dnd5eAction, now: number) {
  const entries: Array<Parameters<typeof appendRollLedgerEntry>[1]> = []
  const seen = new Set<string>()
  const add: AddLedgerEntry = (input) => {
    if (seen.has(input.id) || input.values.length < 1) return
    if (input.values.some((value) => !Number.isInteger(value) || value < 1 || value > input.sides)) return
    seen.add(input.id)
    entries.push({
      id: input.id,
      kind: input.kind,
      label: input.label,
      dice: { sides: input.sides, values: [...input.values] },
      modifier: input.modifier ?? 0,
      visibility: 'public',
      sourceId: input.sourceId,
      targetId: input.targetId,
      createdAt: now,
    })
  }
  const actionKey = `${action.actorId}:${action.type}`
  collectNamedDice(action, actionKey, add)
  collectStructuredDice(action, actionKey, add)
  for (const [combatantId, values] of Object.entries(
    action.airborneFallDamageRollsByCombatantId ?? {},
  ).sort(([left], [right]) => left.localeCompare(right))) {
    add({
      id: `${actionKey}:unsupported-airborne-fall:${combatantId}`,
      kind: 'damage',
      label: 'unsupported airborne fall',
      sides: 6,
      values,
      sourceId: action.actorId,
      targetId: combatantId,
    })
  }

  if (action.type === 'cast-spell') {
    const spell = getDnd5eSrdCombatSpell(action.spellId)
    if (spell && action.effectRolls.length > 0) {
      const kind: RollLedgerKind = spell.effect === 'healing'
        ? 'healing'
        : spell.effect === 'sleep-hit-point-pool' || spell.effect === 'color-spray-hit-point-pool'
          ? 'other'
          : 'damage'
      add({ id: `${actionKey}:effect`, kind, label: spell.name, sides: spell.dice.sides, values: action.effectRolls, sourceId: action.actorId, targetId: action.targetId })
    }
    for (const [index, attack] of (action.targetAttacks ?? []).entries()) {
      if (spell && attack.effectRolls.length > 0) add({ id: `${actionKey}:target-attacks:${index}:effect`, kind: 'damage', label: spell.name, sides: spell.dice.sides, values: attack.effectRolls, sourceId: action.actorId, targetId: attack.targetId })
    }
  }
  if (action.type === 'item-area-trigger' && action.damageRolls?.length) {
    add({ id: `${actionKey}:item-damage`, kind: 'damage', label: action.areaKind, sides: 4, values: action.damageRolls, sourceId: action.areaId, targetId: action.actorId })
  }
  if (action.type === 'monster-action') {
    const monster = getDnd5eSrdMonster(state.combatants[action.actorId]?.statBlockId ?? '')
    const selected = monster?.actions.find((candidate) => candidate.id === action.actionId)
    const actor = state.combatants[action.actorId]
    const attackIds = selected?.kind === 'multiattack'
      ? monster && actor
        ? dnd5eMonsterMultiattackRuntimeActionIds({
            monster,
            action: selected,
            actor,
            randomRepeatCount: action.randomRepeatRoll,
          }) ?? []
        : []
      : selected ? [selected.id] : []
    if (selected?.randomRepeat && action.randomRepeatRoll != null) {
      add({
        id: `${actionKey}:monster:repeat-count`,
        kind: 'other',
        label: `${selected.name} attack count`,
        sides: selected.randomRepeat.dieSides,
        values: [action.randomRepeatRoll],
        sourceId: action.actorId,
      })
    }
    for (const [attackIndex, supplied] of action.rolls.entries()) {
      const attack = monster?.actions.find((candidate) => candidate.id === attackIds[attackIndex])?.attack
      for (const [damageIndex, values] of supplied.damageRolls.entries()) {
        const definition = attack?.damage[damageIndex]
        if (!definition) continue
        add({ id: `${actionKey}:monster:${attackIndex}:damage:${damageIndex}`, kind: 'damage', label: `${selected?.name ?? action.actionId} damage`, sides: definition.sides, values, sourceId: action.actorId, targetId: supplied.targetId })
      }
      for (const resolution of supplied.onHitEffectRolls ?? []) {
        const effect = attack?.onHitEffects?.find((candidate) => candidate.id === resolution.effectId)
        if (
          !effect ||
          resolution.d20 == null
        ) continue
        if (
          effect.kind === 'forced-movement' &&
          effect.resistance.kind === 'opposed-ability-check'
        ) {
          if (resolution.sourceD20 != null) {
            add({
              id: `${actionKey}:monster:${attackIndex}:on-hit:${effect.id}:source-check`,
              kind: 'ability-check',
              label: `${selected?.name ?? action.actionId} ${effect.id} source check`,
              sides: 20,
              values: resolution.sourceD20Second == null
                ? [resolution.sourceD20]
                : [resolution.sourceD20, resolution.sourceD20Second],
              sourceId: action.actorId,
            })
          }
          add({
            id: `${actionKey}:monster:${attackIndex}:on-hit:${effect.id}:target-check`,
            kind: 'ability-check',
            label: `${selected?.name ?? action.actionId} ${effect.id} target check`,
            sides: 20,
            values: resolution.d20Second == null
              ? [resolution.d20]
              : [resolution.d20, resolution.d20Second],
            targetId: supplied.targetId,
          })
        } else {
          add({
            id: `${actionKey}:monster:${attackIndex}:on-hit:${effect.id}:save`,
            kind: 'saving-throw',
            label: `${selected?.name ?? action.actionId} ${effect.id} save`,
            sides: 20,
            values: resolution.d20Second == null
              ? [resolution.d20]
              : [resolution.d20, resolution.d20Second],
            targetId: supplied.targetId,
          })
        }
        if ((resolution.forcedMovement?.fallingDamageRolls?.length ?? 0) > 0) {
          add({
            id: `${actionKey}:monster:${attackIndex}:on-hit:${effect.id}:falling-damage`,
            kind: 'damage',
            label: `${selected?.name ?? action.actionId} falling damage`,
            sides: 6,
            values: resolution.forcedMovement!.fallingDamageRolls!,
            targetId: supplied.targetId,
          })
        }
        if (effect.kind !== 'saving-throw-damage') continue
        for (const [damageIndex, values] of (resolution.damageRolls ?? []).entries()) {
          const definition = effect.damage[damageIndex]
          if (!definition) continue
          add({
            id: `${actionKey}:monster:${attackIndex}:on-hit:${effect.id}:damage:${damageIndex}`,
            kind: 'damage',
            label: `${selected?.name ?? action.actionId} ${effect.id} damage`,
            sides: definition.sides,
            values,
            modifier: definition.bonus,
            sourceId: action.actorId,
            targetId: supplied.targetId,
          })
        }
      }
    }
  }
  if (action.type === 'monster-area-action') {
    const monster = getDnd5eSrdMonster(state.combatants[action.actorId]?.statBlockId ?? '')
    const selected = monster?.actions.find((candidate) => candidate.id === action.actionId)
    const variant = selected
      ? dnd5eMonsterAreaSavingThrowEffect(selected, action.resolution.variantId)
      : undefined
    if (variant?.damage && action.resolution.damageRolls.length > 0) {
      add({
        id: `${actionKey}:area:${variant.id}:damage`,
        kind: 'damage',
        label: `${variant.name} damage`,
        sides: variant.damage.sides,
        values: action.resolution.damageRolls,
        modifier: variant.damage.bonus,
        sourceId: action.actorId,
      })
    }
  }
  if (action.type === 'plugin' && action.rolls) {
    const definition = dnd5ePluginHeadlessActionDefinition(action.pluginId, action.actionId)
    for (const declaration of definition?.rolls ?? []) {
      const roll = action.rolls[declaration.id]
      if (!roll) continue
      add({ id: `${actionKey}:plugin:${declaration.id}`, kind: 'other', label: declaration.label, sides: declaration.sides, values: roll.values, modifier: roll.modifier, sourceId: action.actorId, targetId: action.targetId })
    }
  }
  return entries
}

type AddLedgerEntry = (input: {
  id: string
  kind: RollLedgerKind
  label: string
  sides: number
  values: readonly number[]
  modifier?: number
  sourceId?: string
  targetId?: string
}) => void

function collectNamedDice(value: unknown, path: string, add: AddLedgerEntry): void {
  if (!value || typeof value !== 'object') return
  const record = value as Record<string, unknown>
  const nestedOnHitEffect = path.toLowerCase().includes(':onhiteffectrolls:')
  const pairedKeys = new Set<string>()
  for (const [key, child] of Object.entries(record)) {
    if (nestedOnHitEffect && key.toLowerCase() === 'd20') continue
    if (typeof child !== 'number' || !key.toLowerCase().endsWith('d20') || key.toLowerCase().endsWith('secondd20')) continue
    const secondKey = `${key}Second`
    const alternateSecondKey = key.replace(/D20$/i, 'D20Second')
    const second = record[secondKey] ?? record[alternateSecondKey]
    const values = typeof second === 'number' ? [child, second] : [child]
    pairedKeys.add(key)
    if (typeof second === 'number') pairedKeys.add(typeof record[secondKey] === 'number' ? secondKey : alternateSecondKey)
    add({ id: `${path}:${key}`, kind: namedRollKind(`${path}:${key}`), label: key, sides: 20, values })
  }
  for (const [key, child] of Object.entries(record)) {
    if (nestedOnHitEffect && (key.toLowerCase() === 'd20' || key.toLowerCase() === 'd20second')) continue
    if (pairedKeys.has(key)) continue
    const childPath = `${path}:${key}`
    if (typeof child === 'number') {
      const sides = namedDieSides(key)
      if (sides) add({ id: childPath, kind: namedRollKind(childPath), label: key, sides, values: [child] })
    } else if (Array.isArray(child)) {
      for (const [index, item] of child.entries()) collectNamedDice(item, `${childPath}:${index}`, add)
    } else collectNamedDice(child, childPath, add)
  }
}

function collectStructuredDice(value: unknown, path: string, add: AddLedgerEntry): void {
  if (!value || typeof value !== 'object') return
  const record = value as Record<string, unknown>
  if (Number.isInteger(record.sides) && Array.isArray(record.rolls)) {
    add({
      id: `${path}:dice`,
      kind: path.toLowerCase().includes('heal') ? 'healing' : 'damage',
      label: path.split(':').at(-1) ?? 'dice',
      sides: record.sides as number,
      values: record.rolls.filter((entry): entry is number => typeof entry === 'number'),
      modifier: typeof record.bonus === 'number' ? record.bonus : 0,
    })
  }
  for (const [key, child] of Object.entries(record)) {
    if (Array.isArray(child)) {
      for (const [index, item] of child.entries()) collectStructuredDice(item, `${path}:${key}:${index}`, add)
    } else collectStructuredDice(child, `${path}:${key}`, add)
  }
}

function namedDieSides(key: string): number | undefined {
  const normalized = key.toLowerCase()
  if (normalized.includes('d20')) return 20
  if (normalized.includes('d100')) return 100
  if (normalized.includes('d10') || normalized.includes('darkonesownluck')) return 10
  if (normalized.includes('blessroll') || normalized.includes('baneroll')) return 4
  return undefined
}

function namedRollKind(key: string): RollLedgerKind {
  const normalized = key.toLowerCase()
  if (normalized.includes('ability-check')) return 'ability-check'
  if (normalized.includes('saving') || normalized.includes('save')) return 'saving-throw'
  if (
    normalized.includes(':attack:') || normalized.includes(':opportunity-attack:') ||
    normalized.includes(':monster-action:') || normalized.includes(':cast-spell:') ||
    normalized.endsWith(':d20') || normalized.endsWith(':d20second')
  ) return 'attack'
  return 'other'
}
