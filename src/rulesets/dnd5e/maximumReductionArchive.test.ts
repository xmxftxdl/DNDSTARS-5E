import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { normalizeCharacter } from '../../store/characters'
import type { BattleMap } from '../../store/maps'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import { exportDnd5eStarMod, readDnd5eStarMod } from './starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from './unifiedContent'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { prepareDnd5ePluginSpellCast, resolvePreparedDnd5ePluginSpellCast } from './pluginSpellTransaction'
import { advanceDnd5eCampaignTimedActiveEffects } from './campaignTimeRules'
import { collectScaledDnd5eActivityFormulaRollDeclarationsV1 } from './activities/dnd5eActivityRollRecipe'

it.each(['reduction', 'transfer'] as const)('installs a maximum %s archive and settles a player cast without losing its owner', async mode => {
  const transfer = mode === 'transfer'
  const namespace = 'test.portable-reduction', spellId = `${namespace}:reduction`
  const automation = automationCapabilityFromLegacyStatus('full')
  const bundle: Dnd5eUnifiedContentBundleV1 = {
    format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Synthetic reduction', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0', distributionPolicy: 'local-only', contentCategory: 'spells' }, assets: [],
    definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'spell', id: 'reduction', name: 'Reduction', automation,
      payload: { id: 'reduction', name: 'Reduction', level: 2, school: 'transmutation', ritual: false,
        castingTime: { value: 1, unit: 'action' }, range: transfer ? { type: 'distance', feet: 30 } : { type: 'self' },
        components: { verbal: false, somatic: false, material: false },
        duration: { type: 'instantaneous', concentration: false }, classes: ['wizard'],
        description: 'Synthetic protocol fixture, not a converted book spell.', automation: { mode: 'reference-only' } },
      activities: [{ schemaVersion: 1, id: 'reduction', name: 'Reduction', activation: { kind: 'action' },
        target: transfer ? { kind: 'creature', relation: 'ally', count: 1 } : { kind: 'self' }, automation, legacySource: { kind: 'spell', id: 'reduction' },
        choices: [{ id: 'quantity', label: '生命骰数量', options: [{ id: 'one', label: '1d6' }, { id: 'two', label: '2d6' }] }],
        consumption: [1, 2].map(count => ({ kind: 'hit-die', resourceId: 'hit-die:d6', amount: { kind: 'constant', value: count },
          consumeOn: 'resolve', maximumTotalFraction: 0.5, whenChoice: { choiceId: 'quantity', optionIds: [count === 1 ? 'one' : 'two'] } })),
        effects: ['owner', 'beneficiary'].map(id => ({ schemaVersion: 1, id, name: id, stacking: 'replace', duration: { kind: 'rounds', rounds: 20, expiresAt: 'target-turn-end' } })),
        outcomes: [{ id: 'reduce', when: { kind: 'always' }, operations: [
          { id: 'attach', kind: 'apply-effect', target: 'actor', effectId: 'owner' },
          ...(transfer ? [
            { id: 'attach-beneficiary', kind: 'apply-effect' as const, target: 'target' as const, effectId: 'beneficiary' },
          ] : []),
        ] }, ...[1, 2].map(count => ({ id: `quantity-${count}`, when: { kind: 'choice' as const, choiceId: 'quantity', optionId: count === 1 ? 'one' : 'two' },
          operations: [transfer ? { id: `reduce-${count}`, kind: 'transfer-hit-point-maximum' as const, target: 'target' as const, owningEffectId: 'owner', beneficiaryEffectId: 'beneficiary',
            amount: { kind: 'dice' as const, rollId: `transfer-dice-${count}`, count, sides: 6 }, increaseCurrentHp: true, linkLifetimes: true }
            : { id: `reduce-${count}`, kind: 'reduce-hit-point-maximum' as const, target: 'actor' as const, owningEffectId: 'owner', amount: { kind: 'dice' as const, rollId: `transfer-dice-${count}`, count, sides: 6 } }],
        }))] }],
    }],
  }
  const bytes = await exportDnd5eStarMod(bundle)
  for (let install = 0; install < 2; install++) {
    const restored = (await readDnd5eStarMod(bytes)).bundle
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(restored))
    try {
      const actor = normalizeCharacter({ id: 'owner', name: 'Owner', charClass: '法师', level: 5,
        maxHp: 30, currentHp: 30, abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
        hitPointDice: [{ sides: 6, current: 3, max: 5 }],
        dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': [spellId] } } } },
        classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 2 } } })
      const map: BattleMap = { id: 'archive-map', name: 'Map', width: 500, height: 500, gridSize: 50,
        gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [
          { id: 'caster', characterId: actor.id, label: actor.name, type: 'player', x: 25, y: 25, size: 1, color: '', emoji: '' },
        ] }
      const beneficiary = normalizeCharacter({ id: 'recipient', name: 'Recipient', maxHp: 10, currentHp: 5 })
      if (transfer) map.tokens.push({ id: 'recipient', characterId: beneficiary.id, label: beneficiary.name, type: 'player', x: 75, y: 25, size: 1, color: '', emoji: '' })
      const action: SharedPlayerActionState = { id: `cast-${install}`, type: 'dnd5e-spell-cast', sourceMode: 'player', status: 'pending',
        mapId: map.id, actorTokenId: 'caster', characterId: actor.id, round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
        dnd5eSpellCast: { spellId, castingClassId: 'wizard', slotLevel: 2, targetTokenId: transfer ? 'recipient' : 'caster', activityChoices: { quantity: 'two' } } }
      const prepared = prepareDnd5ePluginSpellCast({ action, map, characters: transfer ? [actor, beneficiary] : [actor],
        initiativeOrder: map.tokens.map((token, index) => ({ tokenId: token.id, label: token.label, roll: 20 - index, color: '', emoji: '' })) })
      expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
      if (!prepared.ok) throw Error('Spell preparation failed')
      expect(collectScaledDnd5eActivityFormulaRollDeclarationsV1(prepared.prepared.activity!, { choices: { quantity: 'two' } })).toEqual([{ id: 'transfer-dice-2', count: 2, sides: 6 }])
      for (const values of [[], [3], [7, 4], [3, 4, 1]]) {
        const invalid = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared,
          rolls: { activityRolls: { 'transfer-dice-2': { values, modifier: 0, total: values.reduce((sum, value) => sum + value, 0) } } } })
        expect(invalid.result.ok).toBe(false)
        expect(actor.classResources?.['dnd5e-spell-slot-2'].current).toBe(1)
        expect(actor.maxHp).toBe(30)
      }
      const settled = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared,
        rolls: { activityRolls: { 'transfer-dice-2': { values: [3, 4], modifier: 0, total: 7 } } } })
      expect(settled.result.ok, settled.result.ok ? undefined : settled.result.reason).toBe(true)
      if (!settled.application) throw Error('Missing application')
      const saved = normalizeCharacter(JSON.parse(JSON.stringify(settled.application.characters[0])))
      expect(saved.maxHp).toBe(23)
      expect(saved.currentHp).toBe(23)
      expect(saved.classResources?.['dnd5e-spell-slot-2'].current).toBe(0)
      expect(saved.hitPointDice?.[0].current).toBe(1)
      const entry = saved.dnd5eCombatState?.hitPointMaximumReductionLedger?.entries[0]
      expect(entry?.amount).toBe(7)
      expect(saved.dnd5eCombatState?.activeEffects?.some(effect => effect.id === entry?.sourceEffectId)).toBe(true)
      const expired = advanceDnd5eCampaignTimedActiveEffects(saved, 2)
      expect(expired.maxHp).toBe(30)
      expect(expired.currentHp).toBe(23)
      expect(expired.dnd5eCombatState?.hitPointMaximumReductionLedger).toBeUndefined()
      if (transfer) {
        const receiver = normalizeCharacter(JSON.parse(JSON.stringify(settled.application.characters.find(character => character.id === beneficiary.id))))
        expect(receiver.currentHp).toBe(12)
        const receiverEnded = advanceDnd5eCampaignTimedActiveEffects(receiver, 2)
        expect(receiverEnded.maxHp).toBe(10)
        expect(receiverEnded.currentHp).toBe(10)
      }
      expect(actor.maxHp).toBe(30)
    } finally { dispose() }
  }
})
