import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat,
  type Dnd5eCombatant, type Dnd5eAction } from './headlessCombatEngine'
import { DND5E_SRD_MONSTERS } from './monsters'
import { createDnd5eConditionEffect } from './activeEffects'
import { dnd5eMonsterPackTacticsApplies } from './monsterGenericAbilities'

const branches: Record<string, readonly string[]> = {
  'magic-resistance': ['magical', 'physical'],
  'legendary-resistance': ['choose', 'decline', 'exhausted'],
  'pack-tactics': ['adjacent-ally', 'distant-ally', 'dead-ally', 'incapacitated-ally'],
  regeneration: ['injured', 'full-hp', 'suppressed'],
  swarm: ['healing', 'temporary-hit-points'],
}
const cases = DND5E_SRD_MONSTERS.flatMap(monster => monster.traits.flatMap((trait, index) =>
  trait.automation === 'headless' && trait.rule && branches[trait.rule.kind]
    ? branches[trait.rule.kind].map(branch => ({ monster, trait, index, branch, label: `${monster.slug}:${trait.rule!.kind}:${branch}` })) : []))
const evidence: unknown[] = []
const create = (id: string, controller: 'dm' | 'player', initiative: number, patch: Partial<Dnd5eCombatant> = {}) => createDnd5eCombatant({
  id, name: id, controller, initiative, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  proficiencyBonus: 2, armorClass: 10, maxHp: 1000, currentHp: 500, temporaryHp: 0, speed: 30,
  position: { x: 0, y: 0 }, concentrating: false, ...patch,
})

