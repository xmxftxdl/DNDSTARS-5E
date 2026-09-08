import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat, type Dnd5eAction } from './headlessCombatEngine'
import { DND5E_SRD_MONSTERS } from './monsters'

const cases = DND5E_SRD_MONSTERS.flatMap(monster => (monster.legendaryActions ?? [])
  .filter(action => action.automation === 'headless' && (action.rule?.kind === 'legendary-wing-attack' || action.rule?.kind === 'grant-movement'))
  .flatMap(action => ['failed-save', 'successful-save', 'no-points', 'out-of-range', 'behind-wall', 'invalid-dice', 'move', 'move-too-far', 'wrong-mode', 'window-expired']
    .filter(branch => action.rule?.kind === 'legendary-wing-attack' || ['no-points', 'move', 'move-too-far', 'window-expired'].includes(branch))
    .map(branch => ({ monster, action, branch, label: `${monster.slug}:${action.id}:${branch}` }))))
const evidence: unknown[] = []

describe('every legendary wing and movement allowance is scoped to its purchased window', () => {
  it.each(cases)('$label', ({ monster, action, branch, label }) => {
    const rule = action.rule!
    const wing = rule.kind === 'legendary-wing-attack'
    const combatId = `legendary-verification:${label}`
    const actor = createDnd5eCombatant({
      id: 'actor', name: monster.name, controller: 'dm', statBlockId: monster.id, initiative: 10,
      abilities: monster.abilities, proficiencyBonus: 2, armorClass: monster.armorClass.value,
      maxHp: 1000, currentHp: 1000, temporaryHp: 0, speed: monster.speed.walk, movementSpeeds: monster.speed,
      position: { x: 0, y: 0 }, concentrating: false, creatureType: monster.creatureType,
      classState: { monsterLegendaryActionPoints: branch === 'no-points' ? 0 : 3 },
    })
    const target = createDnd5eCombatant({
      id: 'target', name: 'hero', controller: 'player', initiative: 20,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
      armorClass: 10, maxHp: 1000, currentHp: 1000, temporaryHp: 0, speed: 30,
      position: { x: 5, y: 0 }, concentrating: false,
      savingThrowBonuses: { dex: branch === 'successful-save' ? 40 : -10 },
    })
    const state = startDnd5eHeadlessCombat(combatId, [actor, target])
    state.distanceFeetByCombatantPair = { 'actor\u0000target': branch === 'out-of-range' && wing ? rule.rangeFeet + 5 : 5 }
    if (branch === 'behind-wall') state.lineOfEffectBlockedByCombatantPair = { 'actor\u0000target': true }
    const targetsExcluded = branch === 'out-of-range' || branch === 'behind-wall'
    const command: Dnd5eAction = wing
      ? { type: 'monster-adjudicated-action', actorId: 'actor', actionId: action.id, legendary: true, effects: [],
          targetSavingThrows: targetsExcluded ? [] : [{ targetId: 'target', d20: branch === 'successful-save' ? 20 : 1 }],
          damageRolls: Array(rule.damage.count).fill(branch === 'invalid-dice' ? rule.damage.sides + 1 : 1) }
      : { type: 'monster-legendary-special-action', actorId: 'actor', actionId: action.id }
    const result = resolveDnd5eHeadlessAction(state, command)
    const expectedOk = !['no-points', 'invalid-dice'].includes(branch)
    evidence.push({ slug: monster.slug, monsterId: monster.id, section: 'legendaryActions', actionId: action.id,
      scenario: branch, ok: result.ok, expectedOk, reason: result.ok ? undefined : result.reason, events: result.events,
      grant: result.state.combatants.actor.classState.monsterLegendaryMovement })
    expect(result.ok, `${label}: ${result.ok ? '' : result.reason}`).toBe(expectedOk)
    if (!expectedOk) {
      expect(result.state.combatants).toEqual(state.combatants)
      return
    }
    const grant = result.state.combatants.actor.classState.monsterLegendaryMovement!
    const maximumFeet = wing
      ? Math.floor((monster.speed.fly ?? 0) * rule.followUpMovement.maximumSpeedFraction)
      : rule.kind === 'grant-movement'
        ? rule.maximumDistanceFeet ?? Math.floor(
            Math.max(monster.speed.walk, monster.speed.fly ?? 0, monster.speed.climb ?? 0, monster.speed.swim ?? 0) *
            (rule.maximumSpeedFraction ?? 0),
          )
        : 0
    expect(grant).toMatchObject({ maximumFeet, traversalMode: wing ? 'fly' : 'any' })
    expect(result.state.combatants.actor.turn.movementRemaining).toBe(state.combatants.actor.turn.movementRemaining)
    expect(result.state.combatants.actor.classState.monsterLegendaryActionPoints).toBe(3 - (action.legendaryCost ?? 1))
    if (wing) {
      const hit = !targetsExcluded && branch !== 'successful-save'
      expect(result.state.combatants.target.currentHp).toBe(1000 - (hit ? rule.damage.count + rule.damage.bonus : 0))
      expect(result.state.combatants.target.conditions.includes('prone')).toBe(hit)
    }
    if (branch === 'window-expired') {
      const next = structuredClone(result.state)
      next.round += 1
      const moved = resolveDnd5eHeadlessAction(next, { type: 'move', actorId: 'actor', monsterLegendaryMovement: true,
        to: { x: -5, y: 0 }, distance: 5, traversalMode: wing ? 'fly' : monster.speed.walk > 0 ? 'walk' : 'fly' })
      expect(moved.ok).toBe(false)
      expect(moved.state.combatants.actor.position).toEqual(actor.position)
    }
    if (['move', 'move-too-far', 'wrong-mode'].includes(branch)) {
      const distance = branch === 'move-too-far' ? maximumFeet + 5 : maximumFeet
      const fastestGrantedMode = [
        ['walk', monster.speed.walk],
        ['fly', monster.speed.fly ?? 0],
        ['climb', monster.speed.climb ?? 0],
        ['swim', monster.speed.swim ?? 0],
      ].sort((left, right) => Number(right[1]) - Number(left[1]))[0][0] as 'walk' | 'fly' | 'climb' | 'swim'
      const movement: Extract<Dnd5eAction, { type: 'move' }> = {
        type: 'move', actorId: 'actor', monsterLegendaryMovement: true, to: { x: -distance, y: 0 }, distance,
        movementCost: distance, traversalMode: branch === 'wrong-mode' ? 'walk' : wing ? 'fly' : fastestGrantedMode,
      }
      const moved = resolveDnd5eHeadlessAction(result.state, movement)
      expect(moved.ok, `${label}: movement ${moved.ok ? '' : moved.reason}`).toBe(branch === 'move')
      if (moved.ok) {
        expect(moved.state.combatants.actor.position).toEqual(movement.to)
        expect(moved.state.combatants.actor.turn.movementRemaining).toBe(state.combatants.actor.turn.movementRemaining)
        expect(moved.state.combatants.actor.classState.monsterLegendaryMovement).toBeUndefined()
        expect(resolveDnd5eHeadlessAction(moved.state, movement).ok).toBe(false)
      } else expect(moved.state.combatants).toEqual(result.state.combatants)
    }
  })

  it('keeps an unrelated swallowed creature outside a legendary Wing Attack', () => {
    const monster = DND5E_SRD_MONSTERS.find((candidate) =>
      candidate.slug === 'adult-red-dragon')!
    const wormMonster = DND5E_SRD_MONSTERS.find((candidate) =>
      candidate.slug === 'purple-worm')!
    const action = monster.legendaryActions?.find((candidate) =>
      candidate.rule?.kind === 'legendary-wing-attack')!
    const worm = createDnd5eCombatant({
      id: 'worm', name: wormMonster.name, controller: 'dm', statBlockId: wormMonster.id,
      initiative: 50, abilities: wormMonster.abilities, proficiencyBonus: 2,
      armorClass: wormMonster.armorClass.value, maxHp: 1000, currentHp: 1000,
      temporaryHp: 0, speed: wormMonster.speed.walk, movementSpeeds: wormMonster.speed,
      position: { x: 0, y: 0 }, concentrating: false,
      creatureType: wormMonster.creatureType, sizeRank: 5,
    })
    const actor = createDnd5eCombatant({
      id: 'actor', name: monster.name, controller: 'dm', statBlockId: monster.id, initiative: 30,
      abilities: monster.abilities, proficiencyBonus: 2, armorClass: monster.armorClass.value,
      maxHp: 1000, currentHp: 1000, temporaryHp: 0, speed: monster.speed.walk,
      movementSpeeds: monster.speed, position: { x: 0, y: 0 }, concentrating: false,
      creatureType: monster.creatureType, classState: { monsterLegendaryActionPoints: 3 },
    })
    const target = createDnd5eCombatant({
      id: 'target', name: 'hero', controller: 'player', initiative: 40,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
      armorClass: 10, maxHp: 100, currentHp: 100, temporaryHp: 0, speed: 30,
      position: { x: 5, y: 0 }, concentrating: false, sizeRank: 2,
    })
    const state = startDnd5eHeadlessCombat('wing-swallowed-cover', [worm, target, actor])
    state.distanceFeetByCombatantPair = {
      'worm\u0000target': 5,
      'actor\u0000target': 5,
    }

    const swallowed = resolveDnd5eHeadlessAction(state, {
      type: 'monster-action', actorId: worm.id, actionId: 'bite',
      rolls: [{
        targetId: target.id, d20: 10, damageRolls: [[1, 1, 1]],
        onHitEffectRolls: [{ effectId: 'bite-swallow', d20: 1 }],
      }],
    })
    expect(swallowed.ok, swallowed.ok ? undefined : swallowed.reason).toBe(true)
    if (!swallowed.ok) return
    const hpAfterSwallow = swallowed.state.combatants.target.currentHp
    swallowed.state.initiativeIndex = swallowed.state.initiativeOrder.indexOf(target.id)

    const result = resolveDnd5eHeadlessAction(swallowed.state, {
      type: 'monster-adjudicated-action', actorId: actor.id, actionId: action.id,
      legendary: true, effects: [], targetSavingThrows: [], damageRolls: [1, 1],
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    expect(result.state.combatants.target.currentHp).toBe(hpAfterSwallow)
  })
})

afterAll(() => {
  const directory = process.env.STARS_MONSTER_INVENTORY_DIR && path.resolve(process.env.STARS_MONSTER_INVENTORY_DIR)
  if (!directory) return
  if (path.relative(process.cwd(), directory).startsWith('..')) throw new Error('evidence must be inside repository')
  mkdirSync(directory, { recursive: true })
  writeFileSync(path.join(directory, 'legendary-runtime.json'), JSON.stringify(evidence, null, 2))
})
