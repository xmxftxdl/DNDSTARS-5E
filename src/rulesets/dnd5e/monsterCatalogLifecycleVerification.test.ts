import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { BattleMap, Token } from '../../store/maps'
import { createDnd5eCombatant, dnd5eCombatantPairKey, dnd5ePendingMonsterDeathAreaEffects,
  dnd5eTurnStartGazeRequirements, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat,
  type Dnd5eActionResult, type Dnd5eCombatant } from './headlessCombatEngine'
import { DND5E_SRD_MONSTERS } from './monsters'
import { findDnd5eOpportunityAttackersForMove } from './opportunityAttackAction'

const branches: Record<string, readonly string[]> = {
  'death-area-saving-throw': ['failed-save', 'successful-save', 'outside-radius', 'replay-rejected'],
  'turn-start-gaze': ['successful-save', 'failed-save', 'severe-failure', 'outside-range', 'avert-eyes'],
  'turn-start-saving-throw-aura': ['successful-save', 'failed-save', 'outside-range'],
  'undead-fortitude': ['successful-save', 'failed-save', 'radiant', 'critical'],
  flyby: ['walk', 'fly'],
}
const cases = DND5E_SRD_MONSTERS.flatMap(monster => monster.traits.flatMap((trait, index) =>
  trait.automation === 'headless' && trait.rule && branches[trait.rule.kind]
    ? branches[trait.rule.kind].map(branch => ({ monster, trait, index, branch,
      label: `${monster.slug}:${trait.rule!.kind}:${branch}` })) : []))
const evidence: unknown[] = []
const abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } as const
function combatant(id: string, initiative: number, patch: Partial<Dnd5eCombatant> = {}) {
  return createDnd5eCombatant({ id, name: id, controller: 'player', initiative, abilities,
    proficiencyBonus: 2, armorClass: 10, currentHp: 1000, maxHp: 1000, temporaryHp: 0,
    speed: 30, position: { x: 0, y: 0 }, concentrating: false, ...patch })
}
function success(result: Dnd5eActionResult) {
  expect(result.ok, result.ok ? '' : result.reason).toBe(true)
  if (!result.ok) throw new Error(result.reason)
  return result
}

