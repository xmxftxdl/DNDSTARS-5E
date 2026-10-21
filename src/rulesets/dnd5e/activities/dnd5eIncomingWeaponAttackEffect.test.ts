import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict, dnd5eActiveTargetLinkedAttackRollFlags } from '../activeEffects'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, dnd5eMonsterSpellAttackMode } from '../headlessCombatEngine'
import { prepareDnd5eLocalContentJson } from '../localContentCollection'
import { dnd5eRulesPluginFromContentPackageV2 } from '../contentPackageV2'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

const activity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'wind-guard', name: 'Synthetic wind guard', activation: { kind: 'free' }, target: { kind: 'self' },
  legacySource: { kind: 'feature', id: 'wind-guard' }, automation: automationCapabilityFromLegacyStatus('full'),
  effects: [{ schemaVersion: 1, id: 'guard', name: 'Guard', duration: { kind: 'rounds', rounds: 2, expiresAt: 'target-turn-end' }, stacking: 'replace',
    modifiers: [{ kind: 'weapon-attacks-against-target', mode: 'disadvantage', delivery: 'ranged' }] }],
  outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [{ id: 'apply', kind: 'apply-effect', target: 'actor', effectId: 'guard' }] }],
}

function make(id: string, initiative: number) {
  return createDnd5eCombatant({ id, name: id, controller: id === 'attacker' ? 'player' : 'dm', initiative, level: 3, proficiencyBonus: 2,
    abilities: { str: 14, dex: 14, con: 14, int: 16, wis: 10, cha: 10 }, armorClass: 12, conditions: [], currentHp: 30, maxHp: 30,
    temporaryHp: 0, speed: 30, position: { x: id === 'defender' ? 30 : 0, y: 0 }, concentrating: false,
    classId: 'wizard', classSelections: { 'spell-cantrips': ['fire-bolt'] } })
}

it('imports a defender-side ranged weapon effect and limits actual Host rolls by attack category and delivery', async () => {
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  const parsed = await prepareDnd5eLocalContentJson(JSON.stringify({ name: 'Synthetic defense', features: [{
    id: 'wind-guard', name: 'Wind guard', summary: 'Test', description: 'Test', automation: 'full',
  }], activities: [activity] }))
  const pkg = parsed.package, dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
  try {
    const defender = make('defender', 20), attacker = make('attacker', 10)
    const featureId = `${pkg.manifest.id}:wind-guard`
    defender.pluginFeatureIds = [featureId]
    const initial = startDnd5eHeadlessCombat('incoming-defense', [defender, attacker])
    const cast = resolveDnd5eHeadlessAction(initial, { type: 'plugin', pluginId: pkg.manifest.id, actionId: activity.id,
      featureId, actorId: defender.id, targetId: defender.id, rolls: {} })
    expect(cast.ok, cast.ok ? '' : cast.reason).toBe(true)
    const state = { ...cast.state, initiativeIndex: 1 }
    const effects = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify(state.combatants.defender.classState.activeEffects)))
    expect(effects[0].modifiers?.weaponAttacksAgainstTarget).toEqual([{ mode: 'disadvantage', delivery: 'ranged' }])
    expect(validateDnd5eActiveEffectsStrict(effects).ok).toBe(true)
    for (const delivery of ['melee', 'ranged'] as const) for (const category of ['weapon', 'spell'] as const) {
      const expected = delivery === 'ranged' && category === 'weapon' ? 'disadvantage' : 'normal'
      const branch = structuredClone(state)
      branch.combatants.defender.position = { x: delivery === 'ranged' ? 30 : 5, y: 0 }
      const hit = resolveDnd5eHeadlessAction(branch, { type: 'attack', actorId: 'attacker', targetId: 'defender', attackModifier: 5,
        d20: 15, d20Second: expected === 'disadvantage' ? 4 : undefined, damage: { count: 1, sides: 6, bonus: 0, rolls: [3] },
        classDamageContext: { mode: delivery, spellAttack: category === 'spell', spellDeliveredByWeapon: category === 'spell',
          weaponId: 'dagger', strengthBased: false, finesse: true, distanceFeet: delivery === 'ranged' ? 30 : 5,
          normalRangeFeet: 60, longRangeFeet: 120, weaponDamageSides: 6, damageType: 'piercing', adjacentEnemyOfTarget: false } })
      expect(hit.ok, hit.ok ? '' : hit.reason).toBe(true)
      expect(hit.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', rollMode: expected }))
    }
    const spell = resolveDnd5eHeadlessAction(state, { type: 'cast-spell', actorId: 'attacker', targetId: 'defender',
      spellId: 'fire-bolt', slotLevel: 0, d20: 15, effectRolls: [4] })
    expect(spell.ok, spell.ok ? '' : spell.reason).toBe(true)
    expect(spell.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', attackMode: 'spell', d20: 15 }))
    expect(dnd5eMonsterSpellAttackMode(state, 'attacker', 'defender', 'ranged', 'int')).toBe('normal')
    expect(dnd5eActiveTargetLinkedAttackRollFlags(effects, 'attacker').disadvantage).toBe(false)
    const combined=structuredClone(effects)
    combined[0].modifiers!.weaponAttacksAgainstTarget=[{mode:'advantage'},{mode:'disadvantage',delivery:'ranged'}]
    for(const delivery of ['melee','ranged'] as const){
      const flags=dnd5eActiveTargetLinkedAttackRollFlags(combined,'attacker',undefined,undefined,{category:'weapon',delivery})
      expect(flags.advantage).toBe(true)
      expect(flags.disadvantage).toBe(delivery==='ranged')
    }
    expect(dnd5eActiveTargetLinkedAttackRollFlags(combined,'attacker',undefined,undefined,{category:'spell',delivery:'ranged'})).toMatchObject({advantage:false,disadvantage:false})
    expect(dnd5eActiveTargetLinkedAttackRollFlags([{ ...effects[0], suspendedBy: ['antimagic'] }], 'attacker', undefined, undefined,
      { category: 'weapon', delivery: 'ranged' }).disadvantage).toBe(false)
    let expired = cast.state
    for (let i = 0; i < 6; i++) {
      const next = resolveDnd5eHeadlessAction(expired, { type: 'end-turn', actorId: expired.initiativeOrder[expired.initiativeIndex] })
      expect(next.ok).toBe(true); expired = next.state
    }
    expect(dnd5eActiveTargetLinkedAttackRollFlags(expired.combatants.defender.classState.activeEffects, 'attacker', undefined, undefined,
      { category: 'weapon', delivery: 'ranged' }).disadvantage).toBe(false)
    const malformed = structuredClone(effects) as any
    malformed[0].modifiers.weaponAttacksAgainstTarget[0].delivery = 'invented'
    expect(validateDnd5eActiveEffectsStrict(malformed).ok).toBe(false)
    expect(normalizeDnd5eActiveEffects(malformed)[0]?.modifiers?.weaponAttacksAgainstTarget).toBeUndefined()
  } finally { dispose() }
})

it.each(['mode', 'delivery'])('rejects malformed public incoming weapon %s', field => {
  const invalid = structuredClone(activity) as any
  invalid.effects[0].modifiers[0][field] = 'unknown'
  expect(validateDnd5eActivityDefinitionV1(invalid).join('\n')).toContain('incoming weapon attack')
})
