import { expect, it } from 'vitest'
import { createDnd5eMechanicalEffect, createDnd5eConditionEffect, normalizeDnd5eActiveEffects } from './activeEffects'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, resolveDnd5ePersistentAreaTrigger } from './headlessCombatEngine'
import { dnd5eOptionalBonusDieSourceEligible, validDnd5eOptionalBonusDieSourceConstraint } from './optionalBonusDieEligibility'
import { dnd5eCombatantPairKey } from './headlessCombatPrimitives'

const make = (id: string) => createDnd5eCombatant({ id, name: id, controller: 'player', initiative: id === 'hero' ? 20 : 1,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
  armorClass: 10, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })

it.each(['marked', 'other', 'low', 'ordinary-check', 'missing-binding', 'skip'] as const)(
  'checks Host source and level for a retained die: %s', mode => {
    const hero = make('hero')
    hero.classLevels = { ranger: mode === 'low' ? 6 : 7 }
    const effect = createDnd5eMechanicalEffect({ id: 'prey', definitionId: 'test:prey', label: 'Prey', targetId: 'hero',
      source: { kind: 'feature', actorId: 'hero' }, duration: { type: 'permanent' },
      modifiers: {
        onHitBonusDamage: { count: 1, sides: 6, bonus: 0, damageType: 'inherit-primary', appliesTo: 'all-weapon-attacks',
          doubleDiceOnCritical: true, oncePerTurn: true, consumeEffectOnHit: false,
          ...(mode !== 'missing-binding' ? { boundTargetId: 'marked' } : {}) },
        optionalBonusDie: { sides: 6, appliesTo: ['saving-throw', 'ability-check'], consumeOnUse: false,
          boundTargetSource: { classId: 'ranger', minimumLevel: 7 } },
      } })
    hero.classState.activeEffects = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([effect])))
    expect(hero.classState.activeEffects[0].modifiers?.optionalBonusDie?.boundTargetSource)
      .toEqual({ classId: 'ranger', minimumLevel: 7 })
    const state = startDnd5eHeadlessCombat('bound-die', [hero, make('marked'), make('other')])
    const before = structuredClone(state)
    const optionalBonusDice = mode === 'skip' ? [] : [{ effectId: 'prey', targetId: 'hero',
      rollKind: mode === 'ordinary-check' ? 'ability-check' as const : 'saving-throw' as const, roll: 6 }]
    const result = mode === 'ordinary-check'
      ? resolveDnd5eHeadlessAction(state, { type: 'ability-check', actorId: 'hero', ability: 'dex', d20: 10, dc: 15, optionalBonusDice })
      : resolveDnd5ePersistentAreaTrigger(state, { areaId: 'area', sourceId: mode === 'other' ? 'other' : 'marked',
        targetId: 'hero', d20: 10, damageRolls: [6], optionalBonusDice,
        trigger: { id: 'save', label: 'Save', timing: 'turn-end', savingThrow: { ability: 'dex', dc: 15, onSuccess: 'half' },
          damage: { count: 1, sides: 6, type: 'fire' } } })
    expect(result.ok, JSON.stringify(result.ok ? null : result.reason)).toBe(mode === 'marked' || mode === 'skip')
    expect(state).toEqual(before)
    if (result.ok) {
      expect(result.state.combatants.hero.currentHp).toBe(mode === 'marked' ? 27 : 24)
      expect(result.state.combatants.hero.classState.activeEffects?.some(entry => entry.id === 'prey')).toBe(true)
    } else {
      expect(result.state.combatants.hero.currentHp).toBe(30)
    }
  })

it('requires actual grapple-escape context rather than an arbitrary ability check source', () => {
  const base = { constraint: { classId: 'ranger' as const, minimumLevel: 7 }, classLevel: 7,
    boundTargetId: 'prey', rollKind: 'ability-check' as const }
  expect(dnd5eOptionalBonusDieSourceEligible({ ...base, source: { actorId: 'prey', kind: 'grapple-escape' } })).toBe(true)
  expect(dnd5eOptionalBonusDieSourceEligible({ ...base, source: { actorId: 'other', kind: 'grapple-escape' } })).toBe(false)
  expect(dnd5eOptionalBonusDieSourceEligible({ ...base, source: { actorId: 'prey', kind: 'saving-throw' } })).toBe(false)
  expect(dnd5eOptionalBonusDieSourceEligible(base)).toBe(false)
  for (const invalid of [{ classId: 'ranger', minimumLevel: 0 }, { classId: 'ranger', minimumLevel: 7, actorId: 'client' },
    { classId: 'invented', minimumLevel: 7 }]) expect(validDnd5eOptionalBonusDieSourceConstraint(invalid)).toBe(false)
})

