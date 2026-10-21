import { expect, it } from 'vitest'
import { readDnd5eDeclaredDamageTraitReport } from './damageTraitReport'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { validateDeclarativeSubclassAbilityV1 } from './declarativeSubclassAbility'
import { createDnd5eCombatant, dnd5eCombatantPairKey, resolveDnd5eHeadlessAction, resolveDnd5eFeatherFallReaction, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { createDnd5eMechanicalEffect, normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict } from './activeEffects'

const ability = {
  schemaVersion: 1 as const, id: 'peace', name: 'Peace fixture', description: 'Synthetic source-scoped protection.',
  level: 3, trigger: { kind: 'passive' as const }, targeting: { kind: 'self' as const }, effects: [], automation: 'full' as const,
  mechanic: { kind: 'passive-defense' as const, creaturePeaceProtection: {
    resistance: true as const, attackReflection: { damageType: 'radiant' as const, multiplier: 0.5 },
  } },
}

it('records every recipient of a multi-target reaction spell without disabling protection against bystanders', () => {
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'test.peace.reaction', name: 'Reaction fixture', version: '1.0.0',
    apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0' }, setup(api) {
    api.registerDeclarativeSubclass({ schemaVersion: 1, id: 'guardian', classId: 'wizard', name: 'Fixture', summary: 'Synthetic', abilities: [ability] })
  } })
  try {
    const make = (id: string) => createDnd5eCombatant({ id, name: id, controller: 'player',
      initiative: id === 'owner' ? 20 : 10, abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
      armorClass: 10, proficiencyBonus: 2, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30,
      position: { x: 0, y: 0 }, concentrating: false })
    const owner = make('owner')
    Object.assign(owner, { classId: 'wizard', level: 3, classLevels: { wizard: 3 },
      subclassId: 'test.peace.reaction:guardian', subclassIds: { wizard: 'test.peace.reaction:guardian' },
      pluginFeatureIds: ['test.peace.reaction:guardian.peace'], classSelections: { 'spell-prepared': ['feather-fall'] },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } } })
    const state = startDnd5eHeadlessCombat('reaction-peace', [owner, make('first'), make('second'), make('bystander')])
    state.distanceFeetByCombatantPair = Object.fromEntries(['first', 'second'].map(id => [dnd5eCombatantPairKey('owner', id), 5]))
    const result = resolveDnd5eFeatherFallReaction(state, { casterId: 'owner',
      falls: ['first', 'second'].map(combatantId => ({ combatantId, fromElevationFeet: 30, groundElevationFeet: 0,
        fallDistanceFeet: 30, fallingDamageDice: 3 })) })
    expect(result.ok, result.ok ? '' : result.reason).toBe(true)
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'spell-cast', targetIds: ['first', 'second'] }))
    const effects = result.state.combatants.owner.classState.activeEffects ?? []
    for (const id of ['first', 'second']) expect(effects.some(effect => effect.tags?.includes(`creature:${id}`))).toBe(true)
    expect(effects.some(effect => effect.tags?.includes('creature:bystander'))).toBe(false)
    expect(result.state.combatants.owner.classResources['dnd5e-spell-slot-1'].current).toBe(0)
    expect(result.state.combatants.owner.turn.reactionAvailable).toBe(false)
    expect(state.combatants.owner.classState.activeEffects ?? []).toEqual([])
  } finally { dispose() }
})

it('rejects malformed imported protection and reflection declarations', () => {
  expect(() => validateDeclarativeSubclassAbilityV1(ability)).not.toThrow()
  for (const multiplier of [0, -1, Infinity, 1.1, '0.5']) {
    expect(() => validateDeclarativeSubclassAbilityV1({ ...ability, mechanic: { ...ability.mechanic,
      creaturePeaceProtection: { resistance: true, attackReflection: { damageType: 'radiant', multiplier } },
    } })).toThrow()
  }
  for (const protection of [{ resistance: false, attackReflection: { damageType: 'radiant', multiplier: 0.5 } },
    { resistance: true, attackReflection: { damageType: 'unknown', multiplier: 0.5 } },
    { ...ability.mechanic.creaturePeaceProtection, arbitraryCallback: 'execute' }]) {
    expect(() => validateDeclarativeSubclassAbilityV1({ ...ability, mechanic: { ...ability.mechanic, creaturePeaceProtection: protection } })).toThrow()
  }
})

