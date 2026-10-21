import { expect, it } from 'vitest'
import { createEmptyMapGeometry, mapGeometryOrdinaryProjectileBlocked } from '../../lib/mapGeometry'
import { migrateMapsState, type BattleMap, type Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { prepareDnd5eDruidGroveGusts } from './druidGroveGusts'
import { collectDnd5ePersistentAreaTriggers, expireDnd5ePluginAreasAtWorldMinute, reconcileDnd5ePluginAreasOnMap } from './pluginAreas'
import { dnd5ePersistentAreaDirectionalMovementCostAt } from './persistentAreaGeometry'
import { prepareDnd5ePersistentAreaTrigger, resolvePreparedDnd5ePersistentAreaTrigger } from './pluginAreaTransactions'
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





const winds = [{ origin: { col: 2, row: 0 }, aim: { col: 2, row: 1 } },
  { origin: { col: 5, row: 0 }, aim: { col: 5, row: 1 } }]
it.each(['target', 'caster'])('settles two persisted gusts for %s, including exemption and saves', targetId => {
  for (const exempt of [false, true]) for (const d20 of [1, 20]) {
    const input = fixture()
    input.map.tokens[1].characterId = 'victim'; input.map.tokens[1].type = 'player'
    const token = input.map.tokens.find(t => t.id === targetId)!
    token.x = 125; token.y = 125
    const result = prepareDnd5eDruidGroveGusts({ ...input, winds, exemptTokenIds: exempt ? [targetId] : [] })
    if (!result.ok) throw Error(result.reason)
    const map = migrateMapsState(JSON.parse(JSON.stringify({ maps: [{ ...input.map, dnd5ePluginAreas: result.areas }] }))).maps[0]
    expect(map.dnd5ePluginAreas).toHaveLength(2)
    const candidates = collectDnd5ePersistentAreaTriggers({ map, timing: 'turn-start', round: 2, targetTokenId: targetId, turnKey: 'turn-2' })
    expect(candidates).toHaveLength(exempt ? 0 : 1)
    expect(dnd5ePersistentAreaDirectionalMovementCostAt({ map, token, from: { x: 125, y: 175 }, to: token })).toBe(exempt ? 0 : 1)
    if (!exempt) {
      const prepared = prepareDnd5ePersistentAreaTrigger({ map, combatId: map.id, round: 2,
        characters: [character({ id: 'owner' }), character({ id: 'victim' })],
        initiativeOrder: map.tokens.map(t => ({ tokenId: t.id, roll: 10, label: t.label, emoji: '', color: '#fff', slotId: t.id })), candidate: candidates[0] })
      if (!prepared.ok) throw Error(JSON.stringify(prepared))
      const resolved = resolvePreparedDnd5ePersistentAreaTrigger({ prepared: prepared.prepared, d20 })
      expect(resolved.result.ok, JSON.stringify(resolved.result)).toBe(true)
      expect(resolved.application?.map.tokens.find(t => t.id === targetId)).toMatchObject({ x: 125, y: d20 === 1 ? 275 : 125 })
    }
    expect(expireDnd5ePluginAreasAtWorldMinute(map, 1539).dnd5ePluginAreas).toHaveLength(2)
    expect(expireDnd5ePluginAreasAtWorldMinute(map, 1540).dnd5ePluginAreas).toHaveLength(0)
    expect(mapGeometryOrdinaryProjectileBlocked({ map, from: { ...token, x: 25 }, to: { ...token, x: 275 } })).toBe(false)
  }
})

it('extinguishes exposed carried flames but preserves exempt creature lights', () => {
  for (const exempt of [false, true]) {
    const input = fixture()
    input.map.tokens[1] = { ...input.map.tokens[1], x: 125, y: 125, lightSource: {
      enabled: true, sourceKind: 'torch', brightRadiusFeet: 20, dimRadiusFeet: 20, color: '#f97316' } }
    const result = prepareDnd5eDruidGroveGusts({ ...input, winds, exemptTokenIds: exempt ? ['target'] : [] })
    if (!result.ok) throw Error(result.reason)
    const map = { ...input.map, dnd5ePluginAreas: result.areas }
    const reconciled = reconcileDnd5ePluginAreasOnMap(map, [character({ id: 'owner' })], 1)
    expect(!!reconciled.tokens[1].lightSource).toBe(exempt)
  }
})

it('rejects missing winds and zero directions', () => {
  expect(prepareDnd5eDruidGroveGusts({ ...fixture(), winds: [] }).ok).toBe(false)
  expect(prepareDnd5eDruidGroveGusts({ ...fixture(), winds: winds.map(w => ({ ...w, aim: w.origin })) }).ok).toBe(false)
})
