import { afterEach, expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { migrateMapsState, type BattleMap, type Dnd5ePluginArea } from '../../store/maps'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import { normalizeDnd5ePersistentAreaOccupantModifiers } from './persistentAreaTypes'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from './mapBridge'
import { dnd5eAbilityCheckRollMode, resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { createDnd5eMechanicalEffect } from './activeEffects'

afterEach(() => setMapGeometryRuntime([]))
function fixture() {
  const hero = normalizeCharacter({ id: 'hero', name: 'Hero', maxHp: 20, currentHp: 20 })
  const area: Dnd5ePluginArea = { id: 'rest-zone', pluginId: 'test', featureId: 'rest-zone', label: 'Rest zone', color: '#aaa',
    sourceTokenId: 'player', sourceCharacterId: 'hero', cells: [{ col: 0, row: 0 }, { col: 1, row: 0 }], anchorCell: { col: 0, row: 0 },
    createdRound: 1, expiresAfterRound: 100, includeSelf: true, relation: 'ally',
    occupantModifiers: { skillCheckBonuses: { stealth: 5, perception: 5 }, requiresLineOfEffectFromAnchor: true } }
  const map: BattleMap = { id: 'map', name: 'Map', width: 200, height: 100, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
    tokens: [{ id: 'player', characterId: 'hero', type: 'player', label: 'Hero', x: 75, y: 25, size: 1, emoji: '', color: '' },
      { id: 'enemy', type: 'enemy', label: 'Enemy', x: 75, y: 25, size: 1, emoji: '', color: '', hp: 20, maxHp: 20 }], dnd5ePluginAreas: [area] }
  const snapshot = (nextMap = map, characters = [hero]) => createDnd5eMapCombatSnapshot({ combatId: 'skill-zone', map: nextMap, characters,
    initiativeOrder: nextMap.tokens.map((t, i) => ({ tokenId: t.id, label: t.label, emoji: '', color: '', roll: 20 - i })) })
  return { hero, area, map, snapshot }
}
function check(state: ReturnType<ReturnType<typeof fixture>['snapshot']>['state'], skill: 'perception' | 'stealth' | 'arcana' | 'sleightOfHand') {
  const result = resolveDnd5eHeadlessAction(state, { type: 'ability-check', actorId: 'player',
    ability: skill === 'perception' ? 'wis' : skill === 'arcana' ? 'int' : 'dex', skill, d20: 10, dc: 0 })
  expect(result.ok, JSON.stringify(result)).toBe(true)
  const event = result.events.find(event => event.type === 'ability-check-resolved')
  if (!event || event.type !== 'ability-check-resolved') throw Error('missing check')
  return event.total
}

it('validates bounded skill identities and preserves area configuration in the archive', () => {
  const { map, area } = fixture()
  expect(normalizeDnd5ePersistentAreaOccupantModifiers(area.occupantModifiers)).toMatchObject(area.occupantModifiers!)
  for (const bonuses of [{}, { invented: 5 }, { stealth: 31 }, { stealth: -1 }, { stealth: 1.5 }, { stealth: '5' }]) {
    expect(normalizeDnd5ePersistentAreaOccupantModifiers({ skillCheckBonuses: bonuses })).toBeUndefined()
  }
  expect(normalizeDnd5ePersistentAreaOccupantModifiers({ skillCheckBonuses: { stealth: 5 }, requiresLineOfEffectFromAnchor: false })).toBeUndefined()
  expect(migrateMapsState(JSON.parse(JSON.stringify({ maps: [map] }))).maps[0].dnd5ePluginAreas?.[0].occupantModifiers).toMatchObject(area.occupantModifiers!)
})

it('applies actual checks and passive perception only to qualifying skills and allies without persisting bonuses', () => {
  const { map, hero, snapshot } = fixture()
  const base = snapshot({ ...map, dnd5ePluginAreas: [] })
  const active = snapshot()
  for (const skill of ['perception', 'stealth'] as const) expect(check(active.state, skill) - check(base.state, skill)).toBe(5)
  expect(check(active.state, 'arcana')).toBe(check(base.state, 'arcana'))
  expect(active.state.combatants.player.passivePerception - base.state.combatants.player.passivePerception).toBe(5)
  expect(active.state.combatants.enemy.persistentAreaSkillBonuses).toEqual({})
  const saved = planDnd5eMapResultApplication({ state: active.state, map, characters: [hero], characterIdByCombatantId: active.characterIdByCombatantId })
  const gone = snapshot({ ...saved.map, dnd5ePluginAreas: [] }, saved.characters)
  expect(check(gone.state, 'perception')).toBe(check(base.state, 'perception'))
  expect(gone.state.combatants.player.passivePerception).toBe(base.state.combatants.player.passivePerception)
  const outside = snapshot({ ...map, tokens: map.tokens.map(token => ({ ...token, x: 175 })) })
  expect(check(outside.state, 'stealth')).toBe(check(base.state, 'stealth'))
})

it('does not stack duplicates; different features add, and antimagic suspends the bonus', () => {
  const { area, map, snapshot } = fixture()
  const baseline = check(snapshot({ ...map, dnd5ePluginAreas: [] }).state, 'perception')
  expect(check(snapshot({ ...map, dnd5ePluginAreas: [area, { ...area, id: 'second-copy' }] }).state, 'perception') - baseline).toBe(5)
  expect(check(snapshot({ ...map, dnd5ePluginAreas: [area, { ...area, id: 'other', featureId: 'different' }] }).state, 'perception') - baseline).toBe(10)
  const suppressed = snapshot({ ...map, dnd5ePluginAreas: [area, { ...area, id: 'antimagic', occupantModifiers: { suppressesMagic: true } }] })
  expect(check(suppressed.state, 'perception')).toBe(baseline)
  expect(suppressed.state.combatants.player.passivePerception).toBe(snapshot({ ...map, dnd5ePluginAreas: [] }).state.combatants.player.passivePerception)
})

it('uses total cover from the fixed anchor rather than following the source token', () => {
  const { map, snapshot } = fixture()
  const baseline = check(snapshot({ ...map, dnd5ePluginAreas: [] }).state, 'perception')
  const geometry = createEmptyMapGeometry(map.id, 1)
  geometry.walls = [{ id: 'wall', kind: 'wall', label: 'Wall', points: [{ x: 50, y: 0 }, { x: 50, y: 100 }],
    blocksVision: true, blocksMovement: true, blocksLineOfEffect: true, baseHeightFeet: 0, heightFeet: 10, createdAt: 1 }]
  setMapGeometryRuntime([geometry])
  expect(check(snapshot().state, 'perception')).toBe(baseline)
  setMapGeometryRuntime([])
  expect(check(snapshot().state, 'perception')).toBe(baseline + 5)
})

it('traces spherical wards from their center height, not the underground lower bound', () => {
  const { map, area, snapshot } = fixture()
  area.vertical = { mode: 'volume', shape: 'sphere', baseElevationFeet: -30, heightFeet: 60 }
  const baseline = check(snapshot({ ...map, dnd5ePluginAreas: [] }).state, 'perception')
  const geometry = createEmptyMapGeometry(map.id, 1)
  geometry.walls = [{ id: 'wall', kind: 'wall', label: 'Wall', points: [{ x: 50, y: 0 }, { x: 50, y: 100 }],
    blocksVision: true, blocksMovement: true, blocksLineOfEffect: true, baseHeightFeet: 0, heightFeet: 10, createdAt: 1 }]
  setMapGeometryRuntime([geometry])
  expect(check(snapshot().state, 'perception')).toBe(baseline)
  setMapGeometryRuntime([])
  expect(check(snapshot().state, 'perception')).toBe(baseline + 5)
})

it.each(['perception', 'sleightOfHand'] as const)('honors the declared %s aura and archives canonical skill ids', skill => {
  const { map, snapshot, hero } = fixture()
  const effect = createDnd5eMechanicalEffect({ id: 'aura', definitionId: 'synthetic-aura', label: 'Aura', targetId: 'hero', source: { kind: 'spell', rulesId: 'synthetic-aura' },
    duration: { type: 'permanent' }, modifiers: { skillCheckBonusAuras: [{ skill, bonus: 3, radiusFeet: 30, relation: 'ally-and-self' }] } })
  const bare = { ...map, dnd5ePluginAreas: [] }
  const active = snapshot(bare, [{ ...hero, dnd5eCombatState: { ...hero.dnd5eCombatState, activeEffects: [effect] } }])
  expect(check(active.state, skill) - check(snapshot(bare).state, skill)).toBe(3)
  expect(check(active.state, 'stealth')).toBe(check(snapshot(bare).state, 'stealth'))
})


it('projects hearing-only area rules without persisting them after leaving or removal', () => {
  const { map, area, hero, snapshot } = fixture()
  const rules = [{ mode: 'disadvantage' as const, ability: 'wis' as const, skill: 'perception', sense: 'hearing' as const }]
  area.occupantModifiers = { abilityCheckRules: rules }
  expect(normalizeDnd5ePersistentAreaOccupantModifiers(area.occupantModifiers)?.abilityCheckRules).toEqual(rules)
  for (const invalid of [[], [{ mode: 'normal' }], [{ mode: 'disadvantage', sense: 'invented' }]]) {
    expect(normalizeDnd5ePersistentAreaOccupantModifiers({ abilityCheckRules: invalid })).toBeUndefined()
  }
  const restored = migrateMapsState(JSON.parse(JSON.stringify({ maps: [map] }))).maps[0]
  const active = snapshot(restored)
  const mode = (state: typeof active.state, context: 'hearing' | 'sight' = 'hearing') =>
    dnd5eAbilityCheckRollMode(state.combatants.player, { ability: 'wis', skill: 'perception', context })
  expect(mode(active.state)).toBe('disadvantage')
  expect(mode(active.state, 'sight')).toBe('normal')
  expect(dnd5eAbilityCheckRollMode(active.state.combatants.player, { ability: 'wis', skill: 'insight', context: 'hearing' })).toBe('normal')
  expect(dnd5eAbilityCheckRollMode(active.state.combatants.player, { ability: 'wis', skill: 'perception', context: 'hearing', requestedMode: 'advantage' })).toBe('normal')
  expect(mode(snapshot({ ...map, tokens: map.tokens.map(token => ({ ...token, x: 175 })) }).state)).toBe('normal')
  expect(mode(snapshot({ ...map, dnd5ePluginAreas: [area, { ...area, id: 'antimagic', occupantModifiers: { suppressesMagic: true } }] }).state)).toBe('normal')
  const saved = planDnd5eMapResultApplication({ state: active.state, map, characters: [hero], characterIdByCombatantId: active.characterIdByCombatantId })
  expect(mode(snapshot({ ...saved.map, dnd5ePluginAreas: [] }, saved.characters).state)).toBe('normal')
})


it('keeps the extended hearing radius separate from terrain and other occupant effects', () => {
  const { map, area, snapshot } = fixture()
  map.width = 2000
  area.relation = 'any'
  area.vertical = { mode: 'volume', shape: 'sphere', baseElevationFeet: 80, heightFeet: 40 }
  area.occupantModifiers = { abilityCheckRules: [{ mode: 'disadvantage', ability: 'wis', skill: 'perception', sense: 'hearing' }],
    abilityCheckRadiusFeet: 50, conditions: ['restrained'] }
  const mode = () => dnd5eAbilityCheckRollMode(snapshot().state.combatants.player, { ability: 'wis', skill: 'perception', context: 'hearing' })
  map.tokens[0].x = 525; map.tokens[0].elevationFeet = 100
  expect(mode()).toBe('disadvantage')
  expect(snapshot().state.combatants.player.conditions).not.toContain('restrained')
  map.tokens[0].x = 575
  expect(mode()).toBe('normal')
  map.tokens[0].x = 25; map.tokens[0].elevationFeet = 150
  expect(mode()).toBe('disadvantage')
  map.tokens[0].elevationFeet = 151
  expect(mode()).toBe('normal')
  expect(migrateMapsState(JSON.parse(JSON.stringify({ maps: [map] }))).maps[0].dnd5ePluginAreas?.[0].occupantModifiers?.abilityCheckRadiusFeet).toBe(50)
  for (const radius of [0, -1, 1001, '50', NaN]) {
    expect(normalizeDnd5ePersistentAreaOccupantModifiers({ ...area.occupantModifiers, abilityCheckRadiusFeet: radius })).toBeUndefined()
  }
  expect(normalizeDnd5ePersistentAreaOccupantModifiers({ abilityCheckRadiusFeet: 50 })).toBeUndefined()
})
