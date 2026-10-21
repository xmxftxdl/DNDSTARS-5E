import { afterEach, expect, it, vi } from 'vitest'
import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from './mapBridge'
import { applyDnd5eStandardConditionEffect } from './headlessCombatEngine'
import { createDnd5ePersistentAreaCapacityCoordinator, prepareDnd5ePersistentAreaTrigger, resolvePreparedDnd5ePersistentAreaTrigger } from './pluginAreaTransactions'
import { normalizeDnd5ePersistentAreaTriggerSnapshot } from './persistentAreaTypes'
import { createDnd5eConditionEffect, dnd5eConditionsFromActiveEffects } from './activeEffects'
import { reconcileDnd5eEndedAreaCaptives, reconcileDnd5eAreaCaptivesAcrossMaps } from './persistentAreaEnd'
import { expireDnd5ePluginAreasAtTurnBoundary, reconcileDnd5ePluginAreasAndConcentrationOnMap } from './pluginAreas'
import { removePersistentAreaByDm, resolvePersistentAreaEntityAttackByDm } from './persistentAreaRemoval'
import { settleSunburstSpellDarknessDispels } from './sunburstDarknessDispel'
import { normalizeCharacter } from '../../store/characters'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
afterEach(() => { vi.restoreAllMocks(); setMapGeometryRuntime([]) })

it('rejects unsupported capacity declarations rather than silently erasing their policy', () => {
  const trigger = fixture().candidate.trigger
  for (const capacity of [null, { ...trigger.capacity, overflow: 'first' }, { ...trigger.capacity, maximumUnits: 0 },
    { ...trigger.capacity, proneOnExpulsion: false }, { ...trigger.capacity, unitsBySizeRank: [1, 1, 1] },
    { ...trigger.capacity, unknownField: true }]) {
    expect(normalizeDnd5ePersistentAreaTriggerSnapshot({ ...trigger, capacity })).toBeUndefined()
  }
  expect(normalizeDnd5ePersistentAreaTriggerSnapshot({ ...trigger, condition: undefined })).toBeUndefined()
})

function fixture(count = 2, large = false) {
  const token = (id: string, x: number, y: number): Token => ({ id, label: id, x, y, size: 1,
    creatureSize: '中型', type: 'npc', hp: 20, maxHp: 20, color: '#fff', emoji: '' })
  const source = token('source', 25, 25)
  const incumbents = Array.from({ length: count }, (_, i) => token(`old-${i}`, 175 + i * 50, 175))
  const entrant: Token = { ...token('entrant', 275, 275), ...(large ? { creatureSize: '大型' as const, size: 2 } : {}) }
  const trigger = normalizeDnd5ePersistentAreaTriggerSnapshot({ id: 'capture', label: 'Capture', timing: 'on-enter',
    oncePerTurn: true, savingThrow: { ability: 'str', dc: 15, onSuccess: 'none' },
    condition: { condition: 'restrained', duration: { expiresAt: 'source-turn-end' } },
    capacity: { maximumUnits: large ? 4 : 2, unitsBySizeRank: [1, 1, 1, large ? 4 : 2, null, null],
      overflow: 'random-existing-until-fits', maximumOutsideDistanceFeet: 5, proneOnExpulsion: true } })!
  const area: Dnd5ePluginArea = { id: 'capacity-area', pluginId: 'test.capacity', featureId: 'capture', label: 'Capture',
    sourceTokenId: source.id, sourceCharacterId: '', createdRound: 1, expiresAfterRound: 10,
    cells: Array.from({ length: 25 }, (_, i) => ({ col: 2 + i % 5, row: 2 + Math.floor(i / 5) })),
    color: '#fff', relation: 'any', includeSelf: false, triggers: [trigger] }
  let map: BattleMap = { id: 'capacity-map', name: 'Capacity', width: 600, height: 600, gridSize: 50,
    feetPerCell: 5, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [source, ...incumbents, entrant], dnd5ePluginAreas: [area] }
  const initiative = map.tokens.map((t, i) => ({ tokenId: t.id, label: t.label, emoji: '', color: '#fff', roll: 20 - i }))
  const snapshot = createDnd5eMapCombatSnapshot({ combatId: map.id, map, characters: [], initiativeOrder: initiative })
  for (const token of incumbents) applyDnd5eStandardConditionEffect(snapshot.state.combatants[token.id], snapshot.state.combatants.source, {
    id: `held-${token.id}`, rulesId: 'synthetic-capture', condition: 'restrained', duration: { type: 'permanent' },
    tags: [`persistent-area:${area.id}`],
  }, [])
  map = planDnd5eMapResultApplication({ state: snapshot.state, map, characters: [],
    characterIdByCombatantId: snapshot.characterIdByCombatantId, events: [] }).map
  const prepared = prepareDnd5ePersistentAreaTrigger({ combatId: map.id, round: 1, map, characters: [],
    initiativeOrder: initiative.filter(entry => ['source', 'entrant'].includes(entry.tokenId)),
    candidate: { area, trigger, targetToken: map.tokens.find(t => t.id === 'entrant')!, transactionId: 'capacity-txn' } })
  if (!prepared.ok) throw Error(prepared.reason)
  return prepared.prepared
}

