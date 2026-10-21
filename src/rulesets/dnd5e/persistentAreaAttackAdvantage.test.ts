import { afterEach, expect, it } from 'vitest'
import { createDnd5eConditionEffect } from './activeEffects'
import type { Dnd5eStandardConditionId } from './conditions'
import { normalizeCharacter } from '../../store/characters'
import { migrateMapsState, type BattleMap } from '../../store/maps'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import { createDnd5eMapCombatSnapshot, prepareDnd5eExplorationActor, planDnd5eMapResultApplication } from './mapBridge'
import { dnd5eAreaAttackAdvantageCandidates, dnd5ePassivePerceptionAgainst, resolveDnd5eHeadlessAction, type Dnd5eAction } from './headlessCombatEngine'

afterEach(() => setMapGeometryRuntime([]))

function fixture() {
  const owner = normalizeCharacter({ id: 'owner', name: 'Owner', currentHp: 20, maxHp: 20 })
  const map: BattleMap = { id: 'support', name: 'Support', width: 600, height: 100, gridSize: 50, feetPerCell: 5,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
    tokens: [
      { id: 'owner', characterId: 'owner', type: 'player', label: 'Owner', x: 375, y: 25, size: 1, emoji: '', color: '' },
      { id: 'attacker', type: 'enemy', label: 'Attacker', x: 125, y: 25, size: 1, emoji: '', color: '', hp: 20, maxHp: 20 },
      { id: 'target', type: 'enemy', label: 'Target', x: 75, y: 25, size: 1, emoji: '', color: '', hp: 20, maxHp: 20 },
    ],
    dnd5ePluginAreas: [{ id: 'hawk', pluginId: 'test', featureId: 'totem', label: 'Hawk', color: '#fff', sourceTokenId: 'owner', sourceCharacterId: 'owner',
      cells: [{ col: 1, row: 0 }], anchorCell: { col: 1, row: 0 }, createdRound: 1, expiresAfterRound: 10, createdWorldMinute: 100, expiresAtWorldMinute: 101,
      includeSelf: true, relation: 'any', attackAdvantageReaction: 'area-source' }],
  }
  const geometry = createEmptyMapGeometry(map.id); geometry.vision.ambientLight = 'bright'; setMapGeometryRuntime([geometry])
  const snapshot = (nextMap = map, round = 1, worldMinute = 100) => {
    const value = createDnd5eMapCombatSnapshot({ map: nextMap, characters: [owner], combatId: 'hawk', round, worldMinute,
      initiativeOrder: nextMap.tokens.map((t,i)=>({tokenId:t.id,label:t.label,emoji:'',color:'',roll:20-i})), additionalCreatureTokenIds: ['owner', 'attacker', 'target'] })
    prepareDnd5eExplorationActor(value.state, 'attacker')
    value.state.initiativeIndex = value.state.initiativeOrder.indexOf('attacker')
    value.state.combatants.target.armorClass = 15
    return value
  }
  const attack: Extract<Dnd5eAction, {type:'attack'}> = { type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 0,
    d20: 2, d20Second: 18, spendAction: false, mode: 'normal', damage: { count: 1, sides: 6, bonus: 0, rolls: [3] },
    areaAttackAdvantageReaction: { areaId: 'hawk', sourceId: 'owner' } }
  return { owner, map, snapshot, attack }
}

it('spends the area owner reaction for exactly one attack regardless of sides or owner distance', () => {
  const { snapshot, attack } = fixture(); const { state } = snapshot(); const original = structuredClone(state)
  expect(dnd5eAreaAttackAdvantageCandidates(state, 'target')).toEqual([{ areaId: 'hawk', sourceId: 'owner' }])
  const result = resolveDnd5eHeadlessAction(state, attack)
  expect(result.ok, result.ok ? undefined : result.reason).toBe(true); if (!result.ok) return
  expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 18, hit: true }))
  expect(result.state.combatants.owner.turn.reactionAvailable).toBe(false)
  expect(result.state.combatants.attacker.turn.reactionAvailable).toBe(true)
  expect(state).toEqual(original)
  expect(resolveDnd5eHeadlessAction(result.state, attack).ok).toBe(false)
  const ordinary = resolveDnd5eHeadlessAction(result.state, { ...attack, areaAttackAdvantageReaction: undefined })
  expect(ordinary.ok).toBe(true); if (!ordinary.ok) return
  expect(ordinary.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 2, hit: false }))
})