describe('catalog turn, death and movement trait triggers', () => {
  it.each(cases)('$label', ({ monster, trait, index, branch, label }) => {
    const rule = trait.rule!
    const record = (result: unknown) => evidence.push({ slug: monster.slug, traitIndex: index, scenario: branch, result })
    const source = combatant('source', 10, { controller: 'dm', statBlockId: monster.id })
    const target = combatant('target', 20, { abilities: branch === 'successful-save'
      ? { str: 30, dex: 30, con: 30, int: 30, wis: 30, cha: 30 } : abilities })
    const clock = combatant('clock', 30)
    const anchor = combatant('anchor', 1, { controller: 'dm', position: { x: 500, y: 500 } })
    if (rule.kind === 'death-area-saving-throw') {
      source.currentHp = 1
      const state = startDnd5eHeadlessCombat(label, [clock, source, target, anchor])
      state.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(source.id, clock.id)]: 100,
        [dnd5eCombatantPairKey(source.id, target.id)]: rule.area.radiusFeet + (branch === 'outside-radius' ? 5 : 0),
        [dnd5eCombatantPairKey(source.id, anchor.id)]: 100,
      }
      const killed = success(resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: clock.id,
        targetId: source.id, attackModifier: 30, d20: 10,
        damage: { count: 1, sides: 4, bonus: 0, rolls: [4], type: 'force' } }))
      const snapshots = dnd5ePendingMonsterDeathAreaEffects(killed.state)
      if (branch === 'outside-radius') {
        expect(snapshots.flatMap(snapshot => snapshot.targetIds)).not.toContain(target.id)
        record(killed.events); return
      }
      expect(snapshots).toHaveLength(1)
      expect(snapshots[0].targetIds).toEqual([target.id])
      const request = { type: 'resolve-monster-death-area-effect' as const,
        actorId: source.id, snapshotId: snapshots[0].id,
        resolution: { schemaVersion: 1 as const, targetIds: [target.id],
          targetSavingThrows: [{ targetId: target.id, d20: branch === 'successful-save' ? 20 : 1 }],
          damageRolls: rule.damage ? Array(rule.damage.count).fill(rule.damage.sides) : [] } }
      const resolved = success(resolveDnd5eHeadlessAction(killed.state, request))
      const total = rule.damage ? rule.damage.count * rule.damage.sides + rule.damage.bonus : 0
      const damage = branch !== 'successful-save' ? total : rule.damageOnSuccessfulSave === 'half' ? Math.floor(total / 2) : 0
      expect(resolved.state.combatants.target.currentHp).toBe(1000 - damage)
      if (rule.conditionOnFailedSave) expect(resolved.state.combatants.target.conditions.includes(rule.conditionOnFailedSave.condition))
        .toBe(branch !== 'successful-save')
      expect(dnd5ePendingMonsterDeathAreaEffects(resolved.state)).toHaveLength(0)
      if (branch === 'replay-rejected') {
        const duplicate = resolveDnd5eHeadlessAction(resolved.state, request)
        expect(duplicate.ok).toBe(false)
        expect(duplicate.state.combatants.target.currentHp).toBe(resolved.state.combatants.target.currentHp)
      }
      record(resolved.events); return
    }
    if (rule.kind === 'turn-start-gaze' || rule.kind === 'turn-start-saving-throw-aura') {
      // A high ability score makes DC 21 a genuine successful save; natural 20 is not an automatic saving throw success.
      const state = startDnd5eHeadlessCombat(label, [clock, target, source, anchor])
      state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey(source.id, target.id)]:
        rule.rangeFeet + (branch === 'outside-range' ? 5 : 0) }
      const requirements = dnd5eTurnStartGazeRequirements(state, target.id)
      if (branch === 'outside-range') { expect(requirements).toEqual([]); record({ requirements }); return }
      expect(requirements).toHaveLength(1)
      expect(requirements[0]).toMatchObject({ ability: rule.ability, dc: rule.dc })
      const resolution = { sourceId: source.id, targetId: target.id, ruleId: rule.ruleId,
        sourceUsesGaze: true, choice: branch === 'avert-eyes' ? 'avert-eyes' as const : 'face-gaze' as const,
        save: branch === 'avert-eyes' ? undefined : { d20: branch === 'successful-save' ? 20 : branch === 'severe-failure' ? 1 : rule.dc - 1 } }
      const resolved = success(resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: clock.id,
        turnStartGazeResolutions: [resolution] }))
      const affected = resolved.state.combatants.target
      if (rule.kind === 'turn-start-saving-throw-aura') {
        expect(affected.conditions.includes(rule.condition)).toBe(branch === 'failed-save')
        if (branch === 'successful-save') {
          expect(dnd5eTurnStartGazeRequirements(resolved.state, target.id)).toEqual([])
          expect(affected.classState.activeEffects).toContainEqual(expect.objectContaining({
            duration: { type: 'rounds', remainingRounds: rule.successfulSaveImmunityRounds, tickOn: 'target-turn-start' } }))
        }
      } else if (branch === 'avert-eyes' || branch === 'successful-save') {
        expect(affected.conditions).not.toContain(rule.initialCondition)
        expect(affected.conditions).not.toContain(rule.failureCondition)
      } else {
        const condition = branch === 'severe-failure' && rule.immediateFailureMargin != null
          ? rule.failureCondition : rule.initialCondition
        expect(affected.conditions).toContain(condition)
      }
      record(resolved.events); return
    }
    if (rule.kind === 'undead-fortitude') {
      source.currentHp = 3
      const state = startDnd5eHeadlessCombat(label, [clock, target, source, anchor])
      const critical = branch === 'critical'
      const damaged = success(resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: clock.id,
        targetId: source.id, attackModifier: 30, d20: critical ? 20 : 10,
        damage: { count: 1, sides: 4, bonus: 0, rolls: critical ? [1, 2] : [3], type: branch === 'radiant' ? 'radiant' : 'slashing' } }))
      if (critical || branch === 'radiant') {
        expect(damaged.state.combatants.source.classState.undeadFortitudePending).toBeUndefined()
        expect(damaged.state.combatants.source.deathSaves.dead).toBe(true)
        record(damaged.events); return
      }
      expect(damaged.state.combatants.source.classState.undeadFortitudePending).toMatchObject({ dc: rule.dcBase + 3, damage: 3 })
      const resolved = success(resolveDnd5eHeadlessAction(damaged.state, { type: 'monster-undead-fortitude-save',
        actorId: source.id, d20: branch === 'successful-save' ? 20 : 1 }))
      expect(resolved.state.combatants.source.currentHp).toBe(branch === 'successful-save' ? 1 : 0)
      expect(resolved.state.combatants.source.classState.undeadFortitudePending).toBeUndefined()
      record(resolved.events); return
    }
    if (rule.kind === 'flyby') {
      const token: Token = { id: source.id, label: monster.name, poolId: monster.id, type: 'enemy',
        x: 5, y: 5, size: 1, color: '', emoji: '', hp: 100, maxHp: 100 }
      const map: BattleMap = { id: label, name: label, width: 100, height: 100, gridSize: 10,
        gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
        tokens: [token, { ...token, id: target.id, poolId: 'srd-5.1:goblin', type: 'player', x: 15 }] }
      const attackers = findDnd5eOpportunityAttackersForMove({ map, characters: [], movingToken: token,
        to: { x: 35, y: 5 }, turnEconomyByToken: {}, movementMode: branch === 'fly' ? 'fly' : 'walk' })
      expect(attackers.map(candidate => candidate.id)).toEqual(branch === 'fly' ? [] : [target.id])
      record({ opportunityAttackerIds: attackers.map(candidate => candidate.id) })
    }
  })
})
afterAll(() => {
  const destination = process.env.STARS_MONSTER_INVENTORY_DIR
  if (!destination) return
  const directory = path.resolve(destination)
  if (path.relative(process.cwd(), directory).startsWith('..')) throw new Error('evidence must stay inside repository')
  mkdirSync(directory, { recursive: true })
  writeFileSync(path.join(directory, 'lifecycle-runtime.json'), JSON.stringify(evidence, null, 2))
})
