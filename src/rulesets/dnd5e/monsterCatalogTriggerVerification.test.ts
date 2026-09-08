import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { BattleMap, Token } from '../../store/maps'
import { createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat, type Dnd5eMonsterOnHitEffectRoll } from './headlessCombatEngine'
import { createDnd5eMapCombatSnapshot } from './mapBridge'
import { DND5E_SRD_MONSTERS } from './monsters'

const branches: Record<string, readonly string[]> = {
  'charge-damage': ['no-movement', 'below-threshold', 'at-threshold'],
  'magic-weapons': ['ordinary-defenses', 'nonmagical-immunity'],
  'blood-frenzy': ['full-target-hp', 'wounded-target'],
  relentless: ['at-threshold', 'above-threshold', 'already-zero'],
}
const cases = DND5E_SRD_MONSTERS.flatMap(monster => monster.traits.flatMap((trait, index) =>
  trait.automation === 'headless' && trait.rule && branches[trait.rule.kind]
    ? branches[trait.rule.kind].map(branch => ({ monster, trait, index, branch, label: `${monster.slug}:${trait.rule!.kind}:${branch}` })) : []))
const evidence: unknown[] = []

describe('catalog movement, injury and weapon trait triggers', () => {
  it.each(cases)('$label', ({ monster, trait, index, branch, label }) => {
    const rule = trait.rule!
    const charge = rule.kind === 'charge-damage' ? rule : undefined
    const combatId = `trigger:${label}`
    const actor = createDnd5eCombatant({ id: 'actor', name: monster.name, controller: 'dm', initiative: 20,
      statBlockId: monster.id, abilities: monster.abilities, proficiencyBonus: 2,
      armorClass: monster.armorClass.value, maxHp: 1000, currentHp: 1000, temporaryHp: 0,
      speed: Math.max(monster.speed.walk, charge?.minimumStraightMovementFeet ?? 0),
      movementSpeeds: monster.speed, position: { x: 0, y: 0 }, concentrating: false,
      classState: { turnStartResolvedTurnKey: `${combatId}:1:actor` } })
    const target = createDnd5eCombatant({ id: 'target', name: 'Target', controller: 'player', initiative: 10,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
      armorClass: 1, maxHp: 10000, currentHp: branch === 'wounded-target' ? 9999 : 10000, temporaryHp: 0,
      speed: 30, position: { x: (charge?.minimumStraightMovementFeet ?? 0) + 5, y: 0 }, concentrating: false })
    let state = startDnd5eHeadlessCombat(combatId, [actor, target])
    if (rule.kind === 'relentless') {
      state.combatants.actor.currentHp = branch === 'already-zero' ? 0 : 1
      state.initiativeIndex = 1
      const damage = rule.maximumDamage + (branch === 'above-threshold' ? 1 : 0)
      const result = resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: target.id, targetId: actor.id,
        attackModifier: 30, d20: 10, damage: { count: 1, sides: 20, bonus: 0, rolls: [damage], type: 'fire' } })
      expect(result.ok, result.ok ? '' : result.reason).toBe(true)
      expect(result.state.combatants.actor.currentHp).toBe(branch === 'at-threshold' ? 1 : 0)
      evidence.push({ slug: monster.slug, traitIndex: index, scenario: branch, events: result.events, ok: result.ok })
      return
    }
    if (rule.kind === 'magic-weapons') {
      const token: Token = { id: actor.id, label: monster.name, poolId: monster.id, type: 'enemy',
        x: 25, y: 25, size: 1, color: '', emoji: '', hp: 500, maxHp: 1000 }
      const map: BattleMap = { id: 'magic-projection', name: 'Magic projection', width: 500, height: 500,
        gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [token] }
      const projected = createDnd5eMapCombatSnapshot({ combatId, map, characters: [],
        initiativeOrder: [{ tokenId: actor.id, label: monster.name, emoji: '', color: '', roll: 20 }] })
      expect(projected.state.combatants.actor.weaponAttacksMagical).toBe(true)
      state.combatants.actor.weaponAttacksMagical = projected.state.combatants.actor.weaponAttacksMagical
      if (branch === 'nonmagical-immunity') state.combatants.target.damageDefenseRules = [{
        outcome: 'immune', damageTypes: ['bludgeoning', 'piercing', 'slashing'], delivery: 'weapon-attack', magical: false,
      }]
    }
    const action = charge ? monster.actions.find(action => action.id === charge.actionId)
      : monster.actions.find(action => action.automation === 'headless' && action.attack?.mode === 'melee')
    expect(action?.attack, label).toBeDefined()
    if (!action?.attack) return
    if (charge) {
      const distance = branch === 'at-threshold' ? charge.minimumStraightMovementFeet
        : branch === 'below-threshold' ? charge.minimumStraightMovementFeet - 5 : 0
      if (distance > 0) {
        const moved = resolveDnd5eHeadlessAction(state, {
          type: 'move', actorId: actor.id, to: { x: distance, y: 0 }, distance,
          traversalMode: monster.speed.walk > 0 ? 'walk' : (monster.speed.swim ?? 0) > 0 ? 'swim' : 'walk',
        })
        expect(moved.ok, moved.ok ? '' : moved.reason).toBe(true)
        state = moved.state
      }
      // Keep the melee target in reach while varying only the actual movement history.
      state.combatants.target.position = { x: state.combatants.actor.position.x + 5, y: 0 }
    }
    state.distanceFeetByCombatantPair = { 'actor\u0000target': Math.min(5, action.attack.reachFeet ?? 5) }
    const onHitEffectRolls = (action.attack.onHitEffects ?? []).map(effect => {
      const roll: Dnd5eMonsterOnHitEffectRoll = { effectId: effect.id, d20: 20, d20Second: 20 }
      if (effect.kind === 'saving-throw-damage') roll.damageRolls = effect.damage.map(damage => Array(damage.count).fill(1))
      return roll
    })
    if (charge?.forcedMovementOnHit && branch === 'at-threshold') onHitEffectRolls.push({
      effectId: `charge:${action.id}:forced-movement`, d20: 1,
      forcedMovement: { targetId: target.id, distanceFeet: charge.forcedMovementOnHit.maximumDistanceFeet,
        to: { x: state.combatants.target.position.x + charge.forcedMovementOnHit.maximumDistanceFeet, y: 0 } },
    })
    const result = resolveDnd5eHeadlessAction(state, { type: 'monster-action', actorId: actor.id, actionId: action.id,
      rolls: [{ targetId: target.id, d20: 10, d20Second: 19,
        damageRolls: action.attack.damage.map(damage => Array(damage.count).fill(1)), onHitEffectRolls,
        traitDamageRolls: charge?.extraDamage && branch === 'at-threshold'
          ? [{ traitId: 'charge-damage', rolls: Array(charge.extraDamage.count).fill(1) }] : undefined }] })
    expect(result.ok, `${label}: ${result.ok ? '' : result.reason}`).toBe(true)
    if (charge) {
      const extra = result.events.find(event => event.type === 'monster-attack-trait-damage-applied')
      if (branch === 'at-threshold' && charge.extraDamage) expect(extra).toMatchObject({ amount: charge.extraDamage.count + charge.extraDamage.bonus })
      else expect(extra).toBeUndefined()
      expect(result.events.some(event => event.type === 'monster-on-hit-save-required')).toBe(branch === 'at-threshold' && !!charge.savingThrowOnHit)
    }
    if (rule.kind === 'blood-frenzy') expect(result.events.find(event => event.type === 'attack-resolved'))
      .toMatchObject({ d20: branch === 'wounded-target' ? 19 : 10 })
    if (rule.kind === 'magic-weapons') expect(state.combatants.target.currentHp - result.state.combatants.target.currentHp)
      .toBeGreaterThanOrEqual(action.attack.damage.reduce((sum, damage) => sum + damage.count + damage.bonus, 0))
    evidence.push({ slug: monster.slug, traitIndex: index, scenario: branch, events: result.events, ok: result.ok })
  })
})
afterAll(() => {
  const destination = process.env.STARS_MONSTER_INVENTORY_DIR
  if (!destination) return
  const directory = path.resolve(destination)
  if (path.relative(process.cwd(), directory).startsWith('..')) throw new Error('evidence must stay inside repository')
  mkdirSync(directory, { recursive: true })
  writeFileSync(path.join(directory, 'trigger-runtime.json'), JSON.stringify(evidence, null, 2))
})
