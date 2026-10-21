import { expect, it } from 'vitest'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, dnd5eAbilityCheckRollMode } from './headlessCombatEngine'
import { createDnd5eConditionEffect } from './activeEffects'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { dnd5ePluginFeatDefinition, dnd5ePluginFeatAvailableForCharacter } from './plugins/pluginContentCatalog'
import { normalizeCharacter } from '../../store/characters'

it.each(['grappled', 'restrained'] as const)('limits fixed-DC escape advantage to grappled, not %s generally', condition => {
  const actor = createDnd5eCombatant({ id: 'actor', name: 'Actor', controller: 'player', initiative: 20,
    abilities: { str: 14, dex: 14, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
    armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 },
    concentrating: false, grappleEscapeAdvantage: true })
  const effect = createDnd5eConditionEffect({ id: 'binding', definitionId: 'binding',
    targetId: actor.id, condition, source: { kind: 'feature', actorId: 'other' },
    escapeCheck: { ability: 'str', skill: 'athletics', alternativeAbility: 'dex', alternativeSkill: 'acrobatics', dc: 15, economy: 'action' } })
  actor.classState.activeEffects = [effect]
  const other = createDnd5eCombatant({ ...actor, id: 'other', name: 'Other', controller: 'dm', initiative: 10, classState: {} })
  const state = startDnd5eHeadlessCombat('escape', [actor, other])
  const result = resolveDnd5eHeadlessAction(state, { type: 'escape-active-effect', actorId: actor.id, effectId: effect.id, d20: 2, d20Second: 20 })
  expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
  expect(result.state.combatants.actor.classState.activeEffects?.some(e => e.id === effect.id) ?? false).toBe(condition === 'restrained')
  expect(result.state.combatants.actor.turn.actionAvailable).toBe(false)
  expect(dnd5eAbilityCheckRollMode(actor, { ability: 'str', skill: 'athletics' })).toBe('normal')
  expect(dnd5eAbilityCheckRollMode(actor, { ability: 'int', skill: 'arcana', grappleEscape: true })).toBe('normal')
})

it('supports ancestry size alternatives for installed races', () => {
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'test.escape', name: 'Escape', version: '1.0.0', apiVersion: 2,
    rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Test', license: 'CC0' }, setup(api) {
    api.registerRace({ id: 'small', name: 'Small ancestry', size: 'small', speedFeet: 25 })
    api.registerRace({ id: 'medium', name: 'Medium ancestry', size: 'medium', speedFeet: 30 })
    api.registerFeat({ id: 'escape', name: 'Escape', summary: 'Test', description: 'Test', automation: 'full',
      prerequisite: { raceIds: ['dwarf'], raceSizes: ['small'] }, staticModifiers: { grappleEscapeAdvantage: true } })
  } })
  try {
    const feat = dnd5ePluginFeatDefinition('test.escape:escape')!
    expect(feat.prerequisite?.raceSizes).toEqual(['small'])
    for (const [race, eligible] of [['dwarf', true], ['gnome', true], ['test.escape:small', true], ['test.escape:medium', false], ['human', false]] as const) {
      const character = normalizeCharacter({ id: 'hero', name: 'Hero', charClass: '战士', level: 4, race, dnd5eRaceId: race })
      expect(dnd5ePluginFeatAvailableForCharacter(feat, character), race).toBe(eligible)
    }
  } finally { dispose() }
})
