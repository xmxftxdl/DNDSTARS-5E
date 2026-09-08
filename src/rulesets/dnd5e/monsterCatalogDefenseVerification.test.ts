import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createDnd5eCombatant, dnd5eCombatantPairKey, resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat, type Dnd5eCombatant } from './headlessCombatEngine'
import { ensureDnd5eCoreSpellActivitiesRegisteredV1 } from './activities/dnd5eCoreSpellActivities'
import { getDnd5eSrdMonsterBySlug } from './monsters'

const evidence: unknown[] = []
function combatant(id: string, initiative: number, patch: Partial<Dnd5eCombatant> = {}) {
  return createDnd5eCombatant({ id, name: id, controller: 'player', initiative,
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 18, cha: 10 },
    proficiencyBonus: 5, armorClass: 10, currentHp: 1000, maxHp: 1000, temporaryHp: 0,
    speed: 30, position: { x: 0, y: 0 }, concentrating: false, ...patch })
}
function record(slug: string, kind: string, scenario: string, events: unknown) {
  const monster = getDnd5eSrdMonsterBySlug(slug)!
  evidence.push({ slug, traitIndex: monster.traits.findIndex(trait => trait.rule?.kind === kind), scenario, events })
}

describe('catalog form and spell immunity defenses', () => {
  it('Flesh Golem Immutable Form rejects Polymorph while consuming the cast without empty concentration', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const caster = combatant('caster', 20, { classId: 'druid', level: 8, classLevels: { druid: 8 }, saveDc: 16,
      classSelections: { 'spell-prepared': ['polymorph'] },
      classSelectionsByClass: { druid: { 'spell-prepared': ['polymorph'] } },
      classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 1 } } })
    const target = combatant('golem', 10, { controller: 'dm', statBlockId: 'srd-5.1:flesh-golem', position: { x: 5, y: 0 } })
    expect(target.immutableForm).toBe(true)
    const state = startDnd5eHeadlessCombat('catalog-immutable-form', [caster, target])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey(caster.id, target.id)]: 5 }
    const result = resolveDnd5eHeadlessAction(state, { type: 'plugin-spell-activity', actorId: caster.id,
      pluginAction: { type: 'plugin', pluginId: 'srd-5.1', actionId: 'spell:polymorph',
        transactionId: 'catalog-immutable-polymorph', actorId: caster.id, targetId: target.id, targetIds: [target.id],
        distanceFeet: 5, castLevel: 4, payload: { activityChoices: { mode: 'srd-5.1:bat' } },
        rolls: { [`spell-save-d20:${target.id}`]: { values: [1, 2], modifier: 0, total: 3 } } },
      spell: { castingClassId: 'druid', spellId: 'polymorph', spellName: '变形术', spellLevel: 4,
        slotLevel: 4, castingTime: 'action', declaredTargetIds: [target.id], concentrationRounds: 600,
        concentrationTargetIds: [target.id], spellSchool: 'transmutation' } })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    expect(result.state.combatants.golem.classState.wildShapeFormId).toBeUndefined()
    expect(result.state.combatants.caster).toMatchObject({ concentrating: false, turn: { actionAvailable: false },
      classResources: { 'dnd5e-spell-slot-4': { current: 0 } } })
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'creature-transformation-unaffected', targetId: target.id }))
    record('flesh-golem', 'immutable-form', 'polymorph-immunity-and-cost', result.events)
  })

  it.each([6, 7])('Rakshasa derives its catalog immunity and resolves a level %i spell boundary', slotLevel => {
    const caster = combatant('caster', 20, { classId: 'wizard', level: 13,
      classSelections: { 'spell-prepared': ['fireball'] },
      classResources: { [`dnd5e-spell-slot-${slotLevel}`]: { current: 1, max: 1 } } })
    const target = combatant('rakshasa', 10, { controller: 'dm', statBlockId: 'srd-5.1:rakshasa' })
    expect(target.limitedMagicImmunity).toEqual({ kind: 'limited-magic-immunity',
      maximumSpellLevel: 6, advantageAboveMaximum: true, allowsWilling: true })
    const state = startDnd5eHeadlessCombat(`catalog-limited-${slotLevel}`, [caster, target])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey(caster.id, target.id)]: 30 }
    const result = resolveDnd5eHeadlessAction(state, { type: 'cast-spell', actorId: caster.id, targetId: target.id,
      targetIds: [target.id], spellId: 'fireball', slotLevel, savingThrowD20: 1, savingThrowD20Second: 20,
      effectRolls: Array(slotLevel + 5).fill(1) })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    expect(result.state.combatants.rakshasa.currentHp).toBe(slotLevel === 6 ? 1000 : 994)
    expect(result.state.combatants.caster.classResources[`dnd5e-spell-slot-${slotLevel}`].current).toBe(0)
    expect(result.events.some(event => event.type === 'spell-negated-by-limited-magic-immunity')).toBe(slotLevel === 6)
    if (slotLevel === 7) expect(result.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: target.id, d20: 20, success: true }))
    record('rakshasa', 'limited-magic-immunity', `spell-level-${slotLevel}`, result.events)
  })

  it('Rakshasa can willingly accept a lower-level allied spell', () => {
    const caster = combatant('caster', 20, { classId: 'wizard', level: 3,
      classSelections: { 'spell-prepared': ['invisibility'] },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } } })
    const target = combatant('rakshasa', 10, { statBlockId: 'srd-5.1:rakshasa' })
    const state = startDnd5eHeadlessCombat('catalog-willing-immunity', [caster, target])
    const result = resolveDnd5eHeadlessAction(state, { type: 'cast-spell', actorId: caster.id, targetId: target.id,
      spellId: 'invisibility', slotLevel: 2, effectRolls: [] })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    expect(result.state.combatants.rakshasa.conditions).toContain('invisible')
    expect(result.events.some(event => event.type === 'spell-negated-by-limited-magic-immunity')).toBe(false)
    record('rakshasa', 'limited-magic-immunity', 'willing-ally', result.events)
  })
})
afterAll(() => {
  const destination = process.env.STARS_MONSTER_INVENTORY_DIR
  if (!destination) return
  const directory = path.resolve(destination)
  if (path.relative(process.cwd(), directory).startsWith('..')) throw new Error('evidence must stay inside repository')
  mkdirSync(directory, { recursive: true })
  writeFileSync(path.join(directory, 'defense-runtime.json'), JSON.stringify(evidence, null, 2))
})