it('rechecks current positions and removed areas instead of stale projected membership', () => {
  const { snapshot, attack } = fixture()
  const { state } = snapshot()
  state.combatants.target.position = { x: 275, y: 25 }
  expect(dnd5eAreaAttackAdvantageCandidates(state, 'target')).toEqual([])
  expect(resolveDnd5eHeadlessAction(state, attack).ok).toBe(false)
  state.combatants.target.position = { x: 75, y: 25 }
  expect(dnd5eAreaAttackAdvantageCandidates(state, 'target')).toHaveLength(1)
  // This creature started outside and therefore has no projected membership.
  state.combatants.attacker.position = { x: 75, y: 25 }
  expect(dnd5eAreaAttackAdvantageCandidates(state, 'attacker')).toHaveLength(1)
  state.companionScene!.map.dnd5ePluginAreas = []
  expect(dnd5eAreaAttackAdvantageCandidates(state, 'target')).toEqual([])
})

it('rejects a later beam reaction after an earlier beam pushes the target outside', () => {
  const { snapshot } = fixture()
  const { state } = snapshot()
  Object.assign(state.combatants.attacker, { controller: 'player', classId: 'warlock', classLevels: { warlock: 5 }, level: 5,
    classSelections: { 'spell-cantrips': ['eldritch-blast'], 'eldritch-invocations': ['repelling-blast'] } })
  const action: Extract<Dnd5eAction, { type: 'cast-spell' }> = { type: 'cast-spell', actorId: 'attacker', targetId: 'target',
    spellId: 'eldritch-blast', slotLevel: 0, effectRolls: [], repellingBlast: true, projectileTargetIds: ['target', 'target'],
    targetAttacks: [
      { targetId: 'target', d20: 20, d20Second: 20, effectRolls: [1, 1], repellingBlastPushTo: { x: 25, y: 25 }, repellingBlastPushDistanceFeet: 5 },
      { targetId: 'target', d20: 2, d20Second: 2, effectRolls: [] },
    ] }
  const ordinary = resolveDnd5eHeadlessAction(state, action)
  expect(ordinary.ok, ordinary.ok ? undefined : ordinary.reason).toBe(true)
  if (!ordinary.ok) return
  expect(ordinary.state.combatants.target.position).toEqual({ x: 25, y: 25 })
  const invalid = resolveDnd5eHeadlessAction(state, { ...action, targetAttacks: action.targetAttacks!.map((roll, index) =>
    index === 1 ? { ...roll, d20Second: 18, effectRolls: [1], areaAttackAdvantageReaction: { areaId: 'hawk', sourceId: 'owner' } } : roll) })
  expect(invalid.ok).toBe(false)
  expect(invalid.state.combatants.owner.turn.reactionAvailable).toBe(true)
  expect(invalid.state.combatants.target.position).toEqual(state.combatants.target.position)
  expect(invalid.state.combatants.target.currentHp).toBe(state.combatants.target.currentHp)
})

it('spends a separate owner reaction for the redirected attack and rolls back a forged offer', () => {
  const { map, snapshot, attack } = fixture()
  const { state } = snapshot({ ...map, tokens: [...map.tokens, { id: 'hunter', type: 'enemy', label: 'Hunter',
    x: 125, y: 75, size: 1, hp: 30, maxHp: 30, emoji: '', color: '' }] })
  Object.assign(state.combatants.hunter, { controller: 'player', armorClass: 20, classId: 'ranger', subclassId: 'hunter', classLevels: { ranger: 15 }, level: 15,
    classSelections: { 'superior-hunters-defense': ['stand-against-tide'] } })
  const redirected: typeof attack = { ...attack, targetId: 'hunter', areaAttackAdvantageReaction: undefined, d20Second: undefined,
    damage: { count: 1, sides: 6, bonus: 0, rolls: [] },
    classDamageContext: { mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 6, damageType: 'slashing', adjacentEnemyOfTarget: false },
    standAgainstTide: { targetId: 'target', distanceFeet: 5, d20: 2, d20Second: 18, damageRolls: [[3]],
      areaAttackAdvantageReaction: { areaId: 'hawk', sourceId: 'owner' } } }
  const result = resolveDnd5eHeadlessAction(state, redirected)
  expect(result.ok, result.ok ? undefined : result.reason).toBe(true); if (!result.ok) return
  expect(result.events.filter(e => e.type === 'attack-resolved').map(e => e.d20)).toEqual([2, 18])
  expect(result.state.combatants.owner.turn.reactionAvailable).toBe(false)
  expect(result.state.combatants.hunter.turn.reactionAvailable).toBe(false)
  const bad = resolveDnd5eHeadlessAction(state, { ...redirected, standAgainstTide: { ...redirected.standAgainstTide!,
    areaAttackAdvantageReaction: { areaId: 'forged', sourceId: 'owner' } } })
  expect(bad.ok).toBe(false)
  expect(bad.state.combatants.owner.turn.reactionAvailable).toBe(true)
  expect(bad.state.combatants.hunter.turn.reactionAvailable).toBe(true)
  expect(bad.state.combatants.target.currentHp).toBe(state.combatants.target.currentHp)
})