it('requests Host randomness without committing the new restraint or any partial effect', () => {
  const prepared = fixture(), before = structuredClone(prepared)
  const result = resolvePreparedDnd5ePersistentAreaTrigger({ prepared, d20: 1 })
  expect(result.capacitySelection).toMatchObject({ sides: 2, candidateIds: ['old-0', 'old-1'], drawIndex: 0 })
  expect(result.result).toMatchObject({ ok: false, state: before.state, events: [] })
  expect(result.application).toBeUndefined()
  expect(prepared).toEqual(before)
})

it('expels an incumbent absent from real initiative and preserves restraint from another area', () => {
  const prepared = fixture(), target = prepared.state.combatants['old-1']
  expect(target).toBeDefined()
  applyDnd5eStandardConditionEffect(target, prepared.state.combatants.source, { id: 'other-restraint',
    rulesId: 'other', condition: 'restrained', duration: { type: 'permanent' }, tags: ['persistent-area:other'] }, [])
  const before = structuredClone(prepared)
  const resolved = resolvePreparedDnd5ePersistentAreaTrigger({ prepared, d20: 1, capacityRandomResults: [2] })
  expect(resolved.result.ok).toBe(true)
  expect(resolved.result.events).toContainEqual(expect.objectContaining({ type: 'active-effect-removed', targetId: 'old-1', effectId: 'held-old-1', reason: 'released' }))
  const expelled = resolved.result.state.combatants['old-1']
  expect(expelled.classState.activeEffects?.some(effect => effect.id === 'other-restraint')).toBe(true)
  expect(expelled.conditions).toContain('restrained')
  expect(expelled.conditions).toContain('prone')
  expect(resolved.result.state.combatants.entrant.conditions).toContain('restrained')
  expect(resolved.application!.map.tokens.find(token => token.id === 'entrant')!.dnd5eCombatState?.activeEffects)
    .toContainEqual(expect.objectContaining({ areaLifetime: { mapId: prepared.map.id, areaId: 'capacity-area', sourceActorId: 'source' } }))
  expect(resolved.application!.map.tokens.find(t => t.id === 'old-1')).toMatchObject(expelled.position)
  expect(prepared).toEqual(before)
})

it('uses distinct legal destinations for multiple expulsions and persists their states together', () => {
  const prepared = fixture(4, true)
  const result = resolvePreparedDnd5ePersistentAreaTrigger({ prepared, d20: 1, capacityRandomResults: [1, 1, 1] })
  expect(result.result.ok).toBe(true)
  const moved = result.result.events.filter(e => e.type === 'moved')
  expect(moved).toHaveLength(4)
  expect(new Set(moved.map(e => JSON.stringify(e.to))).size).toBe(4)
  for (let i = 0; i < 4; i++) {
    const actor = result.result.state.combatants[`old-${i}`]
    expect(actor.conditions).not.toContain('restrained')
    expect(actor.conditions).toContain('prone')
    expect(result.application!.map.tokens.find(t => t.id === actor.id)).toMatchObject(actor.position)
  }
  expect(result.application!.map.dnd5ePluginAreas![0].triggerReceipts).toHaveLength(1)
})

