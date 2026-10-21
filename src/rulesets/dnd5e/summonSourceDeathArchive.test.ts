import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { normalizeCharacter } from '../../store/characters'
import { migrateMapsState, type BattleMap, type Token } from '../../store/maps'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import { exportDnd5eStarMod, readDnd5eStarMod } from './starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from './unifiedContent'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { prepareDnd5ePluginSpellCast, resolvePreparedDnd5ePluginSpellCast } from './pluginSpellTransaction'
import { reconcileDnd5eSummonSourceDeathsAcrossMaps } from './mapBridge'
import { applyDnd5eActivityDeferredMapHandoffs, dnd5eActivityDelayedBoundary } from './activities/dnd5eActivityDeferredMapHandoffs'
import { initializeDnd5eActivityTurnClock } from './activities/dnd5eActivityTurnClock'
import { settleDnd5ePersistentAreaTurnTransition } from '../../pages/maps/persistentAreaTurnBoundary'

it.each(['immediate', 'source-next-turn-start'] as const)('exports and reinstalls a synthetic death-bound summon through player spell settlement (%s)', async timing => {
  const namespace = `test.portable-companion-${timing}`, spellId = `${namespace}:companion`
  const automation = automationCapabilityFromLegacyStatus('full')
  const bundle: Dnd5eUnifiedContentBundleV1 = {
    format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Synthetic companion', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0', distributionPolicy: 'local-only', contentCategory: 'spells' }, assets: [],
    definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'spell', id: 'companion', name: 'Companion', automation,
      payload: { id: 'companion', name: 'Companion', level: 2, school: 'conjuration', ritual: false,
        castingTime: { value: 1, unit: 'action' }, range: { type: 'self' },
        components: { verbal: false, somatic: false, material: false },
        duration: { type: 'instantaneous', concentration: false }, classes: ['wizard'],
        description: 'Synthetic protocol fixture, not a converted book spell.', automation: { mode: 'reference-only' } },
      activities: [{ schemaVersion: 1, id: 'companion', name: 'Companion', activation: { kind: 'action' },
        target: { kind: 'self' }, automation, legacySource: { kind: 'spell', id: 'companion' },
        outcomes: [{ id: 'create', when: { kind: 'always' }, operations: [{ id: 'summon', kind: 'summon',
          monsterId: 'srd-5.1:wolf', count: { kind: 'constant', value: 1 }, timing,
          durationRounds: 10, persistent: true, concentration: false, side: 'ally', sourceDeathBehavior: 'die' }] }] }],
    }],
  }
  const before = structuredClone(bundle)
  const bytes = await exportDnd5eStarMod(bundle)
  expect(bundle).toEqual(before)
  // Independent installs from identical bytes; no pre-registered fixture action.
  for (let install = 0; install < 2; install++) {
    const restored = (await readDnd5eStarMod(bytes)).bundle
    expect(restored.definitions[0].activities?.[0].outcomes[0].operations[0]).toMatchObject({ sourceDeathBehavior: 'die', persistent: true, timing })
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(restored))
    try {
      const actor = normalizeCharacter({ id: 'owner', name: 'Owner', charClass: '法师', level: 5,
        maxHp: 30, currentHp: 30, abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
        dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': [spellId] } } } },
        classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 2 } } })
      const caster: Token = { id: 'caster', characterId: actor.id, label: actor.name, type: 'player',
        x: 25, y: 25, size: 1, color: '', emoji: '' }
      const map: BattleMap = initializeDnd5eActivityTurnClock({ id: 'archive-map', name: 'Map', width: 500, height: 500, gridSize: 50,
        gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [caster] }, 'combat', '1:caster')
      const action: SharedPlayerActionState = { id: `cast-${install}`, type: 'dnd5e-spell-cast', sourceMode: 'player', status: 'pending',
        combatId: 'combat',
        mapId: map.id, actorTokenId: caster.id, characterId: actor.id, round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
        dnd5eSpellCast: { spellId, castingClassId: 'wizard', slotLevel: 2, targetTokenId: caster.id } }
      const input = { action, map, characters: [actor], initiativeOrder: [{ tokenId: caster.id, label: actor.name, roll: 20, color: '', emoji: '' }] }
      const prepared = prepareDnd5ePluginSpellCast(input)
      expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
      if (!prepared.ok) throw Error('Spell preparation failed')
      const settled = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: { activityRolls: {} } })
      expect(settled.result.ok, settled.result.ok ? undefined : settled.result.reason).toBe(true)
      if (!settled.result.ok || !settled.application || !prepared.prepared.activity) throw Error('Spell settlement failed')
      expect(settled.result.activityHandoffs?.summons[0]).toMatchObject({ sourceDeathBehavior: 'die', persistent: true })
      expect(settled.application.characters[0].classResources?.['dnd5e-spell-slot-2'].current).toBe(0)
      expect(actor.classResources?.['dnd5e-spell-slot-2'].current).toBe(1)
      const placed = applyDnd5eActivityDeferredMapHandoffs({ map: settled.application.map, activity: prepared.prepared.activity,
        characters: settled.application.characters, combatId: 'combat', delayedBoundary: dnd5eActivityDelayedBoundary(settled.application.map, action.id),
        packageId: namespace, actionId: action.id, actorId: caster.id, round: 1,
        handoffs: settled.result.activityHandoffs!, selection: { summonCells: [{ col: 2, row: 2 }], summonInitiativeD20s: [10] } })
      expect(placed.ok, placed.ok ? undefined : placed.reason).toBe(true)
      if (!placed.ok) throw Error('Placement failed')
      let saved = migrateMapsState(JSON.parse(JSON.stringify({ maps: [placed.map] }))).maps[0]
      if (timing === 'source-next-turn-start') {
        expect(saved.tokens).toHaveLength(1)
        expect(placed.initiativeEntries).toEqual([])
        expect(saved.dnd5eDelayedSummons?.[0].status).toBe('pending')
        const transition = { cursor: { mapId: saved.id, combatId: 'combat', round: 2, initiativeIndex: 0, tokenId: caster.id, slotId: caster.id },
          boundaries: [{ timing: 'turn-end' as const, round: 1, tokenId: caster.id, turnKey: '1:caster' },
            { timing: 'turn-start' as const, round: 2, tokenId: caster.id, turnKey: '2:caster' }] }
        const arrived = await settleDnd5ePersistentAreaTurnTransition({ map: saved, characters: settled.application.characters, transition,
          settleBoundary: async ({ map, characters }) => ({ map, characters: [...characters], logs: [] }), expireBoundary: ({ map }) => map })
        expect(arrived.initiativeEntries).toHaveLength(1)
        expect(arrived.map.dnd5eDelayedSummons?.[0].status).toBe('completed')
        saved = arrived.map
      }
      const companion = saved.tokens.find(token => token.dnd5eSummon)!
      expect(companion.dnd5eSummon).toMatchObject({ sourceDeathBehavior: 'die', sourceCharacterId: actor.id, sourceTokenId: caster.id })
      const remote = { ...saved, id: 'remote', tokens: [companion] }
      const deceased = normalizeCharacter({ ...settled.application.characters[0], currentHp: 0, deathSaveFailures: 3 })
      const ended = reconcileDnd5eSummonSourceDeathsAcrossMaps({ maps: [map, remote], characters: [deceased], round: 2 })
      expect(ended.maps[1].tokens[0].hp).toBe(0)
      expect(ended.events.filter(event => event.type === 'instant-death')).toHaveLength(1)
      expect(prepareDnd5ePluginSpellCast({ ...input, characters: settled.application.characters }).ok).toBe(false)
    } finally { dispose() }
  }
})
