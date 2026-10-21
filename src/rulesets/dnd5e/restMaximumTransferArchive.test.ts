import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import type { BattleMap } from '../../store/maps'
import type { SharedCampaignTimeState } from '../../lib/campaignTime'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { exportDnd5eStarMod, readDnd5eStarMod } from './starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from './unifiedContent'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { prepareDnd5ePluginFeatureAction, resolvePreparedDnd5ePluginFeatureAction } from './pluginFeatureAction'
import { reconcileDnd5eCharacterCampaignTime, reconcileDnd5eSourceEffectLifecycles, reconcileDnd5eCampaignRosterSourceEffects } from './campaignTimeRules'
import { dnd5eActiveHitPointMaximumBonus, removeDnd5eActiveEffectsByIds, applyDnd5eActiveEffect } from './activeEffects'
import { dnd5ePluginFeatureActionFromActivityV1 } from './activities/dnd5eActivityFeatureActionAdapter'
import { compileDnd5eActivityPatternV1 } from './activities/dnd5eActivityPatterns'

// A portable protocol fixture, not proof that the original PDF spell was converted.
it('imports mixed Hit Dice rest funding, commits its receipt, and restores linked maxima after reload', async () => {
  const namespace = 'test.rest-transfer', featureId = `${namespace}:fund`
  const automation = automationCapabilityFromLegacyStatus('full')
  const activity = compileDnd5eActivityPatternV1({
    schemaVersion: 1, id: 'fund', name: 'Rest funding', activation: { kind: 'free' },
    invocation: { kind: 'triggered', event: 'long-rest-complete', confirmation: 'actor-choice', retention: 'single-event' },
    target: { kind: 'creature', relation: 'ally', count: 1 }, source: { kind: 'feature', id: 'fund' },
    pattern: 'hit-dice-benefit', pools: [{ sides: 6, maximumCount: 2 }, { sides: 10, maximumCount: 2 }],
    abilityPerDie: 'con', maximumTotalFraction: 0.5,
    effects: ['debit', 'credit'].map(id => ({ schemaVersion: 1, id, name: id, stacking: 'replace', duration: { kind: 'permanent' }, breakOn: ['source-long-rest-complete'] })),
    setup: [
      { id: 'debit', kind: 'apply-effect', target: 'actor', effectId: 'debit' },
      { id: 'credit', kind: 'apply-effect', target: 'target', effectId: 'credit' },
    ],
    result: { kind: 'transfer-hit-point-maximum', target: 'target', owningEffectId: 'debit', beneficiaryEffectId: 'credit', increaseCurrentHp: true, linkLifetimes: true, protectLinkedLifetime: true },
  })
  const bundle: Dnd5eUnifiedContentBundleV1 = {
    format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Synthetic rest transfer', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0', distributionPolicy: 'local-only' }, assets: [],
    definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'fund', name: 'Rest funding', automation,
      payload: { id: 'fund', name: 'Rest funding', summary: 'Synthetic', description: 'Synthetic protocol fixture.', automation: 'full',
        action: dnd5ePluginFeatureActionFromActivityV1(activity) }, activities: [activity] }],
  }
  const bytes = await exportDnd5eStarMod(bundle)
  for (let install = 0; install < 2; install++) {
    const restored = (await readDnd5eStarMod(bytes)).bundle
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(restored))
    try {
      const clock: SharedCampaignTimeState = { schemaVersion: 2, worldMinute: 480, displayMode: 'campaign-day', displayMinuteOffset: 0, timers: [], updatedAt: 1,
        advances: [{ id: 'rest', kind: 'long-rest', fromWorldMinute: 0, toWorldMinute: 480, minutes: 480, reason: 'Test', dawnsCrossed: 0, expiredTimerIds: [], createdAt: 1, beneficiaryCharacterIds: ['owner'] }] }
      const initial = normalizeCharacter({ id: 'owner', name: 'Owner', charClass: '法师', level: 5, maxHp: 30, currentHp: 30,
        abilities: { str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 }, dnd5eWorldTimeAppliedMinute: 0,
        dnd5ePluginFeatureIds: [featureId], hitPointDice: [{ sides: 6, current: 3, max: 3 }, { sides: 10, current: 2, max: 2 }] })
      const owner = reconcileDnd5eCharacterCampaignTime(initial, clock).character
      const receiver = normalizeCharacter({ id: 'receiver', name: 'Receiver', maxHp: 10, currentHp: 3 })
      const characters = [owner, receiver]
      const map: BattleMap = { id: 'rest-map', name: 'Map', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
        tokens: characters.map((character, index) => ({ id: `${character.id}-token`, characterId: character.id, label: character.name, type: 'player', x: 25 + index * 50, y: 25, size: 1, color: '', emoji: '' })) }
      const action: SharedPlayerActionState = { id: `fund-${install}`, type: 'dnd5e-plugin-action', sourceMode: 'player', status: 'pending',
        mapId: map.id, actorTokenId: 'owner-token', characterId: owner.id, targetTokenId: 'receiver-token', round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
        dnd5ePluginAction: { featureId, payload: { restEventId: owner.dnd5eRestActivityWindow!.eventId, activityChoices: { 'hit-dice-6': '1', 'hit-dice-10': '1' } } } }
      const prepare = (roster = characters) => prepareDnd5ePluginFeatureAction({ action, map, characters: roster,
        initiativeOrder: map.tokens.map((token, index) => ({ tokenId: token.id, label: token.label, roll: 20 - index, color: '', emoji: '' })) })
      const prepared = prepare()
      expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
      if (!prepared.ok) throw Error('Preparation failed')
      const input = { prepared: prepared.prepared, restAuthority: { clock, combatRevision: 1 },
        rolls: { 'hit-dice-6-1': { values: [3], modifier: 0, total: 3 }, 'hit-dice-10-1': { values: [7], modifier: 0, total: 7 } } }
      const invalid = await resolvePreparedDnd5ePluginFeatureAction({ ...input, rolls: { ...input.rolls, 'hit-dice-10-1': { values: [11], modifier: 0, total: 11 } } })
      expect(invalid.result.ok).toBe(false)
      expect(invalid.application).toBeUndefined()
      expect(owner.dnd5eRestActivityWindow!.receipts).toEqual({})
      const settled = await resolvePreparedDnd5ePluginFeatureAction(input)
      expect(settled.result.ok, settled.result.ok ? undefined : settled.result.reason).toBe(true)
      if (!settled.application) throw Error('Missing atomic application')
      const saved = settled.application.characters.map(character => normalizeCharacter(JSON.parse(JSON.stringify(character))))
      const donor = saved.find(character => character.id === owner.id)!
      const recipient = saved.find(character => character.id === receiver.id)!
      expect(donor.hitPointDice?.map(pool => pool.current)).toEqual([2, 1])
      expect(donor.maxHp).toBe(16)
      expect(donor.currentHp).toBe(16)
      expect(donor.dnd5eCombatState?.hitPointMaximumReductionLedger?.entries.map(entry => entry.amount)).toEqual([5, 9])
      expect(recipient.currentHp).toBe(17)
      expect(dnd5eActiveHitPointMaximumBonus(recipient.dnd5eCombatState?.activeEffects)).toBe(14)
      for (const character of [donor, recipient]) {
        const effects = character.dnd5eCombatState!.activeEffects!
        const anchor = effects.find(effect => effect.linkedLifetime)!
        expect(anchor.linkedLifetime?.protectedRemoval).toBe(true)
        expect(removeDnd5eActiveEffectsByIds({ effects, ids: [anchor.id] }).removed).toEqual([])
        expect(applyDnd5eActiveEffect({ effects, incoming: { ...anchor, linkedLifetime: undefined } }).status).toBe('rejected-duplicate')
      }
      expect(settled.application.characterPatches?.owner?.dnd5eRestActivityWindow?.receipts).toEqual({ '["test.rest-transfer","fund"]': 'used' })
      const replay = prepare(saved)
      expect(replay.ok).toBe(true)
      if (!replay.ok) throw Error('Reload preparation failed')
      const denied = await resolvePreparedDnd5ePluginFeatureAction({ ...input, prepared: replay.prepared })
      expect(denied.result.ok).toBe(false)
      expect(denied.application).toBeUndefined()
      const nextClock: SharedCampaignTimeState = { ...clock, worldMinute: 1920, advances: [{ ...clock.advances[0],
        id: 'next-rest', fromWorldMinute: 480, toWorldMinute: 1920, minutes: 1440 }] }
      const rested = reconcileDnd5eCampaignRosterSourceEffects(saved.map(character => reconcileDnd5eCharacterCampaignTime(character, nextClock)))
      expect(rested.find(result => result.character.id === owner.id)?.longRestsApplied).toBe(1)
      expect(rested.find(result => result.character.id === owner.id)?.character.maxHp).toBe(30)
      expect(rested.find(result => result.character.id === owner.id)?.character.currentHp).toBe(30)
      expect(dnd5eActiveHitPointMaximumBonus(rested.find(result => result.character.id === receiver.id)?.character.dnd5eCombatState?.activeEffects)).toBe(0)
      for (const cause of ['source-rest', 'recipient-death'] as const) {
        const changed = saved.map(character => cause === 'recipient-death' && character.id === receiver.id
          ? normalizeCharacter({ ...character, currentHp: 0, deathSaveFailures: 3 })
          : cause === 'source-rest' && character.id === owner.id
            ? normalizeCharacter({ ...character, dnd5eLastLongRestWorldMinute: 960 }) : character)
        const ended = reconcileDnd5eSourceEffectLifecycles(changed)
        expect(ended.find(character => character.id === owner.id)?.maxHp).toBe(30)
        expect(ended.find(character => character.id === owner.id)?.currentHp).toBe(16)
        expect(dnd5eActiveHitPointMaximumBonus(ended.find(character => character.id === receiver.id)?.dnd5eCombatState?.activeEffects)).toBe(0)
        expect(reconcileDnd5eSourceEffectLifecycles(ended)).toEqual(ended)
      }
      expect(owner.maxHp).toBe(30)
      expect(owner.hitPointDice?.map(pool => pool.current)).toEqual([3, 2])
    } finally { dispose() }
  }
})