it('rolls back earlier expulsions and the entrant if a later protected effect cannot be released', () => {
  const prepared = fixture(2, true)
  const effect = prepared.state.combatants['old-1'].classState.activeEffects![0]
  effect.linkedLifetime = { actorId: 'old-1', effectId: effect.id, protectedRemoval: true }
  const before = structuredClone(prepared)
  const result = resolvePreparedDnd5ePersistentAreaTrigger({ prepared, d20: 1, capacityRandomResults: [1] })
  expect(result.result).toMatchObject({ ok: false, state: before.state, events: [] })
  expect(result.application).toBeUndefined()
  expect(prepared).toEqual(before)
})

it('does not eject or roll for successful saves or DM-blocked restraint', async () => {
  const prepared = fixture()
  const roll = vi.fn(async () => 1)
  const settle = createDnd5ePersistentAreaCapacityCoordinator(roll)
  for (const input of [{ d20: 20 }, { d20: 1, dmAdjustment: { blockedConditionIds: ['restrained'] as const } }]) {
    const result = await settle({ prepared, ...input })
    expect(result.result.ok).toBe(true)
    expect(result.result.events.some(e => e.type === 'moved')).toBe(false)
    expect(result.capacityRandomResults).toEqual([])
  }
  expect(roll).not.toHaveBeenCalled()
})

it('reuses each Host random result for transaction previews and rejects invalid results', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(1000)
  const prepared = fixture(4, true), roll = vi.fn(async () => 1)
  const settle = createDnd5ePersistentAreaCapacityCoordinator(roll)
  const first = await settle({ prepared, d20: 1 })
  const second = await settle({ prepared, d20: 1 })
  expect(first.result.ok).toBe(true)
  expect(second).toEqual(first)
  expect(roll).toHaveBeenCalledTimes(3)
  expect(first.capacityRandomResults).toEqual([1, 1, 1])
  const replay = resolvePreparedDnd5ePersistentAreaTrigger({ prepared, d20: 1, capacityRandomResults: first.capacityRandomResults })
  expect(replay.result).toEqual(first.result)
  expect(replay.application).toEqual(first.application)
  const invalid = await createDnd5ePersistentAreaCapacityCoordinator(async () => 0)({ prepared, d20: 1 })
  expect(invalid.result).toMatchObject({ ok: false, events: [], state: prepared.state })
})

it('releases only ended capacity-instance restraint, including suspended effects, without requiring concentration', () => {
  const prepared = fixture()
  const target = prepared.state.combatants['old-0']
  target.classState.activeEffects![0].suspendedBy = ['test-antimagic']
  applyDnd5eStandardConditionEffect(target, prepared.state.combatants.source, { id: 'other-container',
    rulesId: 'other', condition: 'restrained', duration: { type: 'permanent' }, tags: ['persistent-area:other'] }, [])
  const map = planDnd5eMapResultApplication({ state: prepared.state, map: prepared.map, characters: [],
    characterIdByCombatantId: prepared.characterIdByCombatantId, events: [] }).map
  const before = structuredClone(map)
  const result = reconcileDnd5eEndedAreaCaptives({ before: map, after: { ...map, dnd5ePluginAreas: [] }, characters: [], round: 1 })
  const first = result.map.tokens.find(token => token.id === 'old-0')!
  expect(first.dnd5eCombatState?.activeEffects?.some(effect => effect.id === 'held-old-0')).toBe(false)
  expect(first.dnd5eCombatState?.activeEffects?.some(effect => effect.id === 'other-container')).toBe(true)
  expect(dnd5eConditionsFromActiveEffects(first.dnd5eCombatState?.activeEffects)).toContain('restrained')
  expect(dnd5eConditionsFromActiveEffects(result.map.tokens.find(token => token.id === 'old-1')!.dnd5eCombatState?.activeEffects)).not.toContain('restrained')
  expect(result.events).toContainEqual(expect.objectContaining({ type: 'active-effect-removed', effectId: 'held-old-0', reason: 'expired' }))
  expect(result.map.tokens.find(token => token.id === 'source')).toBe(map.tokens.find(token => token.id === 'source'))
  expect(map).toEqual(before)
})