it('cancels disadvantage without replacing the rules for advantage stacking', () => {
  const { snapshot, attack } = fixture()
  const result = resolveDnd5eHeadlessAction(snapshot().state, { ...attack, mode: 'disadvantage' })
  expect(result.ok).toBe(true); if (!result.ok) return
  expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 2, hit: false }))
  expect(result.state.combatants.owner.turn.reactionAvailable).toBe(false)
})

it('applies the same bounded reaction to a spell attack', () => {
  const { snapshot } = fixture(); const { state } = snapshot()
  Object.assign(state.combatants.attacker, { controller:'player', classId: 'wizard', classLevels: { wizard: 1 }, level: 1,
    classSelections: { 'spell-cantrips': ['shocking-grasp'] } })
  const result = resolveDnd5eHeadlessAction(state, { type: 'cast-spell', actorId: 'attacker', targetId: 'target',
    spellId: 'shocking-grasp', slotLevel: 0, d20: 2, d20Second: 18, effectRolls: [3],
    areaAttackAdvantageReaction: { areaId: 'hawk', sourceId: 'owner' } })
  expect(result.ok, result.ok ? undefined : result.reason).toBe(true); if (!result.ok) return
  expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', attackCategory: 'spell', d20: 18, hit: true }))
  expect(result.state.combatants.owner.turn.reactionAvailable).toBe(false)
})

it('supports one projectile and rejects spending the same reaction on a second projectile atomically', () => {
  const { map, snapshot } = fixture()
  const { state } = snapshot({ ...map, tokens: map.tokens.map(t => t.id === 'attacker' ? { ...t, x: 225 } : t) })
  Object.assign(state.combatants.attacker, { controller: 'player', classId: 'wizard', classLevels: { wizard: 3 }, level: 3,
    classSelections: { 'spell-prepared': ['scorching-ray'] }, classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } } })
  const use = { areaId: 'hawk', sourceId: 'owner' }
  const action: Extract<Dnd5eAction, { type: 'cast-spell' }> = { type: 'cast-spell', actorId: 'attacker', targetId: 'target',
    spellId: 'scorching-ray', slotLevel: 2, effectRolls: [], projectileTargetIds: ['target', 'target', 'target'],
    targetAttacks: [
      { targetId: 'target', d20: 2, d20Second: 18, effectRolls: [2, 2], areaAttackAdvantageReaction: use },
      { targetId: 'target', d20: 2, effectRolls: [] }, { targetId: 'target', d20: 2, effectRolls: [] },
    ] }
  const result = resolveDnd5eHeadlessAction(state, action)
  expect(result.ok, result.ok ? undefined : result.reason).toBe(true); if (!result.ok) return
  expect(result.events.filter(e => e.type === 'attack-resolved').map(e => e.d20)).toEqual([18, 2, 2])
  expect(result.state.combatants.owner.turn.reactionAvailable).toBe(false)
  const original = structuredClone(state)
  const bad = resolveDnd5eHeadlessAction(state, { ...action, targetAttacks: action.targetAttacks!.map((roll, i) =>
    i === 1 ? { ...roll, d20Second: 18, effectRolls: [2, 2], areaAttackAdvantageReaction: use } : roll) })
  expect(bad.ok).toBe(false)
  expect(bad.state.combatants.owner.turn.reactionAvailable).toBe(true)
  expect(bad.state.combatants.attacker.classResources['dnd5e-spell-slot-2'].current).toBe(1)
  expect(bad.state.combatants.target.currentHp).toBe(original.combatants.target.currentHp)
  expect(state).toEqual(original)
})

