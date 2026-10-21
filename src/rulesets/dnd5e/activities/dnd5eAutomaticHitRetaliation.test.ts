import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eConditionEffect } from '../activeEffects'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { prepareDnd5eLocalContentJson } from '../localContentCollection'
import { dnd5eRulesPluginFromContentPackageV2 } from '../contentPackageV2'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { settleDnd5eActivityTriggerWindowsV1 } from './dnd5eActivityTriggerSettlement'

it.each(['hit', 'lethal', 'spell', 'spell-lethal', 'miss', 'immune', 'unowned', 'incapacitated', 'no-reaction', 'attacker-dies'])(
  'settles automatic imported retaliation at hit time and does not replay it: %s', async mode => {
    const { package: pkg } = await prepareDnd5eLocalContentJson(JSON.stringify({ name: 'Synthetic retaliation',
      features: [{ id: 'retaliate', name: 'Retaliate', description: 'Test', summary: 'Test', automation: 'full' }],
      activities: [{ schemaVersion: 1, id: 'retaliate', name: 'Retaliate',
        automation: automationCapabilityFromLegacyStatus('full'), legacySource: { kind: 'feature', id: 'retaliate' },
        activation: { kind: 'special', timing: 'hit' },
        invocation: { kind: 'triggered', event: 'reaction-window', confirmation: 'automatic', retention: 'single-event' },
        target: { kind: 'creature', relation: 'any', count: 1 }, requirements: [{ kind: 'attack-result', result: 'hit' }],
        outcomes: [{ id: 'retaliate', when: { kind: 'always' }, operations: [{ id: 'damage', kind: 'damage', target: 'target',
          damageType: 'cold', amount: { kind: 'constant', value: 3 } }] }],
      }],
    }))
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
    try {
      const make = (id: string) => createDnd5eCombatant({ id, name: id, controller: id === 'attacker' ? 'player' : 'dm',
        initiative: id === 'attacker' ? 20 : 10, level: 3, proficiencyBonus: 2, armorClass: 10,
        abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 }, currentHp: 30, maxHp: 30,
        temporaryHp: 0, speed: 30, position: { x: id === 'attacker' ? 0 : 30, y: 0 }, concentrating: false,
        classId: 'wizard', classSelections: { 'spell-cantrips': ['fire-bolt'] } })
      const attacker = make('attacker'), defender = make('defender')
      if (mode !== 'unowned') defender.pluginFeatureIds = [`${pkg.manifest.id}:retaliate`]
      if (mode.includes('lethal')) defender.currentHp = 1
      if (mode === 'attacker-dies') attacker.currentHp = 1
      if (mode === 'immune') defender.damageImmunities = ['slashing']
      if (mode === 'incapacitated') defender.classState.activeEffects = [createDnd5eConditionEffect({
        condition: 'incapacitated', targetId: defender.id, source: { kind: 'dm' }, duration: { type: 'permanent' },
      })]
      if (mode === 'incapacitated') defender.conditions = ['incapacitated']
      const state = startDnd5eHeadlessCombat('retaliation', [attacker, defender])
      if (mode === 'no-reaction') state.combatants.defender.turn.reactionAvailable = false
      const before = JSON.stringify(state)
      const hit = resolveDnd5eHeadlessAction(state, mode.startsWith('spell')
        ? { type: 'cast-spell', actorId: 'attacker', targetId: 'defender', spellId: 'fire-bolt', slotLevel: 0, d20: 15, effectRolls: [4] }
        : { type: 'attack', actorId: 'attacker', targetId: 'defender', attackModifier: 5, d20: mode === 'miss' ? 1 : 15,
          damage: { count: 1, sides: 6, bonus: 0, rolls: [4], type: 'slashing' } })
      expect(hit.ok, hit.ok ? '' : hit.reason).toBe(true)
      expect(JSON.stringify(state)).toBe(before)
      const triggered = !['unowned', 'miss', 'incapacitated'].includes(mode)
      const expected = mode === 'attacker-dies' ? 0 : triggered ? 27 : 30
      expect(hit.state.combatants.attacker.currentHp).toBe(expected)
      expect(hit.state.combatants.defender.currentHp).toBe(mode.includes('lethal') ? 0 : ['immune', 'miss'].includes(mode) ? 30 : 26)
      if (triggered) expect(hit.events.find(event => event.type === 'attack-resolved')).toMatchObject({
        handledHitActivities: [{ packageId: pkg.manifest.id, activityId: 'retaliate' }],
      })
      const replay = await settleDnd5eActivityTriggerWindowsV1({ state: JSON.parse(JSON.stringify(hit.state)),
        events: JSON.parse(JSON.stringify(hit.events)), eventBatchId: 'committed', combatRevision: 1,
        confirm: async () => { throw Error('No prompt expected') }, roll: async () => { throw Error('No roll expected') } })
      expect(replay.state.combatants.attacker.currentHp).toBe(expected)
    } finally { dispose() }
  },
)