it('routes turn-boundary area expiry through captive cleanup even for a non-concentration area', () => {
  const prepared = fixture()
  const map = { ...prepared.map, dnd5ePluginAreas: prepared.map.dnd5ePluginAreas!.map(area => ({ ...area, expiresAtSourceTurnEndAfterRound: 2 })) }
  const after = expireDnd5ePluginAreasAtTurnBoundary({ map, timing: 'turn-end', tokenId: 'source', round: 2 })
  const result = reconcileDnd5ePluginAreasAndConcentrationOnMap(map, [], 2, after)
  expect(result.map.dnd5ePluginAreas).toHaveLength(0)
  expect(dnd5eConditionsFromActiveEffects(result.map.tokens.find(token => token.id === 'old-0')!.dnd5eCombatState?.activeEffects)).not.toContain('restrained')
  expect(result.endedConcentrationTokenIds).toHaveLength(0)
})

it('releases replaced area generations without removing a new capture and clears breath only after all submersion ends', () => {
  const { map } = fixture()
  const area = map.dnd5ePluginAreas![0]
  const breath = { schemaVersion: 1 as const, breathSeconds: 6, survivalSeconds: 6, collapsed: false, lastStepKey: 'spent' }
  for (const id of ['old-0', 'old-1']) {
    const state = map.tokens.find(token => token.id === id)!.dnd5eCombatState!
    const held = state.activeEffects![0]
    held.areaLifetime = { mapId: map.id, areaId: area.id, sourceActorId: area.sourceTokenId, generation: 0 }
    held.modifiers = { ...held.modifiers, submerged: true }
    state.submergedBreathing = { ...breath }
    if (id === 'old-1') state.activeEffects!.push({ ...structuredClone(held), id: 'new-capture',
      areaLifetime: { ...held.areaLifetime, generation: 1 } })
  }
  const before = structuredClone(map)
  const after = { ...map, dnd5ePluginAreas: [{ ...area, boundEffectGeneration: 1 }] }
  const released = reconcileDnd5eEndedAreaCaptives({ before: map, after, characters: [], round: 1 })
  const first = released.map.tokens.find(token => token.id === 'old-0')!.dnd5eCombatState!
  expect(first.activeEffects?.some(effect => effect.id === 'held-old-0')).not.toBe(true)
  expect(first.submergedBreathing).toBeUndefined()
  const second = released.map.tokens.find(token => token.id === 'old-1')!.dnd5eCombatState!
  expect(second.activeEffects?.map(effect => effect.id)).toContain('new-capture')
  expect(second.activeEffects?.map(effect => effect.id)).not.toContain('held-old-1')
  expect(second.submergedBreathing).toEqual(breath)
  const final = reconcileDnd5eEndedAreaCaptives({ before: released.map,
    after: { ...released.map, dnd5ePluginAreas: [] }, characters: [], round: 1 })
  expect(final.map.tokens.find(token => token.id === 'old-1')!.dnd5eCombatState?.submergedBreathing).toBeUndefined()
  expect(map).toEqual(before)
})

