import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { migrateMapsState, type BattleMap } from '../../../store/maps'
import { exportDnd5eStarMod, readDnd5eStarMod } from '../starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from '../mapBridge'
import { applyDnd5eActivityMapHandoffsV1, dnd5eActivitySummonPlacementCells } from './dnd5eActivityMapInteraction'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'

it.each([false, true])('round-trips an installed summon and dismisses its own bond, release=%s', async releaseBond => {
  const namespace = 'test.bond-archive', automation = automationCapabilityFromLegacyStatus('full')
  const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Synthetic bond', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' }, assets: [],
    definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'call', name: 'Call', automation,
      payload: { id: 'call', name: 'Call', summary: 'Synthetic', description: 'Synthetic', automation: 'full' },
      activities: [{ schemaVersion: 1, id: 'call', name: 'Call', activation: { kind: 'action' }, target: { kind: 'self' }, automation,
        legacySource: { kind: 'feature', id: 'call' }, outcomes: [{ id: 'call', when: { kind: 'always' }, operations: [{ id: 'call', kind: 'summon',
          monsterId: 'srd-5.1:wolf', count: { kind: 'constant', value: 1 }, timing: 'immediate', persistent: true, concentration: false,
          side: 'ally', placementRangeFeet: 30, requiresVisiblePlacement: false, bondKey: 'companion', bondDismissActivityId: 'dismiss' }] }] },
        { schemaVersion: 1, id: 'dismiss', name: 'Dismiss', activation: { kind: 'free' }, target: { kind: 'self' }, automation,
          legacySource: { kind: 'feature', id: 'call' }, requiresEffectGrant: true,
          outcomes: [{ id: 'dismiss', when: { kind: 'always' }, operations: [{ id: 'dismiss', kind: 'dismiss-owned-summon', bondKey: 'companion', releaseBond }] }] }],
    }] }
  const strictActivity = structuredClone(bundle.definitions[0].activities![0])
  strictActivity.id = 'call-strict'
  const strictOperation = strictActivity.outcomes[0].operations[0]
  if (strictOperation.kind !== 'summon') throw Error('fixture')
  strictOperation.existingBondPolicy = 'reject-living'
  bundle.definitions[0].activities = [...bundle.definitions[0].activities!, strictActivity]
  const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
  const otherBundle = structuredClone(decoded.bundle)
  otherBundle.manifest.id = 'other.package'
  otherBundle.definitions.forEach(definition => { definition.namespace = 'other.package' })
  const disposeOther = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(otherBundle))
  try {
    const map: BattleMap = { id: 'bond-map', name: 'Map', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
      tokens: [{ id: 'owner', label: 'Owner', type: 'enemy', poolId: 'srd-5.1:bandit', x: 25, y: 25, hp: 11, maxHp: 11, size: 1, color: '', emoji: '' }] }
    const initiativeOrder = [{ tokenId: 'owner', label: 'Owner', emoji: '', color: '', roll: 20 }]
    const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'bond', map, characters: [], initiativeOrder })!
    snapshot.state.combatants.owner.pluginFeatureIds = [`${namespace}:call`]
    const direct = resolveRegisteredDnd5eActivityInCombatV1({ state: snapshot.state, combatRevision: 1, confirmedBy: 'actor', authoritativeRolls: {},
      command: { schemaVersion: 1, commandId: 'direct-bond', actorId: 'owner', packageId: namespace, packageVersion: '1.0.0', activityId: 'call', targetIds: ['owner'], expectedRevision: 1 } })
    expect(direct.result.ok, JSON.stringify(direct)).toBe(true)
    if (direct.phase !== 'commit' || !direct.result.ok) throw Error('Direct bond did not commit')
    expect(direct.result.state.combatants.owner.classState.activeEffects).toContainEqual(expect.objectContaining({
      definitionId: 'summon-bond:companion', source: expect.objectContaining({ pluginId: namespace }),
    }))
    const cast = resolveDnd5eHeadlessAction(snapshot.state, { type: 'plugin', pluginId: namespace, actionId: 'call', featureId: `${namespace}:call`, actorId: 'owner', targetId: 'owner', targetIds: ['owner'], rolls: {} })
    expect(cast.ok, JSON.stringify(cast)).toBe(true)
    if (!cast.ok) throw Error(cast.reason)
    expect(cast.activityHandoffs?.summons[0]).toMatchObject({ placementRangeFeet: 30, requiresVisiblePlacement: false })
    expect(direct.result.activityHandoffs?.summons[0]).toMatchObject({ placementRangeFeet: 30, requiresVisiblePlacement: false })
    const otherState = structuredClone(cast.state)
    otherState.combatants.owner.pluginFeatureIds = [...otherState.combatants.owner.pluginFeatureIds, 'other.package:call']
    otherState.combatants.owner.turn.actionAvailable = true
    const otherCast = resolveDnd5eHeadlessAction(otherState, { type: 'plugin', pluginId: 'other.package', actionId: 'call',
      featureId: 'other.package:call', actorId: 'owner', targetId: 'owner', targetIds: ['owner'], rolls: {} })
    expect(otherCast.ok, JSON.stringify(otherCast)).toBe(true)
    const bonds = otherCast.state.combatants.owner.classState.activeEffects!.filter(effect => effect.definitionId === 'summon-bond:companion')
    expect(bonds).toHaveLength(2)
    expect(new Set(bonds.map(effect => effect.id)).size).toBe(2)
    cast.state = otherCast.state
    const plan = planDnd5eMapResultApplication({ ...snapshot, state: cast.state, events: [...cast.events], map, characters: [] })
    const placed = applyDnd5eActivityMapHandoffsV1({ map: plan.map, activity: decoded.bundle.definitions[0].activities![0], packageId: namespace,
      actionId: 'cast-bond', actorId: 'owner', round: 1, handoffs: cast.activityHandoffs!, selection: { summonCells: [{ col: 2, row: 1 }], summonInitiativeD20s: [12] } })
    expect(placed.ok, JSON.stringify(placed)).toBe(true)
    if (!placed.ok) throw Error(placed.reason)
    const restored = migrateMapsState(JSON.parse(JSON.stringify({ maps: [placed.map] }))).maps[0]
    const summon = restored.tokens.find(token => token.dnd5eSummon)!
    const strictCast = resolveRegisteredDnd5eActivityInCombatV1({ state: snapshot.state, combatRevision: 1, confirmedBy: 'actor', authoritativeRolls: {},
      command: { schemaVersion: 1, commandId: 'strict-bond', actorId: 'owner', packageId: namespace, packageVersion: '1.0.0', activityId: 'call-strict', targetIds: ['owner'], expectedRevision: 1 } })
    expect(strictCast.result.ok, JSON.stringify(strictCast)).toBe(true)
    if (!strictCast.result.ok) throw Error('strict cast')
    const strictHandoffs = strictCast.result.activityHandoffs!
    expect(strictHandoffs.summons[0].existingBondPolicy).toBe('reject-living')
    const strictRequest = { map: restored, sourceLimitMaps: [restored], activity: strictActivity, packageId: namespace,
      actionId: 'strict-place', actorId: 'owner', round: 1, handoffs: strictHandoffs,
      selection: { summonCells: [{ col: 3, row: 1 }], summonInitiativeD20s: [12] } }
    const beforeStrict = structuredClone(restored)
    expect(applyDnd5eActivityMapHandoffsV1(strictRequest)).toEqual({ ok: false, reason: 'invalid-summon-placement' })
    for (const state of ['dismissed', 'unknown-hp', 'unconscious', 'dead', 'foreign-package'] as const) {
      const current = structuredClone(restored)
      const existing = current.tokens.find(token => token.id === summon.id)!
      if (state === 'dismissed') existing.dnd5eSummon!.dismissed = true
      if (state === 'unknown-hp') { delete existing.hp; delete existing.maxHp }
      if (state === 'dead' || state === 'unconscious') existing.hp = 0
      if (state === 'dead') existing.dnd5eCombatState = { ...existing.dnd5eCombatState, deathRound: 1 }
      if (state === 'foreign-package') existing.dnd5eSummon!.pluginId = 'other.package'
      expect(applyDnd5eActivityMapHandoffsV1({ ...strictRequest, map: current }).ok).toBe(state === 'dead' || state === 'foreign-package')
    }
    const empty = { ...restored, tokens: restored.tokens.filter(token => !token.dnd5eSummon) }
    expect(applyDnd5eActivityMapHandoffsV1({ ...strictRequest, map: empty, sourceLimitMaps: [] }).ok).toBe(true)
    expect(dnd5eActivitySummonPlacementCells({ ...strictRequest, map: empty, sourceLimitMaps: [], summons: strictHandoffs.summons, selectedCells: [] }).length).toBeGreaterThan(0)
    expect(dnd5eActivitySummonPlacementCells({ ...strictRequest, summons: strictHandoffs.summons, selectedCells: [] })).toEqual([])
    expect(applyDnd5eActivityMapHandoffsV1({ ...strictRequest, map: empty, sourceLimitMaps: undefined }).ok).toBe(false)
    const playerMap = structuredClone(empty)
    playerMap.tokens[0].characterId = 'player-hero'
    const remote = structuredClone(restored)
    remote.id = 'remote-map'
    remote.tokens.find(token => token.id === summon.id)!.dnd5eSummon!.sourceCharacterId = 'player-hero'
    expect(applyDnd5eActivityMapHandoffsV1({ ...strictRequest, map: playerMap, sourceLimitMaps: [remote] }).ok).toBe(false)
    remote.tokens.find(token => token.id === summon.id)!.hp = 0
    expect(applyDnd5eActivityMapHandoffsV1({ ...strictRequest, map: playerMap, sourceLimitMaps: [remote] }).ok).toBe(false)
    const confirmedDead = remote.tokens.find(token => token.id === summon.id)!
    confirmedDead.dnd5eCombatState = { ...confirmedDead.dnd5eCombatState, deathRound: 1 }
    expect(applyDnd5eActivityMapHandoffsV1({ ...strictRequest, map: playerMap, sourceLimitMaps: [remote] }).ok).toBe(true)
    expect(applyDnd5eActivityMapHandoffsV1({ ...strictRequest, map: empty, sourceLimitMaps: [],
      handoffs: { ...strictHandoffs, summons: [...strictHandoffs.summons, ...strictHandoffs.summons] } }).ok).toBe(false)
    expect(restored).toEqual(beforeStrict)
    restored.tokens.push({ ...structuredClone(summon), id: 'other-map-summon', x: 425, y: 325,
      dnd5eSummon: { ...summon.dnd5eSummon!, pluginId: 'other.package', bondEffectId: bonds.find(effect => effect.source.pluginId === 'other.package')!.id } })
    expect(summon.dnd5eSummon).toMatchObject({ sourceTokenId: 'owner', bondKey: 'companion', persistent: true })
    const reload = createDnd5eMapCombatSnapshot({ combatId: 'bond', map: restored, characters: [], initiativeOrder })!
    const bond = reload.state.combatants.owner.classState.activeEffects!.find(effect => effect.definitionId === 'summon-bond:companion' && effect.source.pluginId === namespace)!
    expect(bond.grantedActivities).toContain('dismiss')
    expect(bond.source.pluginId).toBe(namespace)
    const command = { type: 'plugin' as const, pluginId: namespace, actionId: 'dismiss', featureId: `${namespace}:effect-control.dismiss`, actorId: 'owner', targetId: 'owner', targetIds: ['owner'], rolls: {}, hostEntitlement: { kind: 'active-effect' as const, effectId: bond.id } }
    expect(resolveDnd5eHeadlessAction(reload.state, { ...command, hostEntitlement: { kind: 'active-effect', effectId: 'forged' } }).ok).toBe(false)
    const wrongPackage = structuredClone(reload.state)
    wrongPackage.combatants.owner.classState.activeEffects!.find(effect => effect.id === bond.id)!.source.pluginId = 'other.package'
    expect(resolveDnd5eHeadlessAction(wrongPackage, command).ok).toBe(false)
    const dismissed = resolveDnd5eHeadlessAction(reload.state, command)
    expect(dismissed.ok, JSON.stringify(dismissed)).toBe(true)
    const final = planDnd5eMapResultApplication({ ...reload, state: dismissed.state, events: [...dismissed.events], map: restored, characters: [] })
    expect(final.map.tokens.find(token => token.id === summon.id)?.dnd5eSummon?.dismissed).toBe(true)
    expect(final.map.tokens.find(token => token.id === 'other-map-summon')?.dnd5eSummon?.dismissed).toBeFalsy()
    expect(dismissed.state.combatants.owner.classState.activeEffects!.find(effect => effect.source.pluginId === 'other.package')).toEqual(bonds.find(effect => effect.source.pluginId === 'other.package'))
    expect(dismissed.state.combatants.owner.classState.activeEffects?.some(effect => effect.id === bond.id) ?? false).toBe(!releaseBond)
    if (releaseBond) expect(resolveDnd5eHeadlessAction(dismissed.state, command).ok).toBe(false)
    expect(restored.tokens.find(token => token.id === summon.id)?.dnd5eSummon?.dismissed).toBeFalsy()
    const recalledSnapshot = createDnd5eMapCombatSnapshot({ combatId: 'bond', map: final.map, characters: [], initiativeOrder })!
    recalledSnapshot.state.combatants.owner.pluginFeatureIds = [`${namespace}:call`]
    const recall = resolveDnd5eHeadlessAction(recalledSnapshot.state, { type: 'plugin', pluginId: namespace,
      actionId: 'call', featureId: `${namespace}:call`, actorId: 'owner', targetId: 'owner', targetIds: ['owner'], rolls: {} })
    expect(recall.ok, JSON.stringify(recall)).toBe(true)
    if (!recall.ok) throw Error(recall.reason)
    const foreign = { ...structuredClone(summon), id: 'foreign-summon', x: 425, y: 425,
      dnd5eSummon: { ...summon.dnd5eSummon!, pluginId: 'other.package' } }
    const recallMap = { ...final.map, tokens: [...final.map.tokens, foreign] }
    recallMap.tokens.find(token => token.id === summon.id)!.dnd5eCarriedObjects = [{
      id: 'bond-possession', pickupReceipt: 'bond-reward', label: 'Sword', objectState: {
        schemaVersion: 1, wornOrCarried: true,
        inventoryItem: { templateId: 'srd-5.1:equipment:dnd5e-longsword', quantity: 1, receiptId: 'bond-reward' },
      },
    }]
    const recalled = applyDnd5eActivityMapHandoffsV1({ map: recallMap, activity: decoded.bundle.definitions[0].activities![0], packageId: namespace,
      actionId: 'recall-bond', actorId: 'owner', round: 1, handoffs: recall.activityHandoffs!,
      selection: { summonCells: [{ col: 3, row: 1 }], summonInitiativeD20s: [12] } })
    expect(recalled.ok, JSON.stringify(recalled)).toBe(true)
    if (!recalled.ok) throw Error(recalled.reason)
    expect(recalled.map.tokens.find(token => token.id === foreign.id)).toEqual(foreign)
    expect(recalled.map.tokens.filter(token => token.dnd5eSummon?.pluginId === namespace)).toHaveLength(1)
    expect(recalled.map.tokens.find(token => token.dnd5eSummon?.pluginId === namespace)?.dnd5eSummon?.dismissed).toBeFalsy()
    expect(recalled.removedTokenIds).toContain(summon.id)
    expect(recalled.map.tokens.filter(token => token.id === 'carried:bond-possession')).toHaveLength(1)
    expect(recalled.map.tokens.find(token => token.id === 'carried:bond-possession')).toMatchObject({
      x: summon.x, y: summon.y, dnd5eObjectState: { wornOrCarried: false, inventoryItem: { quantity: 1 } },
    })
  } finally { disposeOther(); dispose() }
})
