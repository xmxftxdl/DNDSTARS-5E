import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createDnd5eConditionEffect } from './activeEffects'
import {
  createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat,
  type Dnd5eAction, type Dnd5eMonsterActionRoll, type Dnd5eMonsterMultiattackStepResolutionV1,
  type Dnd5eMonsterOnHitEffectRoll,
} from './headlessCombatEngine'
import { DND5E_SRD_MONSTERS, dnd5eMonsterAreaSavingThrowVariants, type Dnd5eMonsterAction, type Dnd5eMonsterOnHitEffect } from './monsters'
import { dnd5eMonsterMultiattackConstraint } from './monsterMultiattackConstraints'

const cases = DND5E_SRD_MONSTERS.flatMap(monster => monster.actions
  .filter(action => action.automation === 'headless' && action.kind === 'multiattack')
  .flatMap(action => (action.randomRepeat ? [action.randomRepeat.minimum, action.randomRepeat.maximum] : [undefined])
    .map(repeat => ({ monster, action, repeat, label: `${monster.slug}:${action.id}${repeat == null ? '' : ':' + repeat}` }))))
const evidence: unknown[] = []

function onHitRoll(effect: Dnd5eMonsterOnHitEffect, targetId: string): Dnd5eMonsterOnHitEffectRoll {
  const roll: Dnd5eMonsterOnHitEffectRoll = { effectId: effect.id }
  if (effect.kind === 'saving-throw-damage') {
    roll.d20 = 1
    roll.damageRolls = effect.damage.map(damage => Array(damage.count).fill(1))
  } else if (effect.kind === 'saving-throw-condition' || effect.kind === 'saving-throw-instant-death') roll.d20 = 1
  else if ('savingThrow' in effect && effect.savingThrow) roll.d20 = 1
  else if (effect.kind === 'ability-score-reduction') roll.damageRolls = [Array(effect.reduction.count).fill(1)]
  else if (effect.kind === 'forced-movement') {
    roll.d20 = 1
    if (effect.resistance.kind === 'opposed-ability-check') roll.sourceD20 = 19
    roll.forcedMovement = { targetId, distanceFeet: 0, to: { x: 5, y: 0 } }
  }
  return roll
}

