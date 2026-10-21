import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import type { BattleMap } from '../../store/maps'
import { readObjectFlightArrivalContext } from './objectFlightArrivalController'

function fixture() {
  const source: BattleMap = { id: 'source', name: 'Source', width: 500, height: 500, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [{ id: 'mage', characterId: 'character', type: 'player',
      label: 'Mage', x: 25, y: 25, size: 1, emoji: '', color: '' }] }
  const destination: BattleMap = { ...source, id: 'destination', tokens: [] }
  const data: Record<string, unknown> = {
    characters: { characters: [normalizeCharacter({ id: 'character', name: 'Mage', currentHp: 12, maxHp: 12 })], _sync: { revision: 3 } },
    maps: { maps: [source, destination], selectedId: 'source', _sync: { revision: 4 } },
    combat: { mapId: 'source', active: true, round: 2, initiativeOrder: [], _sync: { revision: 5 } },
    'map-geometry': null,
  }
  const read = async <T,>(name: string): Promise<T | null> => structuredClone(data[name]) as T | null
  return { data, read, source, destination }
}

it('loads both scenes and preserves the remote caster without inventing destination combat', async () => {
  const input = fixture()
  const context = await readObjectFlightArrivalContext('source', 'destination', input.read)
  expect(context.state.combatants.mage.currentHp).toBe(12)
  expect(context.characterIdByCombatantId.mage).toBe('character')
  expect(context.state.active).toBe(false)
  expect(context.destinationMap.tokens).toEqual([])
  expect(context.expectedRevisions).toEqual({ maps: 4, characters: 3, combat: 5, 'map-geometry': 0 })
  const same = await readObjectFlightArrivalContext('source', 'source', input.read)
  expect(Object.keys(same.state.combatants)).toEqual(['mage'])
  expect(same.state.active).toBe(true)
})

it.each(['maps', 'characters', 'combat', 'map-geometry'])('rejects unversioned %s before rolling', async name => {
  const input = fixture()
  input.data[name] = { ...(input.data[name] as object ?? {}), _sync: undefined }
  await expect(readObjectFlightArrivalContext('source', 'destination', input.read)).rejects.toThrow(`flight-snapshot-revision-required:${name}`)
})

it('rejects missing or ambiguous scenes and participants', async () => {
  const input = fixture()
  await expect(readObjectFlightArrivalContext('missing', 'destination', input.read)).rejects.toThrow('flight-map-snapshot-missing')
  input.destination.tokens = input.source.tokens
  await expect(readObjectFlightArrivalContext('source', 'destination', input.read)).rejects.toThrow('flight-ambiguous-participant')
})
