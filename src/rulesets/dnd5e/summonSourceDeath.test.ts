import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { migrateMapsState, type BattleMap, type Token } from '../../store/maps'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication, reconcileDnd5eSummonSourceDeathsOnMap, reconcileDnd5eSummonSourceDeathsAcrossMaps } from './mapBridge'
import { resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { planDnd5eSummonedCreature, reconcileDnd5eSummonedCreatures } from './summonedCreatures'

it.each(['unconscious', 'dead', 'warded', 'invalid', 'control-ended'] as const)('settles and persists source-bound summon death (%s)', scenario => {
  const owner = normalizeCharacter({ id: 'owner', name: 'Owner', charClass: '法师', level: 5, currentHp: 30, maxHp: 30 })
  const caster: Token = { id: 'caster', characterId: owner.id, label: 'Owner', type: 'player', x: 25, y: 25, size: 1, color: '', emoji: '' }
  const killer: Token = { id: 'killer', label: 'Killer', type: 'enemy', poolId: 'srd-5.1:bandit', hp: 30, maxHp: 30,
    x: 75, y: 25, size: 1, color: '', emoji: '' }
  const map: BattleMap = { id: 'death-bound', name: 'Map', width: 500, height: 500, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [caster, killer] }
  const planned = planDnd5eSummonedCreature({ map, actorToken: caster, sourceCharacterId: owner.id,
    featureId: 'companion', pluginId: 'test.death-bound', actionId: 'create', round: 1, initiativeD20: 10,
    targetCell: { col: 2, row: 2 }, summon: { monsterId: 'srd-5.1:wolf', durationRounds: 10, persistent: true,
      sourceDeathBehavior: 'die', concentration: false } })
  expect(planned.ok).toBe(true)
  if (!planned.ok) throw Error('Expected summon')
  const companion = planned.plan.token
  if (scenario === 'control-ended') companion.dnd5eSummon!.controlEnded = true
  if (scenario === 'warded') companion.dnd5eCombatState = { activeEffects: [createDnd5eMechanicalEffect({
    id: 'ward', definitionId: 'srd-5.1:spell:death-ward', label: 'Ward', targetId: companion.id,
    source: { kind: 'spell', actorId: 'caster' }, duration: { type: 'permanent' },
  })] }
  const saved = migrateMapsState(JSON.parse(JSON.stringify({ maps: [{ ...map, tokens: [...map.tokens, companion] }] }))).maps[0]
  expect(saved.tokens[2].dnd5eSummon?.sourceDeathBehavior).toBe('die')
  const initiativeOrder = saved.tokens.map((t, i) => ({ tokenId: t.id, label: t.label, roll: t.id === 'killer' ? 30 : 20 - i, emoji: '', color: '' })).sort((a, b) => b.roll - a.roll)
  const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'source-death', map: saved, characters: [owner], initiativeOrder })
  if (scenario !== 'unconscious') {
    snapshot.state.combatants.caster.currentHp = 0
    snapshot.state.combatants.caster.deathSaves.failures = 2
  }
  const before = structuredClone(snapshot.state)
  const result = resolveDnd5eHeadlessAction(snapshot.state, { type: 'attack', actorId: 'killer', targetId: 'caster',
    d20: 15, attackModifier: 20, damage: { count: 1, sides: 100, bonus: 0,
      rolls: [scenario === 'invalid' ? 101 : scenario === 'unconscious' ? 30 : 60], type: 'force' } })
  expect(snapshot.state).toEqual(before)
  expect(result.ok, result.ok ? undefined : result.reason).toBe(scenario !== 'invalid')
  if (!result.ok) { expect(result.state).toEqual(before); return }
  const dies = scenario !== 'unconscious' && scenario !== 'warded'
  expect(result.state.combatants[companion.id].deathSaves.dead).toBe(dies)
  expect(result.events.filter(event => event.type === 'instant-death' && event.targetId === companion.id)).toHaveLength(dies ? 1 : 0)
  if (scenario === 'warded') expect(result.events).toContainEqual(expect.objectContaining({ type: 'death-ward-triggered', targetId: companion.id, trigger: 'instant-death' }))
  const application = planDnd5eMapResultApplication({ state: result.state, map: saved, characters: [owner],
    characterIdByCombatantId: snapshot.characterIdByCombatantId, events: [...result.events] })
  const reloaded = migrateMapsState(JSON.parse(JSON.stringify({ maps: [application.map] }))).maps[0]
  const surviving = reloaded.tokens.find(token => token.id === companion.id)!
  expect(surviving).toBeDefined()
  expect(surviving.dnd5eSummon?.sourceDeathHandled).toBe(scenario === 'unconscious' ? undefined : true)
  if (dies) expect(surviving.hp).toBe(0)
  const reconciled = reconcileDnd5eSummonedCreatures({ map: reloaded, characters: application.characters, round: 2 })
  expect(reconciled.removedTokenIds).not.toContain(companion.id)
  const restored = createDnd5eMapCombatSnapshot({ combatId: 'source-death', map: reconciled.map, characters: application.characters, initiativeOrder })
  const repeated = resolveDnd5eHeadlessAction(restored.state, { type: 'end-turn', actorId: 'killer' })
  expect(repeated.ok, repeated.ok ? undefined : repeated.reason).toBe(true)
  expect(repeated.events.filter(event => event.type === 'instant-death' && event.targetId === companion.id)).toEqual([])
  expect(repeated.state.combatants[companion.id].deathSaves.dead).toBe(dies)
})