it('supports a monster weapon attack through the same reaction cost', () => {
  const { snapshot } = fixture(); const { state } = snapshot()
  state.combatants.attacker.statBlockId = 'srd-5.1:goblin'
  state.combatants.target.controller = 'player'
  const result = resolveDnd5eHeadlessAction(state, { type: 'monster-action', actorId: 'attacker', actionId: 'scimitar',
    rolls: [{ targetId: 'target', d20: 2, d20Second: 18, damageRolls: [[3]], areaAttackAdvantageReaction: { areaId: 'hawk', sourceId: 'owner' } }] })
  expect(result.ok, result.ok ? undefined : result.reason).toBe(true); if (!result.ok) return
  expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 18, hit: true }))
  expect(result.state.combatants.owner.turn.reactionAvailable).toBe(false)
})

it('rejects forged ownership, missing occupancy, expired areas and incapacitated or spent owners', () => {
  const { map, snapshot, attack } = fixture()
  for (const condition of ['incapacitated', 'stunned', 'paralyzed', 'unconscious', 'petrified']) {
    const { state } = snapshot(); state.combatants.owner.conditions = [condition]
    state.combatants.owner.classState.activeEffects = [createDnd5eConditionEffect({condition:condition as Dnd5eStandardConditionId,source:{kind:'system'},targetId:'owner'})]
    expect(resolveDnd5eHeadlessAction(state, attack).ok, condition).toBe(false)
    expect(state.combatants.owner.turn.reactionAvailable).toBe(true)
  }
  for (const state of [snapshot({ ...map, dnd5ePluginAreas: [] }).state,
    snapshot({ ...map, tokens: map.tokens.map(t => t.id === 'target' ? { ...t, x: 175 } : t) }).state,
    snapshot(map, 11).state, snapshot(map, 1, 101).state]) {
    expect(dnd5eAreaAttackAdvantageCandidates(state, 'target')).toEqual([])
    expect(resolveDnd5eHeadlessAction(state, attack).ok).toBe(false)
  }
  const { state } = snapshot()
  expect(resolveDnd5eHeadlessAction(state, { ...attack, areaAttackAdvantageReaction: { areaId: 'hawk', sourceId: 'attacker' } }).ok).toBe(false)
  state.combatants.target.magicSuppressed = true
  expect(dnd5eAreaAttackAdvantageCandidates(state, 'target')).toEqual([])
})

it('persists only the area declaration and rebuilds transient offers from the current map', () => {
  const { map, owner, snapshot } = fixture()
  expect(migrateMapsState(JSON.parse(JSON.stringify({ maps: [map] }))).maps[0].dnd5ePluginAreas?.[0].attackAdvantageReaction).toBe('area-source')
  const invalid = structuredClone(map); (invalid.dnd5ePluginAreas![0] as any).attackAdvantageReaction = 'free'
  expect(migrateMapsState({ maps: [invalid] }).maps[0].dnd5ePluginAreas).toHaveLength(0)
  const value = snapshot()
  const saved = planDnd5eMapResultApplication({ map, characters: [owner], state: value.state, characterIdByCombatantId: value.characterIdByCombatantId })
  expect(JSON.stringify(saved)).not.toContain('persistentAreaAttackAdvantageSources')
})


it('supports opportunity attacks with separate reactions and rejects using the attacker reaction twice', () => {
  const { snapshot, attack, map } = fixture()
  const { state } = snapshot()
  const opportunity: Extract<Dnd5eAction, { type: 'opportunity-attack' }> = {
    type: 'opportunity-attack', actorId: 'attacker', targetId: 'target', attackModifier: 0,
    d20: 2, d20Second: 18, damage: attack.damage,
    areaAttackAdvantageReaction: { areaId: 'hawk', sourceId: 'owner' },
  }
  const result = resolveDnd5eHeadlessAction(state, opportunity)
  expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
  if (!result.ok) return
  expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 18, hit: true }))
  expect(result.state.combatants.attacker.turn.reactionAvailable).toBe(false)
  expect(result.state.combatants.owner.turn.reactionAvailable).toBe(false)
  expect(state.combatants.attacker.turn.reactionAvailable).toBe(true)
  const selfOwned = snapshot({ ...map, dnd5ePluginAreas: map.dnd5ePluginAreas!.map(area => ({ ...area, sourceTokenId: 'attacker', sourceCharacterId: '' })) }).state
  const invalid = resolveDnd5eHeadlessAction(selfOwned, { ...opportunity,
    areaAttackAdvantageReaction: { areaId: 'hawk', sourceId: 'attacker' } })
  expect(invalid.ok).toBe(false)
  expect(invalid.state.combatants.attacker.turn.reactionAvailable).toBe(true)
  expect(invalid.state.combatants.target.currentHp).toBe(selfOwned.combatants.target.currentHp)
})


