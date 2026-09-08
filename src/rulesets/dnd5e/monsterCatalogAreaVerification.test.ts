import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import {
  createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat,
  type Dnd5eAction,
} from './headlessCombatEngine'
import { DND5E_SRD_MONSTERS, dnd5eMonsterAreaSavingThrowVariants } from './monsters'

const cases = DND5E_SRD_MONSTERS.flatMap(monster => (['actions', 'legendaryActions'] as const).flatMap(section => (monster[section] ?? [])
  .filter(action => action.automation === 'headless' && action.rule?.kind === 'area-saving-throw')
  .flatMap(action => dnd5eMonsterAreaSavingThrowVariants(action).flatMap(variant =>
    ['failed-save', 'successful-save', 'duplicate-target', ...(variant.forcedMovementOnSuccessfulSave ? ['successful-save-blocked-exit'] : []), ...(action.usage || section === 'legendaryActions' ? ['exhausted-resource'] : [])]
      .map(branch => ({ monster, action, section, variant, branch, label: `${monster.slug}:${section}:${action.id}:${variant.id}:${branch}` }))))))
const evidence: unknown[] = []

describe('catalog area actions execute each save and resource branch', () => {
  it.each(cases)('$label', ({ monster, action, section, variant, branch, label }) => {
    const combatId = `area-verification:${label}`
    const successful = branch.startsWith('successful-save')
    const actor = createDnd5eCombatant({
      id: 'actor', name: monster.name, controller: 'dm', statBlockId: monster.id,
      initiative: 20, abilities: monster.abilities, proficiencyBonus: 2,
      armorClass: monster.armorClass.value, maxHp: monster.hitPoints.average,
      currentHp: monster.hitPoints.average, temporaryHp: 0, speed: monster.speed.walk,
      position: { x: 0, y: 0 }, concentrating: false, creatureType: monster.creatureType,
      sizeRank: ['微型', '小型', '中型', '大型', '超大型', '巨型'].indexOf(monster.size),
      classState: {
        turnStartResolvedTurnKey: `${combatId}:1:actor`,
        monsterLegendaryActionPoints: branch === 'exhausted-resource' ? 0 : monster.legendaryActionPoints ?? 3,
        monsterRechargeReadyByActionId: { [action.id]: branch !== 'exhausted-resource' },
        monsterActionUsesByActionId: action.usage?.kind === 'per-day' ? { [action.id]: {
          current: branch === 'exhausted-resource' ? 0 : action.usage.max -
            (action.rule?.kind === 'area-saving-throw' && 'orderedVariantIds' in action.rule && action.rule.orderedVariantIds
              ? action.rule.orderedVariantIds.indexOf(variant.id) : 0), max: action.usage.max,
        } } : {},
      },
    })
    const targets = Array.from({
      length: variant.allowRepeatedTargetSelections ? 2 : Math.max(1, variant.minimumTargets ?? 1),
    }, (_, index) => createDnd5eCombatant({
      id: `target-${index}`, name: `target-${index}`, controller: 'player', initiative: 10 - index,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      savingThrowBonuses: { [variant.ability]: successful ? 40 : -10 },
      proficiencyBonus: 2, armorClass: 1, maxHp: 100000, currentHp: 100000, temporaryHp: 0,
      speed: 30, position: { x: 5, y: index * 5 }, concentrating: false, creatureType: 'humanoid', sizeRank: 2,
    }))
    let state = startDnd5eHeadlessCombat(combatId, [actor, ...targets])
    if (variant.sourceLinkedTargets) {
      const prerequisite = monster.actions.find(candidate => candidate.attack?.onHitEffects?.some(effect =>
        effect.kind === 'source-linked-condition' && effect.relation.slotGroup === variant.sourceLinkedTargets!.slotGroup))!
      for (const target of targets) {
        const prepared = resolveDnd5eHeadlessAction(state, {
          type: 'monster-action', actorId: actor.id, actionId: prerequisite.id,
          rolls: [{ targetId: target.id, d20: 19, d20Second: 19,
            damageRolls: prerequisite.attack!.damage.map(damage => Array(damage.count).fill(1)),
            onHitEffectRolls: prerequisite.attack!.onHitEffects?.map(effect => ({ effectId: effect.id })) }],
        })
        expect(prepared.ok, 'source relation prerequisite').toBe(true)
        state = prepared.state
        state.combatants.actor.turn.actionAvailable = true
      }
    }
    if (section === 'legendaryActions') state.initiativeIndex = 1
    const targetIds = variant.allowRepeatedTargetSelections
      ? Array.from(
          { length: Math.max(1, variant.minimumTargets ?? 1) },
          (_, index) => targets[index % targets.length].id,
        )
      : targets.map(target => target.id)
    const components = [...(variant.damage ? [variant.damage] : []), ...(variant.additionalDamage ?? [])]
    const movement = variant.forcedMovementOnFailedSave ?? variant.forcedMovementOnSuccessfulSave
    const movementDistance = branch === 'successful-save-blocked-exit' ? 0 : successful
      ? variant.forcedMovementOnSuccessfulSave?.maximumDistanceFeet ?? 0
      : variant.forcedMovementOnFailedSave?.maximumDistanceFeet ?? 0
    const command: Extract<Dnd5eAction, { type: 'monster-area-action' }> = {
      type: 'monster-area-action', actorId: actor.id, actionId: action.id,
      legendary: section === 'legendaryActions' ? true : undefined,
      resolution: {
        schemaVersion: 1, variantId: variant.id,
        targetIds: branch === 'duplicate-target' ? [...targetIds, targetIds[0]] : targetIds,
        targetSavingThrows: (branch === 'duplicate-target' ? [...targetIds, targetIds[0]] : targetIds)
          .map(targetId => ({ targetId, ability: variant.ability, d20: successful ? 20 : 1 })),
        damageRolls: Array.from({
          length: variant.damageRollsPerTargetSelection ? targetIds.length : 1,
        }).flatMap(() => components.flatMap(damage => Array(damage.count).fill(1))),
        forcedMovements: movement ? targets.map(target => ({ targetId: target.id, distanceFeet: movementDistance,
          to: { x: target.position.x + movementDistance, y: target.position.y } })) : undefined,
        actorMovement: variant.actorLanding ? { to: { x: 15, y: 0 }, distanceFeet: 15, movementCostFeet: 15,
          traversalMode: variant.actorLanding.traversalMode, toElevationFeet: 0, toGroundElevationFeet: 0 } : undefined,
      },
    }
    const before = structuredClone(state)
    const result = resolveDnd5eHeadlessAction(state, command)
    evidence.push({ monsterId: monster.id, slug: monster.slug, actionId: action.id, section, variantId: variant.id,
      scenario: branch, ok: result.ok, reason: result.ok ? undefined : result.reason, events: result.events,
      targets: targetIds.map(id => ({ id, hpBefore: before.combatants[id].currentHp,
        hpAfter: result.state.combatants[id].currentHp, conditions: result.state.combatants[id].conditions,
        activeEffects: result.state.combatants[id].classState.activeEffects })),
    })
    if (branch === 'duplicate-target' || branch === 'exhausted-resource') {
      expect(result.ok, label).toBe(false)
      expect(result.state).toEqual(before)
      return
    }
    expect(result.ok, `${label}: ${result.ok ? '' : result.reason}`).toBe(true)
    expect(result.state.combatants.actor.turn.actionAvailable).toBe(section === 'legendaryActions')
    if (section === 'legendaryActions') expect(result.state.combatants.actor.classState.monsterLegendaryActionPoints)
      .toBe((before.combatants.actor.classState.monsterLegendaryActionPoints ?? 3) - (action.legendaryCost ?? 1))
    for (const target of targets) {
      expect(result.events).toContainEqual(expect.objectContaining({ type: 'saving-throw-resolved', targetId: target.id,
        ability: variant.ability, dc: variant.dc, success: successful }))
      const damagePerSelection = components.reduce((total, damage) => total + (successful
        ? variant.damageOnSuccessfulSave === 'half' ? Math.floor(Math.max(0, damage.count + damage.bonus) / 2) : 0
        : Math.max(0, damage.count + damage.bonus)), 0)
      const expectedDamage = damagePerSelection * targetIds.filter(id => id === target.id).length
      expect(before.combatants[target.id].currentHp - result.state.combatants[target.id].currentHp).toBe(expectedDamage)
      if (variant.conditionOnFailedSave) expect(result.state.combatants[target.id].conditions.includes(variant.conditionOnFailedSave.condition))
        .toBe(!successful || (branch === 'successful-save-blocked-exit' && variant.conditionOnFailedSave.condition === 'prone'))
      if (movement) expect(result.state.combatants[target.id].position).toEqual({ x: target.position.x + movementDistance, y: target.position.y })
      if (!successful && variant.activeEffectOnFailedSave) expect(result.state.combatants[target.id].classState.activeEffects).toEqual(expect.arrayContaining([
        expect.objectContaining({ modifiers: expect.objectContaining(variant.activeEffectOnFailedSave.modifiers ?? {}) }),
      ]))
    }
    if (action.usage?.kind === 'recharge') expect(result.state.combatants.actor.classState.monsterRechargeReadyByActionId?.[action.id]).toBe(false)
    if (action.usage?.kind === 'per-day') expect(result.state.combatants.actor.classState.monsterActionUsesByActionId?.[action.id]?.current)
      .toBe(before.combatants.actor.classState.monsterActionUsesByActionId![action.id].current - 1)
  })
})

afterAll(() => {
  const destination = process.env.STARS_MONSTER_INVENTORY_DIR
  if (!destination) return
  const directory = path.resolve(destination)
  if (path.relative(process.cwd(), directory).startsWith('..')) throw new Error('evidence must be inside repository')
  mkdirSync(directory, { recursive: true })
  writeFileSync(path.join(directory, 'area-runtime.json'), JSON.stringify(evidence, null, 2))
})
