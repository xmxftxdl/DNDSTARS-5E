import { expect, it } from 'vitest'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import { migrateMapsState, type BattleMap, type Token, type Dnd5ePluginArea } from '../../store/maps'
import type { Character } from '../../types/character'
import { collectDnd5ePersistentAreaTriggers } from './pluginAreas'
import { dnd5ePersistentAreaDirectionalMovementCostAt } from './persistentAreaGeometry'
import { prepareDnd5ePersistentAreaTrigger, resolvePreparedDnd5ePersistentAreaTrigger } from './pluginAreaTransactions'
import { normalizeDnd5ePersistentAreaTriggerSnapshot } from './persistentAreaTypes'
function fixture() {
  const caster: Token = { id: 'caster', characterId: 'owner', label: 'Caster', type: 'player', x: 25, y: 25, size: 1, color: '', emoji: '' }
  const target: Token = { ...caster, id: 'target', characterId: undefined, type: 'enemy', x: 125, y: 25 }
  const map: BattleMap = { id: 'grove', name: 'Grove', width: 1_000, height: 1_000, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [caster, target] }
  const geometry = createEmptyMapGeometry(map.id, 1); geometry.environment = 'outdoors'
  return { map, geometry, placement: { origin: { col: 0, row: 0 }, sideFeet: 30, fogCells: [], undergrowthCells: [{ col: 2, row: 0 }], guardianTreeIds: [] },
    baseElevationFeet: 0, qualifications: { structureObstacleIds: [] as string[], treeTokenIds: [] },
    source: { castId: 'cast-1', pluginId: 'test.grove', spellId: 'grove', characterId: 'owner', tokenId: 'caster', slotLevel: 6, saveDc: 17 }, round: 1, worldMinute: 100 }
}

const character = (patch: Partial<Character> = {}): Character => ({
  id: 'caster', name: 'caster', player: '', avatar: '', accent: '', race: '人类', charClass: '法师', level: 3,
  background: '', experience: 0, reputation: 0, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  savingThrows: [], skills: [], maxHp: 10, currentHp: 10, tempHp: 0, hitDice: '3d6', ac: 10, speed: 30,
  initiativeBonus: 0, saveDC: 12, passivePerception: 10, inspiration: 0, conditions: [], notes: '', dmNotes: '',
  visibleToPlayers: true, ...patch,
})




it.each([1, 20])('settles fixed wind save %i independently of caster position after reload', d20 => {
  for (const sourceX of [25, 425]) {
    const input = fixture()
    input.map.tokens[0].x = sourceX
    input.map.tokens[1] = { ...input.map.tokens[1], characterId: 'victim', type: 'player', x: 125, y: 125 }
    const area: Dnd5ePluginArea = { id: 'wind', pluginId: 'grove', featureId: 'grove:wind', label: 'Wind', color: '#fff',
      sourceCharacterId: 'owner', sourceTokenId: 'caster', createdRound: 1, expiresAfterRound: 14400,
      cells: [{ col: 2, row: 2 }, { col: 2, row: 3 }], includeSelf: true, relation: 'any',
      directionalMovementCost: { direction: { dc: 0, dr: 1 }, additionalFeetPerFoot: 1 },
      triggers: [{ id: 'wind-save', label: 'Wind', timing: 'turn-start', oncePerTurn: true,
        savingThrow: { ability: 'str', dc: 17, onSuccess: 'none' },
        forcedMovement: { mode: 'push-fixed-direction', direction: { dc: 0, dr: 1 }, distanceFeet: 15, appliesOn: 'failed-save' } }] }
    const map = migrateMapsState(JSON.parse(JSON.stringify({ maps: [{ ...input.map, dnd5ePluginAreas: [area] }] }))).maps[0]
    const candidates = collectDnd5ePersistentAreaTriggers({ map, timing: 'turn-start', round: 2, targetTokenId: 'target', turnKey: 'turn-2' })
    expect(candidates).toHaveLength(1)
    const prepared = prepareDnd5ePersistentAreaTrigger({ map, combatId: map.id, round: 2,
      characters: [character({ id: 'owner' }), character({ id: 'victim' })],
      initiativeOrder: map.tokens.map(t => ({ tokenId: t.id, roll: 10, label: t.label, emoji: '', color: '#fff', slotId: t.id })), candidate: candidates[0] })
    if (!prepared.ok) throw Error(JSON.stringify(prepared))
    const resolved = resolvePreparedDnd5ePersistentAreaTrigger({ prepared: prepared.prepared, d20 })
    expect(resolved.result.ok, JSON.stringify(resolved.result)).toBe(true)
    expect(resolved.application?.map.tokens.find(t => t.id === 'target')).toMatchObject({ x: 125, y: d20 === 1 ? 275 : 125 })
    const query = (from: { x: number; y: number }, to: { x: number; y: number }) =>
      dnd5ePersistentAreaDirectionalMovementCostAt({ map, token: map.tokens[1], from, to })
    expect(query({ x: 125, y: 175 }, { x: 125, y: 125 })).toBe(1)
    expect(query({ x: 125, y: 125 }, { x: 125, y: 175 })).toBe(0)
    expect(query({ x: 75, y: 125 }, { x: 125, y: 125 })).toBe(0)
  }
})

it.each([{ dc: 0, dr: 0 }, { dc: 2, dr: 0 }, { dc: NaN, dr: 1 }])('rejects malformed fixed wind direction %j', direction => {
  expect(normalizeDnd5ePersistentAreaTriggerSnapshot({ id: 'bad', label: 'Bad', timing: 'turn-start',
    forcedMovement: { mode: 'push-fixed-direction', direction, distanceFeet: 15, appliesOn: 'always' } })).toBeUndefined()
})