it('clears expired area breath on mapless sheets while preserving other submerged sources', () => {
  const { map } = fixture()
  const area = map.dnd5ePluginAreas![0]
  const held = structuredClone(map.tokens.find(token => token.id === 'old-0')!.dnd5eCombatState!.activeEffects![0])
  held.areaLifetime = { mapId: map.id, areaId: area.id, sourceActorId: area.sourceTokenId }
  held.modifiers = { ...held.modifiers, submerged: true }
  const breath = { schemaVersion: 1 as const, breathSeconds: 6, survivalSeconds: 6, collapsed: false, lastStepKey: 'spent' }
  const characters = [false, true].map(other => normalizeCharacter({ id: `sheet-${other}`, name: 'Sheet',
    dnd5eCombatState: { schemaVersion: 2, submergedBreathing: breath, activeEffects: [held,
      ...(other ? [{ ...structuredClone(held), id: 'other-water', tags: ['persistent-area:other'],
        areaLifetime: { ...held.areaLifetime!, areaId: 'other' } }] : [])] } }))
  const result = reconcileDnd5eAreaCaptivesAcrossMaps({ maps: [{ ...map,
    dnd5ePluginAreas: [{ ...area, id: 'other' }] }], characters, round: 1 })
  expect(result.characters[0].dnd5eCombatState?.submergedBreathing).toBeUndefined()
  expect(result.characters[1].dnd5eCombatState?.submergedBreathing).toEqual(breath)
})

it.each([0, -30, 15])('lands declared area captives at ground %i without falling damage, including creatures absent from initiative', ground => {
  const { map } = fixture()
  const geometry = createEmptyMapGeometry(map.id, 1)
  geometry.obstacles = [{ id: 'terrain', kind: 'obstacle', label: 'Terrain',
    points: [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 600 }, { x: 0, y: 600 }],
    terrainRegion: true, terrainElevationFeet: ground, baseHeightFeet: ground, heightFeet: 0,
    cover: 'none', blocksMovement: false, blocksVision: false, blocksLineOfEffect: false, createdAt: 1 }]
  setMapGeometryRuntime([geometry])
  const area = map.dnd5ePluginAreas![0]
  area.triggers![0].condition = { ...area.triggers![0].condition!, endsWithArea: true, proneOnAreaEnd: true, groundOnAreaEnd: true }
  expect(normalizeDnd5ePersistentAreaTriggerSnapshot(area.triggers![0])?.condition?.groundOnAreaEnd).toBe(true)
  for (const groundOnAreaEnd of [false, 'true', 1]) expect(normalizeDnd5ePersistentAreaTriggerSnapshot({ ...area.triggers![0],
    condition: { ...area.triggers![0].condition, groundOnAreaEnd } })).toBeUndefined()
  for (const token of map.tokens.filter(token => token.id.startsWith('old-'))) {
    token.elevationFeet = ground + 10
    const effect = token.dnd5eCombatState!.activeEffects![0]
    effect.areaLifetime = { mapId: map.id, areaId: area.id, sourceActorId: area.sourceTokenId }
    effect.modifiers = { magicallyHeldAloft: true, submerged: true }
  }
  const result = reconcileDnd5eEndedAreaCaptives({ before: map, after: { ...map, dnd5ePluginAreas: [] }, characters: [], round: 1 })
  for (const token of result.map.tokens.filter(token => token.id.startsWith('old-'))) {
    expect(token.elevationFeet).toBe(ground)
    expect(token.hp).toBe(20)
    expect(dnd5eConditionsFromActiveEffects(token.dnd5eCombatState?.activeEffects)).toContain('prone')
    expect(dnd5eConditionsFromActiveEffects(token.dnd5eCombatState?.activeEffects)).not.toContain('restrained')
  }
})

it('does not infer area end from missing local state, or end independently lasting ordinary area conditions', () => {
  const { map } = fixture()
  expect(reconcileDnd5eEndedAreaCaptives({ before: map, after: map, characters: [], round: 1 }).map).toBe(map)
  const absent = { ...map, dnd5ePluginAreas: [] }
  expect(reconcileDnd5eEndedAreaCaptives({ before: absent, after: absent, characters: [], round: 1 }).map).toBe(absent)
  const independent = { ...map, dnd5ePluginAreas: map.dnd5ePluginAreas!.map(area => ({ ...area,
    triggers: area.triggers!.map(trigger => ({ ...trigger, capacity: undefined })) })) }
  expect(reconcileDnd5eEndedAreaCaptives({ before: independent, after: absent, characters: [], round: 1 }).map).toBe(absent)
})