describe('every Headless catalog Multiattack settles its complete declared sequence', () => {
  it.each(cases)('$label', ({ monster, action, repeat, label }) => {
    const combatId = `multi-verification:${label}`
    const constraint = dnd5eMonsterMultiattackConstraint(monster.id, action.id)
    const sequence = action.randomRepeat ? Array(repeat).fill(action.randomRepeat.actionId) as string[] : [...action.sequence!]
    const children = sequence.map(id => monster.actions.find(candidate => candidate.id === id)!)
    expect(children.every(Boolean)).toBe(true)
    const actor = createDnd5eCombatant({
      id: 'actor', name: monster.name, controller: 'dm', statBlockId: monster.id,
      initiative: 30, abilities: monster.abilities, proficiencyBonus: 2,
      armorClass: monster.armorClass.value, maxHp: monster.hitPoints.average, currentHp: monster.hitPoints.average,
      temporaryHp: 0, speed: Math.max(monster.speed.walk, monster.speed.fly ?? 0),
      position: { x: 0, y: 0 }, concentrating: false, creatureType: monster.creatureType,
      sizeRank: ['微型', '小型', '中型', '大型', '超大型', '巨型'].indexOf(monster.size),
      airborne: constraint?.requiresActorAirborne,
      classState: {
        turnStartResolvedTurnKey: `${combatId}:1:actor`,
        monsterRechargeReadyByActionId: Object.fromEntries(monster.actions.filter(candidate => candidate.usage?.kind === 'recharge').map(candidate => [candidate.id, true])),
        monsterActionUsesByActionId: Object.fromEntries(monster.actions.flatMap(candidate => candidate.usage?.kind === 'per-day'
          ? [[candidate.id, { current: candidate.usage.max, max: candidate.usage.max }]] : [])),
      },
    })
    const targets = Array.from({ length: Math.max(2, sequence.length) }, (_, index) => createDnd5eCombatant({
      id: `target-${index}`, name: `target-${index}`, controller: 'player', initiative: 20 - index,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      proficiencyBonus: 2, armorClass: 1, currentHp: 100000, maxHp: 100000, temporaryHp: 0,
      speed: 30, position: { x: 5, y: 0 }, concentrating: false, creatureType: 'humanoid', sizeRank: 2,
    }))
    const producesRelation = children.some(child => child.attack?.onHitEffects?.some(effect => effect.kind === 'source-linked-condition'))
    if (!producesRelation) for (const child of children) {
      const condition = child.targetEligibility?.predicates.find(predicate => predicate.kind === 'standard-condition')
      if (condition?.kind === 'standard-condition') targets[0].classState.activeEffects = [createDnd5eConditionEffect({
        condition: condition.condition, targetId: targets[0].id, source: { kind: 'dm' },
      })]
    }
    let state = startDnd5eHeadlessCombat(combatId, [actor, ...targets])
    state.distanceFeetByCombatantPair = Object.fromEntries(targets.map(target => [`actor\u0000${target.id}`, 5]))
    const targetIds = sequence.map((_, index) => {
      const occurrence = constraint?.occurrences?.find(candidate => candidate.occurrenceIndex === index)
      return occurrence?.differentTargetFrom != null || occurrence?.differentTargetsFrom?.length ||
        occurrence?.preferDifferentTargetFrom != null ? `target-${index}` : 'target-0'
    })
    const weaponRoll = (child: Dnd5eMonsterAction, targetId: string, occurrenceIndex: number): Dnd5eMonsterActionRoll => {
      const sneak = monster.traits.find(trait => trait.rule?.kind === 'sneak-attack')?.rule
      return {
        targetId, d20: 19, d20Second: 19,
        damageRolls: child.attack!.damage.map(damage => Array(damage.count).fill(1)),
        onHitEffectRolls: child.attack!.onHitEffects?.map(effect => onHitRoll(effect, targetId)),
        traitDamageRolls: occurrenceIndex === 0 && monster.traits.some(trait => trait.rule?.kind === 'assassinate') && sneak?.kind === 'sneak-attack'
          ? [{ traitId: 'sneak-attack', rolls: Array(sneak.extraDamage.count).fill(1) }] : undefined,
      }
    }
    for (const requirement of constraint?.requiredSourceLinkedRelationsAtStart ?? []) {
      const producer = monster.actions.find(candidate => candidate.attack?.onHitEffects?.some(effect =>
        effect.kind === 'source-linked-condition' && effect.relation.slotGroup === requirement.slotGroup))!
      expect(producer).toBeDefined()
      for (let index = 0; index < requirement.count; index++) {
        const prepared = resolveDnd5eHeadlessAction(state, { type: 'monster-action', actorId: 'actor', actionId: producer.id, rolls: [weaponRoll(producer, `target-${index}`, 1)] })
        expect(prepared.ok, `${label}: relation prerequisite`).toBe(true)
        state = prepared.state
        state.combatants.actor.turn.actionAvailable = true
      }
    }
    for (const child of children) if (child.requiredActiveEffectDefinitionId) {
      const buff = monster.actions.find(candidate => child.requiredActiveEffectDefinitionId === `monster:${monster.id}:${candidate.id}:self-combat-buff`)!
      expect(buff).toBeDefined()
      const prepared = resolveDnd5eHeadlessAction(state, { type: 'monster-special-action', actorId: 'actor', actionId: buff.id })
      expect(prepared.ok).toBe(true)
      state = prepared.state
      state.combatants.actor.turn.actionAvailable = true
    }
    const steps: Dnd5eMonsterMultiattackStepResolutionV1[] = children.map((child, index) => {
      const targetId = targetIds[index]
      if (child.attack) return { kind: 'weapon', actionId: child.id, roll: weaponRoll(child, targetId, index) }
      if (child.rule?.kind === 'area-saving-throw') {
        const variant = dnd5eMonsterAreaSavingThrowVariants(child)[0]
        return { kind: 'area', actionId: child.id, resolution: {
          schemaVersion: 1, variantId: variant.id, targetIds: [targetId],
          targetSavingThrows: [{ targetId, d20: 1, d20Second: 1 }],
          damageRolls: variant.damage ? Array(variant.damage.count).fill(1) : [],
        } }
      }
      if (child.rule?.kind === 'source-linked-reel') return { kind: 'special', actionId: child.id,
        forcedMovements: [{ targetId: 'target-0', distanceFeet: 0, to: { x: 5, y: 0 } }] }
      if (child.rule?.kind === 'throw-linked-target') return {
        kind: 'special',
        actionId: child.id,
        targetId,
        forcedMovements: [{ targetId, distanceFeet: 10, to: { x: 15, y: 0 } }],
        damageRolls: [1],
      }
      if (child.rule?.kind === 'source-linked-engulf') return { kind: 'special', actionId: child.id, targetId }
      return { kind: 'special', actionId: child.id, targetId,
        d20: child.rule?.kind === 'saving-throw-condition' ? Math.min(20, child.rule.dc - 1) : 1 }
    })
    const payload: Dnd5eAction = steps.every(step => step.kind === 'weapon')
      ? { type: 'monster-action', actorId: 'actor', actionId: action.id, randomRepeatRoll: repeat,
        rolls: steps.flatMap(step => step.kind === 'weapon' ? [step.roll] : []) }
      : { type: 'monster-multiattack-composite', schemaVersion: 1, actorId: 'actor', actionId: action.id, steps }
    const resolved = resolveDnd5eHeadlessAction(state, payload)
    evidence.push({ slug: monster.slug, monsterId: monster.id, actionId: action.id, scenario: repeat == null ? 'complete-sequence' : `repeat-${repeat}`,
      ok: resolved.ok, reason: resolved.ok ? undefined : resolved.reason, sequence,
      events: resolved.events, conditions: resolved.state.combatants['target-0'].conditions })
    expect(resolved.ok, `${label}: ${resolved.ok ? '' : resolved.reason}`).toBe(true)
    const attackEvents = resolved.events.filter(event => event.type === 'attack-resolved')
    expect(attackEvents.map(event => event.total)).toEqual(children.filter(child => child.attack).map(child => 19 + child.attack!.toHit))
    expect(resolved.state.combatants.actor.turn.actionAvailable).toBe(false)
    expect(resolved.events.filter(event => event.type === 'turn-resource-spent' && event.resource === 'action')).toHaveLength(1)
    const repeated = resolveDnd5eHeadlessAction(resolved.state, payload)
    expect(repeated.ok, 'a second parent action must not bypass economy').toBe(false)
    expect(repeated.state.combatants).toEqual(resolved.state.combatants)
  })
})

afterAll(() => {
  const destination = process.env.STARS_MONSTER_INVENTORY_DIR
  if (!destination) return
  const directory = path.resolve(destination)
  if (path.relative(process.cwd(), directory).startsWith('..')) throw new Error('evidence destination must be inside repository')
  mkdirSync(directory, { recursive: true })
  writeFileSync(path.join(directory, 'multiattack-runtime.json'), JSON.stringify(evidence, null, 2))
})
