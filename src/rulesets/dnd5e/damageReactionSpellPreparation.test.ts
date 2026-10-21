import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { createDnd5eCombatant } from './headlessCombatEngine'
import { prepareDnd5eDamageReactionSpell } from './damageReactionSpellPreparation'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { DND5E_QUARTERSTAFF, DND5E_SHIELD } from './equipment'

it.each(['valid', 'no-character', 'unknown-spell', 'silenced', 'hands-full', 'no-slot', 'no-reaction', 'wrong-event', 'missing-cost', 'wrong-minimum', 'rage'] as const)(
  'prepares reaction spell from Host metadata and effective state (%s)', mode => {
    const packageId = 'test.reaction-spell-preparation'
    let spellId = ''
    const dispose = registerDnd5eRulesPlugin({ manifest: { id: packageId, name: 'Synthetic', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
      spellId = api.registerSpell({ id: 'ward', name: 'Synthetic ward', level: 1, school: 'abjuration', ritual: false,
        castingTime: { value: 1, unit: 'reaction', reactionTrigger: 'Synthetic incoming damage.' }, range: { type: 'self' },
        components: { verbal: true, somatic: true, material: false }, duration: { type: 'instantaneous', concentration: false },
        classes: ['wizard'], description: 'Synthetic test.', automation: { mode: 'reference-only' } })
    } })
    try {
      const character = normalizeCharacter({ id: 'character', name: 'Mage', charClass: '法师', level: 3,
        dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': mode === 'unknown-spell' ? [] : [spellId] } } } } })
      const actor = createDnd5eCombatant({ id: 'token', name: 'Mage', controller: 'player', initiative: 20, classId: 'wizard', level: 3,
        classLevels: { wizard: 3 }, abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 }, proficiencyBonus: 2,
        armorClass: 12, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false,
        classResources: { 'dnd5e-spell-slot-1': { current: mode === 'no-slot' ? 0 : 2, max: 2 } } })
      const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'ward-cast', name: 'Ward',
        legacySource: { kind: 'spell', id: 'ward' }, activation: { kind: 'reaction' }, target: { kind: 'self' },
        invocation: { kind: 'triggered', event: mode === 'wrong-event' ? 'reaction-window' : 'before-damage', confirmation: 'actor-choice' },
        consumption: mode === 'missing-cost' ? [] : [{ kind: 'spell-slot', minimumLevel: mode === 'wrong-minimum' ? 2 : 1, level: 'selected', amount: 1, consumeOn: 'resolve' }],
        outcomes: [], automation: automationCapabilityFromLegacyStatus('full') }
      if (mode === 'silenced') actor.soundSuppressed = true // Sheet itself still says no silence.
      if (mode === 'hands-full') character.equipment = { mainWeapon: DND5E_QUARTERSTAFF, offHand: DND5E_SHIELD }
      if (mode === 'no-reaction') actor.turn.reactionAvailable = false
      if (mode === 'rage') actor.classState.rageTurnsRemaining = 3
      const before = structuredClone({ actor, character, activity })
      const result = prepareDnd5eDamageReactionSpell({ packageId, activity, actor, character: mode === 'no-character' ? undefined : character })
      expect(result.ok, JSON.stringify(result)).toBe(mode === 'valid')
      if (result.ok) expect(result).toMatchObject({ spellId, castingClassId: 'wizard', availableCastLevels: [1], componentCheck: { verbal: 'available', somatic: 'available' } })
      expect({ actor, character, activity }).toEqual(before)
    } finally { dispose() }
  },
)