it('supports a readied monster attack without allowing its reserved reaction to support itself', () => {
  const { snapshot, map } = fixture()
  for (const selfOwned of [false, true]) {
    const { state } = snapshot(selfOwned ? { ...map, dnd5ePluginAreas: map.dnd5ePluginAreas!.map(area =>
      ({ ...area, sourceTokenId: 'attacker', sourceCharacterId: '' })) } : map)
    state.combatants.attacker.statBlockId = 'srd-5.1:goblin'
    state.combatants.target.controller = 'player'
    const declared = resolveDnd5eHeadlessAction(state, { type: 'ready', actorId: 'attacker',
      trigger: 'Target approaches', actionKind: 'attack', targetId: 'target' })
    expect(declared.ok).toBe(true); if (!declared.ok) return
    declared.state.initiativeIndex = declared.state.initiativeOrder.indexOf('target')
    const result = resolveDnd5eHeadlessAction(declared.state, { type: 'trigger-readied-action', actorId: 'attacker',
      weaponExecution: { actionId: 'scimitar', rolls: [{ targetId: 'target', d20: 2, d20Second: 18,
        damageRolls: [[3]], areaAttackAdvantageReaction: { areaId: 'hawk', sourceId: selfOwned ? 'attacker' : 'owner' } }] } })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(!selfOwned)
    if (selfOwned) {
      expect(result.state.combatants.attacker.turn.reactionAvailable).toBe(true)
      expect(result.state.combatants.target.currentHp).toBe(declared.state.combatants.target.currentHp)
      expect(result.state.combatants.attacker.classState.readiedAction).toEqual(declared.state.combatants.attacker.classState.readiedAction)
    } else {
      expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 18, hit: true }))
      expect(result.state.combatants.attacker.turn.reactionAvailable).toBe(false)
      expect(result.state.combatants.owner.turn.reactionAvailable).toBe(false)
      expect(result.state.combatants.attacker.classState.readiedAction).toBeUndefined()
    }
  }
})


