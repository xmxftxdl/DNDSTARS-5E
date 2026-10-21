import { expect, it } from 'vitest'
import { createDnd5eConditionEffect } from './activeEffects'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction,
  dnd5eCombatantPairKey, reconcileDnd5eSourceConditionAuras, dnd5eEffectiveSpeed } from './headlessCombatEngine'

it('recomputes source-conditioned aura movement and automatic turn damage from owned features', () => {
  const namespace = 'test.source-condition-aura', featureId = `${namespace}:test-aura.aura`
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: namespace, name: 'Aura test', version: '1.0.0', apiVersion: 2,
    rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    api.registerDeclarativeSubclass({ schemaVersion: 1, id: 'test-aura', name: 'Test', summary: 'Synthetic', classId: 'fighter',
      abilities: [{ schemaVersion: 1, id: 'aura', name: 'Aura', description: 'Synthetic', level: 4,
        trigger: { kind: 'passive' }, targeting: { kind: 'self' }, effects: [], automation: 'full',
        mechanic: { kind: 'source-condition-aura', condition: 'frightened', radiusFeet: 15,
          speedMaximumFeet: 0, turnStartDamage: { type: 'cold', classLevelDivisor: 3 } } }] })
  } })
  try {
    const make = (id: string) => createDnd5eCombatant({ id, name: id, controller: id === 'source' ? 'player' : 'dm',
      initiative: id === 'source' ? 20 : 10, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      proficiencyBonus: 3, armorClass: 12, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30,
      position: { x: id === 'source' ? 0 : 10, y: 0 }, concentrating: false })
    const source = make('source'), target = make('target')
    Object.assign(source, { level: 10, classId: 'fighter', classLevels: { fighter: 10 },
      subclassIds: { fighter: `${namespace}:test-aura` }, pluginFeatureIds: [featureId] })
    target.classState.activeEffects = [createDnd5eConditionEffect({ condition: 'frightened', targetId: target.id,
      source: { kind: 'feature', actorId: source.id }, duration: { type: 'permanent' } })]
    target.conditions = ['frightened']
    const state = startDnd5eHeadlessCombat('aura', [source, target])
    const key = dnd5eCombatantPairKey(source.id, target.id)
    state.distanceFeetByCombatantPair = { [key]: 10 }
    const before = structuredClone(state)
    const next = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: source.id })
    expect(next.ok).toBe(true)
    expect(state).toEqual(before)
    expect(next.state.combatants.target.currentHp).toBe(17)
    expect(dnd5eEffectiveSpeed(next.state.combatants.target)).toBe(0)
    const movement = resolveDnd5eHeadlessAction(next.state, { type: 'move', actorId: target.id, to: { x: 15, y: 0 }, distance: 5 })
    expect(movement.ok).toBe(false)
    const ended = resolveDnd5eHeadlessAction(JSON.parse(JSON.stringify(next.state)), { type: 'end-turn', actorId: target.id })
    expect(ended.ok).toBe(true)
    expect(ended.state.combatants.target.currentHp).toBe(17)
    const nextRound = resolveDnd5eHeadlessAction(ended.state, { type: 'end-turn', actorId: source.id })
    expect(nextRound.ok).toBe(true)
    expect(nextRound.state.combatants.target.currentHp).toBe(14)
    const saved = JSON.parse(JSON.stringify(next.state))
    saved.distanceFeetByCombatantPair[key] = 30
    reconcileDnd5eSourceConditionAuras(saved)
    expect(dnd5eEffectiveSpeed(saved.combatants.target)).toBe(30)
    saved.distanceFeetByCombatantPair[key] = 10
    reconcileDnd5eSourceConditionAuras(saved)
    expect(dnd5eEffectiveSpeed(saved.combatants.target)).toBe(0)
    saved.combatants.source.pluginFeatureIds = []
    reconcileDnd5eSourceConditionAuras(saved)
    expect(dnd5eEffectiveSpeed(saved.combatants.target)).toBe(30)
  } finally { dispose() }
})