it('keeps creature lockouts through strict normalization and does not double resistance or lose protection on its own retaliation', () => {
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'test.peace', name: 'Synthetic protection', version: '1.0.0',
    apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0' }, setup(api) {
    api.registerDeclarativeSubclass({ schemaVersion: 1, id: 'guardian', classId: 'paladin', name: 'Fixture', summary: 'Synthetic', abilities: [ability] })
  } })
  try {
    const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, controller: id === 'owner' ? 'player' : 'dm',
      initiative, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, armorClass: 10, proficiencyBonus: 2,
      currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
    const owner = make('owner', 30)
    Object.assign(owner, { classId: 'paladin', classLevels: { paladin: 3 }, subclassId: 'test.peace:guardian',
      subclassIds: { paladin: 'test.peace:guardian' }, pluginFeatureIds: ['test.peace:guardian.peace'], damageResistances: ['fire'] })
    const initial = startDnd5eHeadlessCombat('peace', [owner, make('first', 20), make('second', 10)])
    const report = readDnd5eDeclaredDamageTraitReport(initial.combatants.owner,{state:initial,targetId:'owner'})
    expect(report.resistances).toEqual(['fire'])
    expect(report.conditional).toContainEqual({outcome:'resistant',sourceCreatureProtection:true})
    expect(JSON.stringify(report)).not.toContain('test.peace')
    expect(JSON.stringify(report)).not.toContain('second')
    const protectedState = structuredClone(initial)
    protectedState.combatants.owner.classState.activeEffects = [createDnd5eMechanicalEffect({
      id: 'divination-ward', definitionId: 'divination-ward', label: 'Ward', targetId: 'owner',
      source: { kind: 'spell', actorId: 'owner' }, modifiers: { spellTargetingImmunitySchools: ['divination'] },
    })]
    expect(readDnd5eDeclaredDamageTraitReport(protectedState.combatants.owner, { state: protectedState, targetId: 'owner' }))
      .toEqual({ immunities: [], resistances: [], vulnerabilities: [], conditional: [] })
    for (const patch of [{classLevels:{paladin:2}}, {subclassId:'other',subclassIds:{paladin:'other'}}, {pluginFeatureIds:[]}]) {
      const invalid=structuredClone(initial)
      Object.assign(invalid.combatants.owner,patch)
      expect(readDnd5eDeclaredDamageTraitReport(invalid.combatants.owner,{state:invalid,targetId:'owner'}).conditional).toEqual([])
    }
    const attack = (state: typeof initial, actorId: string, targetId: string, d20 = 18) => {
      const next = structuredClone(state)
      next.initiativeIndex = next.initiativeOrder.indexOf(actorId)
      return resolveDnd5eHeadlessAction(next, { type: 'attack', actorId, targetId, d20, attackModifier: 5, spendAction: false,
        damage: { count: 1, sides: 10, bonus: 0, rolls: [9], type: 'fire' } })
    }
    const first = attack(initial, 'first', 'owner')
    expect(first.ok).toBe(true)
    expect(first.state.combatants.owner.currentHp).toBe(26)
    expect(first.state.combatants.first.currentHp).toBe(28)
    const repeated = attack(first.state, 'first', 'owner')
    expect(repeated.state.combatants.first.currentHp).toBe(26)
    const miss = attack(initial, 'owner', 'first', 1)
    expect(miss.ok).toBe(true)
    const effects = miss.state.combatants.owner.classState.activeEffects!
    expect(validateDnd5eActiveEffectsStrict(effects).ok).toBe(true)
    miss.state.combatants.owner.classState.activeEffects = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify(effects)))
    expect(miss.state.combatants.owner.classState.activeEffects.some(e => e.tags?.includes('creature-peace-lost'))).toBe(true)
    const lost = attack(miss.state, 'first', 'owner')
    expect(lost.state.combatants.first.currentHp).toBe(30)
    const retained = attack(miss.state, 'second', 'owner')
    expect(retained.state.combatants.second.currentHp).toBe(28)
    expect(readDnd5eDeclaredDamageTraitReport(retained.state.combatants.owner,{state:retained.state,targetId:'owner'}).conditional)
      .toContainEqual({outcome:'resistant',sourceCreatureProtection:true})
    expect(initial.combatants.owner.currentHp).toBe(30)
  } finally { dispose() }
})