describe('catalog defensive, recovery and ally-triggered traits', () => {
  it.each(cases)('$label', ({ monster, trait, index, branch, label }) => {
    const rule = trait.rule!
    const combatId = `trait-verification:${label}`
    const actor = create('actor', 'dm', 20, { statBlockId: monster.id, abilities: monster.abilities,
      creatureType: monster.creatureType, speed: monster.speed.walk, movementSpeeds: monster.speed,
      classState: { turnStartResolvedTurnKey: `${combatId}:1:actor` },
    })
    const target = create('target', 'player', 10, { position: { x: 5, y: 0 }, armorClass: 100 })
    let state = startDnd5eHeadlessCombat(combatId, [actor, target])
    state.distanceFeetByCombatantPair = { 'actor\u0000target': 5 }
    let command: Dnd5eAction
    if (rule.kind === 'pack-tactics') {
      const ally = create('ally', 'dm', 5, { currentHp: branch === 'dead-ally' ? 0 : 500,
        position: { x: 5, y: 5 }, classState: { activeEffects: branch === 'incapacitated-ally' ? [
          createDnd5eConditionEffect({ condition: 'incapacitated', targetId: 'ally', source: { kind: 'dm' } }),
        ] : [] } })
      state.combatants.ally = ally
      state.distanceFeetByCombatantPair!['ally\u0000target'] = branch === 'distant-ally' ? rule.allyDistanceFeet + 5 : rule.allyDistanceFeet
      const attack = monster.actions.find(action => action.automation === 'headless' && action.attack)
      if (!attack) {
        // Tribal Warrior's only weapon is explicitly DM-gated. Exercise the
        // trait primitive without relabelling that incomplete weapon Headless.
        const applies = dnd5eMonsterPackTacticsApplies({ monster, actorId: actor.id, targetId: target.id,
          candidates: [{ id: ally.id, alliedWithActor: true, currentHp: ally.currentHp,
            incapacitated: branch === 'incapacitated-ally', distanceFeetToTarget: state.distanceFeetByCombatantPair!['ally\u0000target'] }] })
        expect(applies).toBe(branch === 'adjacent-ally')
        evidence.push({ slug: monster.slug, monsterId: monster.id, traitIndex: index, traitKind: rule.kind,
          scenario: branch, ok: true, boundary: 'trait primitive; catalog weapon remains DM-gated', applies })
        return
      }
      command = { type: 'monster-action', actorId: actor.id, actionId: attack.id,
        rolls: [{ targetId: target.id, d20: 2, d20Second: 17, damageRolls: attack.attack!.damage.map(damage => Array(damage.count).fill(1)) }] }
    } else if (rule.kind === 'regeneration') {
      state.combatants.actor.currentHp = branch === 'full-hp' ? 1000 : 500
      state.combatants.actor.classState.turnStartResolvedTurnKey = undefined
      if (branch === 'suppressed') state.combatants.actor.classState.monsterRegenerationSuppressedDamageTypes = [...rule.suppressedByDamageTypes]
      command = { type: 'begin-turn', actorId: actor.id }
    } else if (rule.kind === 'swarm') {
      const healer = create('healer', 'dm', 30, { statBlockId: 'srd-5.1:ancient-brass-dragon' })
      state = startDnd5eHeadlessCombat(combatId, [healer, actor, target])
      command = { type: 'monster-adjudicated-action', actorId: healer.id, actionId: 'change-shape', dmApproved: true,
        effects: [{ targetId: actor.id, operation: branch === 'healing' ? 'healing' : 'temporary-hit-points', amount: 20 }] }
    } else {
      const source = create('source', 'player', 30, { statBlockId: branch === 'physical' ? 'srd-5.1:winter-wolf' : 'srd-5.1:mummy' })
      state = startDnd5eHeadlessCombat(combatId, [source, actor, target])
      state.distanceFeetByCombatantPair = { 'actor\u0000source': 5 }
      if (rule.kind === 'legendary-resistance') state.combatants.actor.classState.legendaryResistanceUses = branch === 'exhausted' ? 0 : rule.maximumUses
      state.combatants.actor.savingThrowBonuses = { wis: 0, dex: 0 }
      command = branch === 'physical'
        ? { type: 'monster-area-action', actorId: source.id, actionId: 'cold-breath', resolution: {
            schemaVersion: 1, targetIds: [actor.id], targetSavingThrows: [{ targetId: actor.id, d20: 1, d20Second: 20 }], damageRolls: [1, 1, 1, 1] } }
        : { type: 'monster-special-action', actorId: source.id, actionId: 'dreadful-glare', targetId: actor.id,
            d20: 1, d20Second: rule.kind === 'magic-resistance' ? 20 : 1,
            legendaryResistance: rule.kind === 'legendary-resistance' && branch !== 'decline' ? true : undefined }
    }
    const result = resolveDnd5eHeadlessAction(state, command)
    evidence.push({ slug: monster.slug, monsterId: monster.id, traitIndex: index, traitKind: rule.kind,
      scenario: branch, ok: result.ok, reason: result.ok ? undefined : result.reason, events: result.events,
      actor: result.state.combatants.actor })
    if (branch === 'exhausted') {
      expect(result.ok).toBe(false)
      expect(result.state.combatants).toEqual(state.combatants)
      return
    }
    expect(result.ok, `${label}: ${result.ok ? '' : result.reason}`).toBe(true)
    const after = result.state.combatants.actor
    if (rule.kind === 'pack-tactics') expect(result.events.find(event => event.type === 'attack-resolved')).toMatchObject({
      d20: branch === 'adjacent-ally' ? 17 : 2, hit: false,
    })
    if (rule.kind === 'magic-resistance') expect(result.events.find(event => event.type === 'saving-throw-resolved' && event.targetId === actor.id))
      .toMatchObject({ d20: branch === 'magical' ? 20 : 1, success: branch === 'magical' })
    if (rule.kind === 'legendary-resistance') {
      expect(result.events.find(event => event.type === 'saving-throw-resolved' && event.targetId === actor.id)).toMatchObject({ success: branch === 'choose' })
      expect(after.classState.legendaryResistanceUses).toBe(rule.maximumUses - (branch === 'choose' ? 1 : 0))
    }
    if (rule.kind === 'regeneration') {
      const suppressed = branch === 'suppressed' && rule.suppressedByDamageTypes.length > 0
      expect(after.currentHp).toBe(branch === 'full-hp' ? 1000 : 500 + (suppressed ? 0 : rule.amount))
      expect(after.classState.monsterRegenerationSuppressedDamageTypes).toBeUndefined()
    }
    if (rule.kind === 'swarm') {
      expect(after.currentHp).toBe(500)
      expect(after.temporaryHp).toBe(0)
    }
  })
})

afterAll(() => {
  const destination = process.env.STARS_MONSTER_INVENTORY_DIR
  if (!destination) return
  const directory = path.resolve(destination)
  if (path.relative(process.cwd(), directory).startsWith('..')) throw new Error('evidence must be inside repository')
  mkdirSync(directory, { recursive: true })
  writeFileSync(path.join(directory, 'trait-runtime.json'), JSON.stringify(evidence, null, 2))
})