it('shared deletion returns every affected character, not only the caster', () => {
  const prepared = fixture()
  const target = prepared.map.tokens.find(token => token.id === 'old-0')!
  const character = normalizeCharacter({ id: 'captive-char', name: 'Captive', currentHp: 20, maxHp: 20,
    dnd5eCombatState: target.dnd5eCombatState })
  const unrelated = normalizeCharacter({ id: 'unrelated', name: 'Unrelated', currentHp: 20, maxHp: 20 })
  const map = { ...prepared.map, tokens: prepared.map.tokens.map(token => token.id === target.id
    ? { ...token, type: 'player' as const, characterId: character.id } : token) }
  const input = { map, characters: [character, unrelated], areaId: 'capacity-area', round: 3 }
  const before = structuredClone(input)
  const removed = removePersistentAreaByDm(input)!
  expect(removed.character).toBeUndefined()
  expect(removed.characters?.find(candidate => candidate.id === character.id)?.conditions).not.toContain('restrained')
  expect(removed.characters?.find(candidate => candidate.id === unrelated.id)).toBe(unrelated)
  expect(removed.events).toContainEqual(expect.objectContaining({ type: 'active-effect-removed', targetId: target.id }))
  expect(input).toEqual(before)
})

it('destroying a capacity entity releases its captives through the shared authority path', () => {
  const { map } = fixture()
  map.dnd5ePluginAreas![0].entityProfile = { armorClass: 10, hitPoints: 1, strength: 2, cannotAttack: true, invisible: false }
  const missed = resolvePersistentAreaEntityAttackByDm({ map, characters: [], areaId: 'capacity-area', attackTotal: 9, damage: 1 })!
  expect(missed.map).toBe(map)
  const destroyed = resolvePersistentAreaEntityAttackByDm({ map, characters: [], areaId: 'capacity-area', attackTotal: 10, damage: 1, round: 3 })!
  expect(destroyed.outcome).toBe('destroyed')
  expect(destroyed.events).toContainEqual(expect.objectContaining({ type: 'active-effect-removed', effectId: 'held-old-0' }))
  expect(dnd5eConditionsFromActiveEffects(destroyed.map.tokens.find(token => token.id === 'old-0')!.dnd5eCombatState?.activeEffects)).not.toContain('restrained')
})

it('spell-driven removal propagates captive cleanup events instead of only returning the removed area', () => {
  const { map } = fixture()
  Object.assign(map.dnd5ePluginAreas![0], { sourceKind: 'core-spell', coreSpellId: 'darkness',
    lighting: { kind: 'magical-darkness', radiusFeet: 15, spellLevel: 2 } })
  const result = settleSunburstSpellDarknessDispels({ map, characters: [], anchorCell: { col: 3, row: 3 }, radiusFeet: 60 })
  expect(result.removedAreaIds).toEqual(['capacity-area'])
  expect(result.events).toContainEqual(expect.objectContaining({ type: 'active-effect-removed', effectId: 'held-old-0' }))
  expect(result.changedTokenIds).toContain('old-0')
})

it('returns the cleaned source token when the caster was also held by its own container', () => {
  const { map } = fixture()
  const source = map.tokens.find(token => token.id === 'source')!
  source.dnd5eCombatState = { activeEffects: [createDnd5eConditionEffect({ id: 'source-captive', targetId: source.id,
    condition: 'restrained', source: { kind: 'plugin', actorId: source.id }, duration: { type: 'permanent' },
    tags: ['persistent-area:capacity-area'] })] }
  const removed = removePersistentAreaByDm({ map, characters: [], areaId: 'capacity-area', round: 3 })!
  expect(removed.sourceToken).toBe(removed.map.tokens.find(token => token.id === source.id))
  expect(removed.sourceToken?.dnd5eCombatState?.activeEffects?.some(effect => effect.id === 'source-captive')).not.toBe(true)
})