it('heals selected aura occupants after a slot spell heals a creature outside the aura', () => {
  const { map, snapshot } = fixture()
  const healingMap = { ...map, dnd5ePluginAreas: map.dnd5ePluginAreas!.map(area => ({ ...area,
    attackAdvantageReaction: undefined, sourceSlotSpellHealing: { amount: 3 } })) }
  const { state } = snapshot(healingMap)
  state.initiativeIndex = state.initiativeOrder.indexOf('owner')
  const owner = state.combatants.owner
  Object.assign(owner, { classId: 'druid', classLevels: { druid: 3 }, level: 3,
    classSelections: { 'spell-prepared': ['healing-word'] } })
  owner.turn.actionAvailable = true; owner.turn.bonusActionAvailable = true
  owner.classResources['dnd5e-spell-slot-1'] = { current: 2, max: 2 }
  state.combatants.attacker.controller = 'player'
  state.combatants.attacker.currentHp = 10
  state.combatants.target.currentHp = 10
  const action: Extract<Dnd5eAction, {type:'cast-spell'}> = { type: 'cast-spell', actorId: 'owner',
    targetId: 'attacker', spellId: 'healing-word', slotLevel: 1, effectRolls: [2],
    sourceSlotSpellHealingTargets: [{ areaId: 'hawk', targetIds: ['target'] }] }
  const result = resolveDnd5eHeadlessAction(state, action)
  expect(result.ok, result.ok ? undefined : result.reason).toBe(true); if (!result.ok) return
  expect(result.state.combatants.attacker.currentHp).toBeGreaterThan(10)
  expect(result.state.combatants.target.currentHp).toBe(13)
  expect(result.state.combatants.owner.classResources['dnd5e-spell-slot-1'].current).toBe(1)
  expect(result.state.combatants.owner.turn.reactionAvailable).toBe(true)
  expect(result.events.filter(e => e.type === 'healing-applied' && e.targetId === 'target')).toHaveLength(1)
  const declined = resolveDnd5eHeadlessAction(state, { ...action, sourceSlotSpellHealingTargets: [] })
  expect(declined.ok).toBe(true)
  expect(declined.state.combatants.target.currentHp).toBe(10)
  for (const choices of [[{ areaId: 'hawk', targetIds: ['attacker'] }],
    [{ areaId: 'hawk', targetIds: ['target', 'target'] }],
    [{ areaId: 'hawk', targetIds: ['target'] }, { areaId: 'hawk', targetIds: ['target'] }],
    [{ areaId: 'forged', targetIds: ['target'] }]]) {
    const bad = resolveDnd5eHeadlessAction(state, { ...action, sourceSlotSpellHealingTargets: choices })
    expect(bad.ok).toBe(false)
    expect(bad.state.combatants.attacker.currentHp).toBe(10)
    expect(bad.state.combatants.target.currentHp).toBe(10)
    expect(bad.state.combatants.owner.classResources['dnd5e-spell-slot-1'].current).toBe(2)
  }
  for (const kind of ['expired', 'removed', 'suppressed-source', 'suppressed-target', 'moved-target', 'prevented-healing', 'no-slot'] as const) {
    const altered = structuredClone(state)
    if (kind === 'expired') altered.companionScene!.worldMinute = 101
    if (kind === 'removed') altered.companionScene!.map.dnd5ePluginAreas = []
    if (kind === 'suppressed-source') altered.combatants.owner.magicSuppressed = true
    if (kind === 'suppressed-target') altered.combatants.target.magicSuppressed = true
    if (kind === 'moved-target') altered.combatants.target.position = { x: 275, y: 25 }
    if (kind === 'prevented-healing') altered.combatants.attacker.classState.activeEffects = [
      { ...createDnd5eConditionEffect({ condition: 'poisoned', targetId: 'attacker', source: { kind: 'system' } }),
        modifiers: { preventHealing: true } }]
    if (kind === 'no-slot') altered.combatants.owner.classResources['dnd5e-spell-slot-1'].current = 0
    const bad = resolveDnd5eHeadlessAction(altered, action)
    expect(bad.ok, kind).toBe(false)
    expect(bad.state.combatants.attacker.currentHp, kind).toBe(10)
    expect(bad.state.combatants.target.currentHp, kind).toBe(10)
    expect(bad.state.combatants.owner.classResources['dnd5e-spell-slot-1'].current, kind).toBe(kind === 'no-slot' ? 0 : 2)
  }
  const restored = migrateMapsState(JSON.parse(JSON.stringify({ maps: [healingMap] }))).maps[0]
  expect(restored.dnd5ePluginAreas![0].sourceSlotSpellHealing).toEqual({ amount: 3 })
})


it('grants source/allies detection checks against creatures inside, even with the observer outside', () => {
  const { map, snapshot } = fixture()
  const { state } = snapshot({ ...map, dnd5ePluginAreas: map.dnd5ePluginAreas!.map(area => ({ ...area,
    attackAdvantageReaction: undefined, creatureDetectionAdvantage: 'source-and-allies' as const })) })
  state.initiativeIndex = state.initiativeOrder.indexOf('owner')
  const check: Extract<Dnd5eAction, {type:'ability-check'}> = { type: 'ability-check', actorId: 'owner',
    ability: 'int', skill: 'investigation', detectedCreatureId: 'target', d20: 2, d20Second: 18, dc: 10 }
  const result = resolveDnd5eHeadlessAction(state, check)
  expect(result.ok).toBe(true)
  expect(result.events).toContainEqual(expect.objectContaining({type:'ability-check-resolved',mode:'advantage',d20:18}))
  const perceived = resolveDnd5eHeadlessAction(state, { ...check, ability:'wis', skill:'perception',
    detectedCreatureId:undefined, perceivedTargetId:'target' })
  expect(perceived.events).toContainEqual(expect.objectContaining({type:'ability-check-resolved',mode:'advantage',d20:18}))
  const ordinary = resolveDnd5eHeadlessAction(state, { ...check, detectedCreatureId:undefined })
  expect(ordinary.events).toContainEqual(expect.objectContaining({type:'ability-check-resolved',mode:'normal',d20:2}))
  for (const kind of ['moved','expired','removed','unallied','suppressed','incapacitated'] as const) {
    const altered = structuredClone(state)
    if(kind==='moved')altered.combatants.target.position={x:275,y:25}
    if(kind==='expired')altered.companionScene!.worldMinute=101
    if(kind==='removed')altered.companionScene!.map.dnd5ePluginAreas=[]
    if(kind==='unallied'){altered.combatants.attacker.controller='dm';altered.initiativeIndex=altered.initiativeOrder.indexOf('attacker')}
    if(kind==='suppressed')altered.combatants.target.magicSuppressed=true
    if(kind==='incapacitated'){altered.combatants.owner.classState.activeEffects=[createDnd5eConditionEffect({condition:'incapacitated',targetId:'owner',source:{kind:'system'}})];altered.combatants.attacker.controller='player';altered.initiativeIndex=altered.initiativeOrder.indexOf('attacker')}
    const noBonus=resolveDnd5eHeadlessAction(altered,{...check,actorId:kind==='unallied'||kind==='incapacitated'?'attacker':'owner'})
    expect(noBonus.events,kind).toContainEqual(expect.objectContaining({type:'ability-check-resolved',mode:'normal',d20:2}))
  }
  const cancelled=resolveDnd5eHeadlessAction(state,{...check,mode:'disadvantage'})
  expect(cancelled.events).toContainEqual(expect.objectContaining({type:'ability-check-resolved',mode:'normal',d20:2}))
})