it.each(['dead', 'unconscious', 'missing', 'warded', 'replaced'] as const)(
  'reconciles a persistent companion against the authoritative roster (%s)', scenario => {
    const owner = normalizeCharacter({ id: 'owner', name: 'Owner', charClass: '法师', level: 5,
      currentHp: 0, maxHp: 30, deathSaveFailures: scenario === 'unconscious' ? 0 : 3 })
    const caster: Token = { id: 'original-token', characterId: owner.id, label: 'Owner', type: 'player',
      x: 25, y: 25, size: 1, color: '', emoji: '' }
    const map: BattleMap = { id: 'remote', name: 'Remote', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [caster] }
    const planned = planDnd5eSummonedCreature({ map, actorToken: caster, sourceCharacterId: owner.id,
      featureId: 'bound', pluginId: 'test.death-bound', actionId: 'create', round: 1, initiativeD20: 10,
      targetCell: { col: 2, row: 2 }, summon: { monsterId: 'srd-5.1:wolf', durationRounds: 10,
        persistent: true, sourceDeathBehavior: 'die', concentration: false } })
    if (!planned.ok) throw Error('Expected summon')
    const companion = planned.plan.token
    if (scenario === 'warded') companion.dnd5eCombatState = { activeEffects: [createDnd5eMechanicalEffect({
      id: 'ward', definitionId: 'srd-5.1:spell:death-ward', label: 'Ward', targetId: companion.id,
      source: { kind: 'spell', actorId: caster.id }, duration: { type: 'permanent' },
    })] }
    const unrelated: Token = { ...caster, id: 'unrelated', characterId: undefined, type: 'enemy', poolId: 'srd-5.1:bandit', hp: 7, maxHp: 11 }
    map.tokens = [companion, unrelated, ...(scenario === 'replaced' ? [{ ...caster, id: 'new-token' }] : [])]
    const characters = scenario === 'missing' ? [] : [owner]
    const before = structuredClone({ map, characters })
    const settled = reconcileDnd5eSummonSourceDeathsOnMap({ map, characters, round: 9 })
    expect({ map, characters }).toEqual(before)
    if (scenario === 'dead') {
      const empty = { ...map, id: 'active-without-companions', tokens: [unrelated] }
      const other = { ...map, id: 'another-unopened-map', tokens: [{ ...companion, id: 'other-companion' }] }
      for (const maps of [[empty, map, other], [other, map, empty]]) {
        const across = reconcileDnd5eSummonSourceDeathsAcrossMaps({ maps, characters, round: 9 })
        expect(across.maps.find(candidate => candidate.id === empty.id)).toBe(empty)
        expect(across.maps.filter(candidate => candidate.id !== empty.id).map(candidate => candidate.tokens[0].hp)).toEqual([0, 0])
        expect(across.events.filter(event => event.type === 'instant-death')).toHaveLength(2)
        const replay = reconcileDnd5eSummonSourceDeathsAcrossMaps({ maps: across.maps, characters: across.characters, round: 10 })
        expect(replay.maps).toBe(across.maps)
        expect(replay.events).toEqual([])
      }
    }
    expect(settled.map.tokens.find(token => token.id === unrelated.id)).toBe(unrelated)
    const killed = scenario === 'dead' || scenario === 'replaced'
    const next = settled.map.tokens[0]
    expect(next.hp === 0).toBe(killed)
    expect(next.dnd5eSummon?.sourceDeathHandled).toBe(['dead', 'replaced', 'warded'].includes(scenario) ? true : undefined)
    expect(settled.events.filter(event => event.type === 'instant-death')).toHaveLength(killed ? 1 : 0)
    if (scenario === 'warded') expect(settled.events.some(event => event.type === 'death-ward-triggered')).toBe(true)
    const saved = migrateMapsState(JSON.parse(JSON.stringify({ maps: [settled.map] }))).maps[0]
    const repeated = reconcileDnd5eSummonSourceDeathsOnMap({ map: saved, characters: settled.characters, round: 10 })
    expect(repeated.map).toBe(saved)
    expect(repeated.events).toEqual([])
    expect(reconcileDnd5eSummonedCreatures({ map: saved, characters, round: 999 }).removedTokenIds).toEqual([])
    if (scenario === 'warded') {
      const absent = reconcileDnd5eSummonSourceDeathsOnMap({ map: saved, characters: [], round: 11 })
      expect(absent.map).toBe(saved)
      const revivedOwner = normalizeCharacter({ ...owner, currentHp: 30, deathSaveFailures: 0 })
      const rearmed = reconcileDnd5eSummonSourceDeathsOnMap({ map: saved, characters: [revivedOwner], round: 12 })
      expect(rearmed.map.tokens[0].dnd5eSummon?.sourceDeathHandled).toBeUndefined()
      expect(rearmed.map.tokens[0].hp).toBe(companion.hp)
      expect(rearmed.events).toEqual([])
      const restored = migrateMapsState(JSON.parse(JSON.stringify({ maps: [rearmed.map] }))).maps[0]
      const nextDeath = reconcileDnd5eSummonSourceDeathsOnMap({ map: restored, characters: [owner], round: 13 })
      expect(nextDeath.map.tokens[0].hp).toBe(0)
      expect(nextDeath.events.filter(event => event.type === 'instant-death')).toHaveLength(1)
      const livingOwnerDeadCompanion = reconcileDnd5eSummonSourceDeathsOnMap({
        map: nextDeath.map, characters: [revivedOwner], round: 14,
      })
      expect(livingOwnerDeadCompanion.map).toBe(nextDeath.map)
      expect(reconcileDnd5eSummonedCreatures({ map: livingOwnerDeadCompanion.map,
        characters: [revivedOwner], round: 14 }).removedTokenIds).toEqual([])
    }
  },
)