it.each([true, false])('uses the actual grappler identity and rolls back invalid use (marked=%s)', marked => {
  const hero = make('hero'), grappler = make('grappler')
  hero.classLevels = { ranger: 7 }
  grappler.initiative = 30
  grappler.controller = 'dm'
  hero.classState.activeEffects = [createDnd5eMechanicalEffect({
    id: 'prey', definitionId: 'test:prey', label: 'Prey', targetId: 'hero', source: { kind: 'feature', actorId: 'hero' },
    modifiers: {
      onHitBonusDamage: { count: 1, sides: 6, bonus: 0, damageType: 'inherit-primary', appliesTo: 'all-weapon-attacks',
        doubleDiceOnCritical: true, oncePerTurn: true, consumeEffectOnHit: false, boundTargetId: marked ? 'grappler' : 'other' },
      optionalBonusDie: { sides: 6, appliesTo: ['saving-throw', 'ability-check'], consumeOnUse: false,
        boundTargetSource: { classId: 'ranger', minimumLevel: 7 } },
    },
  })]
  const state = startDnd5eHeadlessCombat('grapple-source', [hero, grappler])
  state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('hero', 'grappler')]: 5 }
  const grappled = resolveDnd5eHeadlessAction(state, { type: 'grapple', actorId: 'grappler', targetId: 'hero',
    actorD20: 20, targetD20: 1, targetDefense: 'athletics' })
  expect(grappled.ok, JSON.stringify(grappled.ok ? null : grappled.reason)).toBe(true)
  const next = resolveDnd5eHeadlessAction(grappled.state, { type: 'end-turn', actorId: 'grappler' })
  expect(next.ok).toBe(true)
  const before = structuredClone(next.state)
  const escaped = resolveDnd5eHeadlessAction(next.state, { type: 'escape-grapple', actorId: 'hero', grapplerId: 'grappler',
    actorD20: 10, targetD20: 15, optionalBonusDice: [{ effectId: 'prey', targetId: 'hero', rollKind: 'ability-check', roll: 6 }] })
  expect(escaped.ok, JSON.stringify(escaped.ok ? null : escaped.reason)).toBe(marked)
  expect(next.state).toEqual(before)
  if (escaped.ok) {
    expect(escaped.events).toContainEqual(expect.objectContaining({ type: 'contest-resolved', contest: 'escape-grapple', success: true }))
    expect(escaped.state.combatants.hero.conditions).not.toContain('grappled')
  } else {
    expect(escaped.state.combatants.hero.turn.actionAvailable).toBe(true)
    expect(escaped.state.combatants.hero.conditions).toContain('grappled')
  }
})

it.each(['grapple', 'unrelated-restrain', 'escape-save', 'spell'] as const)(
  'carries authoritative source through %s resolution', mode => {
    const hero = make('hero'), source = make('source')
    hero.classLevels = { ranger: 7 }
    source.controller = 'dm'
    source.classId = 'sorcerer'
    source.level = 1
    source.abilities.cha = 16
    source.classSelections['spell-cantrips'] = ['poison-spray']
    const bonus = createDnd5eMechanicalEffect({ id: 'prey', definitionId: 'test:prey', label: 'Prey', targetId: 'hero',
      source: { kind: 'feature', actorId: 'hero' }, modifiers: {
        onHitBonusDamage: { count: 1, sides: 6, bonus: 0, damageType: 'inherit-primary', appliesTo: 'all-weapon-attacks',
          doubleDiceOnCritical: true, oncePerTurn: true, consumeEffectOnHit: false, boundTargetId: 'source' },
        optionalBonusDie: { sides: 6, appliesTo: ['saving-throw', 'ability-check'], consumeOnUse: false,
          boundTargetSource: { classId: 'ranger', minimumLevel: 7 } },
      } })
    const hold = createDnd5eConditionEffect({ id: 'hold', condition: mode === 'grapple' ? 'grappled' : 'restrained',
      targetId: 'hero', source: { kind: 'monster', actorId: 'source' },
      ...(mode === 'escape-save' ? { escapeSavingThrow: { ability: 'str' as const, dc: 15, economy: 'action' as const } }
        : { escapeCheck: { ability: 'str' as const, dc: 15, economy: 'action' as const } }) })
    hero.classState.activeEffects = mode === 'spell' ? [bonus] : [bonus, hold]
    hero.conditions = mode === 'spell' ? [] : [mode === 'grapple' ? 'grappled' : 'restrained']
    if (mode === 'spell') source.initiative = 30
    const state = startDnd5eHeadlessCombat('source-entry', [hero, source])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('hero', 'source')]: 5 }
    const before = structuredClone(state)
    const optionalBonusDice = [{ effectId: 'prey', targetId: 'hero', roll: 6,
      rollKind: mode === 'spell' || mode === 'escape-save' ? 'saving-throw' as const : 'ability-check' as const }]
    const result = mode === 'spell' ? resolveDnd5eHeadlessAction(state, {
      type: 'cast-spell', actorId: 'source', targetId: 'hero', spellId: 'poison-spray', slotLevel: 0,
      savingThrowD20: 10, effectRolls: [], optionalBonusDice,
    }) : resolveDnd5eHeadlessAction(state, {
      type: 'escape-active-effect', actorId: 'hero', effectId: hold.id, d20: 10, optionalBonusDice,
    })
    expect(result.ok, JSON.stringify(result.ok ? null : result.reason)).toBe(mode !== 'unrelated-restrain')
    expect(state).toEqual(before)
    if (result.ok) {
      expect(result.events).toContainEqual(expect.objectContaining({ type: 'optional-bonus-die-used', roll: 6 }))
      expect(result.state.combatants.hero.currentHp).toBe(30)
      if (mode !== 'spell') expect(result.state.combatants.hero.classState.activeEffects?.some(e => e.id === hold.id)).toBe(false)
    } else expect(result.state.combatants.hero.turn.actionAvailable).toBe(true)
  })