it('applies target-dependent detection advantage to passive checks without stacking advantage', () => {
  const {map,snapshot}=fixture()
  const {state}=snapshot({...map,dnd5ePluginAreas:map.dnd5ePluginAreas!.map(area=>({...area,creatureDetectionAdvantage:'source-and-allies' as const}))})
  const base=state.combatants.owner.passivePerception
  expect(dnd5ePassivePerceptionAgainst(state,'owner','target')).toBe(base+5)
  state.companionScene!.map.dnd5ePluginAreas!.push({...state.companionScene!.map.dnd5ePluginAreas![0],id:'second-aura'})
  expect(dnd5ePassivePerceptionAgainst(state,'owner','target')).toBe(base+5)
  expect(dnd5ePassivePerceptionAgainst(state,'owner','attacker')).toBe(base)
  state.combatants.owner.classState.activeEffects=[createDnd5eConditionEffect({condition:'poisoned',targetId:'owner',source:{kind:'system'}})]
  state.combatants.owner.conditions=['poisoned']
  expect(dnd5ePassivePerceptionAgainst(state,'owner','target')).toBe(base)
  expect(dnd5ePassivePerceptionAgainst(state,'owner','attacker')).toBe(base-5)
  state.companionScene!.worldMinute=101
  expect(dnd5ePassivePerceptionAgainst(state,'owner','target')).toBe(base-5)
})

it.each(['hide','rogue-cunning-action','ranger-vanish'] as const)('compares %s against the observer aura-adjusted passive detection', kind => {
  const {map,snapshot}=fixture()
  const {state}=snapshot({...map,dnd5ePluginAreas:map.dnd5ePluginAreas!.map(area=>({...area,creatureDetectionAdvantage:'source-and-allies' as const}))})
  state.initiativeIndex=state.initiativeOrder.indexOf('target')
  const actor=state.combatants.target
  actor.classLevels={rogue:2,ranger:14};actor.level=16
  actor.classState.activeEffects=[createDnd5eConditionEffect({condition:'invisible',targetId:'target',source:{kind:'system'}})]
  actor.conditions=['invisible']
  const action:Dnd5eAction=kind==='hide'?{type:kind,actorId:'target',d20:12}
    :kind==='rogue-cunning-action'?{type:kind,actorId:'target',option:'hide',hideAllowed:true,d20:12}
    :{type:kind,actorId:'target',hideAllowed:true,d20:12}
  const withAura=resolveDnd5eHeadlessAction(state,action)
  expect(withAura.ok,withAura.ok?'':withAura.reason).toBe(true)
  expect(withAura.state.combatants.target.classState.hiddenCheckTotal).toBeUndefined()
  const ordinary=structuredClone(state);ordinary.companionScene!.map.dnd5ePluginAreas=[]
  const withoutAura=resolveDnd5eHeadlessAction(ordinary,action)
  expect(withoutAura.ok,withoutAura.ok?'':withoutAura.reason).toBe(true)
  expect(withoutAura.state.combatants.target.classState.hiddenCheckTotal).toBe(12)
})
