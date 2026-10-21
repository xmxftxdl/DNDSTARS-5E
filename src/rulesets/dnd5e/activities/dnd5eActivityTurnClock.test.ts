import { describe, expect, it } from 'vitest'
import { migrateMapsState, mergePlayerTokenCombatFields, type BattleMap } from '../../../store/maps'
import { advanceDnd5eActivityTurnClock, initializeDnd5eActivityTurnClock, normalizeDnd5eActivityTurnClock } from './dnd5eActivityTurnClock'

const map: BattleMap = { id: 'clock-map', name: 'Clock', width: 500, height: 500, gridSize: 50,
  gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [] }

describe('authoritative activity turn clock', () => {
  it('keeps a matching durable cursor through migration but rejects mismatched cursor metadata', () => {
    const clock={schemaVersion:1,combatId:'combat',turnKey:'2:summon:extra',sequence:4,
      cursor:{tokenId:'summon',slotId:'summon:extra',round:2,initiativeIndex:3}}
    const migrated=migrateMapsState({maps:[{...map,dnd5eActivityTurnClock:clock}],selectedId:map.id})
    expect(migrated.maps[0].dnd5eActivityTurnClock?.cursor).toEqual(clock.cursor)
    expect(normalizeDnd5eActivityTurnClock({...clock,cursor:{...clock.cursor,round:3}})?.cursor).toBeUndefined()
  })
  it('preserves the Host clock when merging player edits', () => {
    const shared = initializeDnd5eActivityTurnClock(map, 'combat', '1:slot-a')
    const local = { ...shared, dnd5eActivityTurnClock: { ...shared.dnd5eActivityTurnClock!, sequence: 999 } }
    expect(mergePlayerTokenCombatFields([local], [shared])[0].dnd5eActivityTurnClock).toEqual(shared.dnd5eActivityTurnClock)
  })
  it('preserves the clock across serialization and does not advance on refresh', () => {
    const initialized = initializeDnd5eActivityTurnClock(map, 'combat', '1:slot-a')
    const restored = migrateMapsState(JSON.parse(JSON.stringify({ maps: [initialized] }))).maps[0]
    expect(restored.dnd5eActivityTurnClock).toEqual(initialized.dnd5eActivityTurnClock)
    expect(initializeDnd5eActivityTurnClock(restored, 'combat', '1:slot-b')).toBe(restored)
  })

  it('advances distinct slots in the same round once and rejects stale transitions', () => {
    const initialized = initializeDnd5eActivityTurnClock(map, 'combat', '1:slot-a')
    const transition = { combatId: 'combat', fromTurnKey: '1:slot-a', toTurnKey: '1:slot-b', expectedSequence: 0 }
    const advanced = advanceDnd5eActivityTurnClock({ map: initialized, ...transition })
    expect(advanced.ok).toBe(true)
    if (!advanced.ok) throw new Error(advanced.reason)
    expect(advanced.clock.sequence).toBe(1)
    const replay = advanceDnd5eActivityTurnClock({ map: advanced.map, ...transition })
    expect(replay).toMatchObject({ ok: true, advanced: false })
    if (replay.ok) expect(replay.map).toBe(advanced.map)
    for (const patch of [{ toTurnKey: '1:slot-c' }, { combatId: 'old-combat' }, { expectedSequence: 2 }]) {
      expect(advanceDnd5eActivityTurnClock({ map: advanced.map, ...transition, ...patch }).ok).toBe(false)
    }
    const next = advanceDnd5eActivityTurnClock({ map: advanced.map, combatId: 'combat',
      fromTurnKey: '1:slot-b', toTurnKey: '1:slot-c', expectedSequence: 1 })
    if (!next.ok) throw new Error(next.reason)
    expect(advanceDnd5eActivityTurnClock({ map: next.map, ...transition }).ok).toBe(false)
  })

  it.each([null, {}, { schemaVersion: 1, combatId: 'combat', turnKey: 'turn', sequence: -1 },
    { schemaVersion: 1, combatId: 'combat', turnKey: 'turn', sequence: 1.5 },
    { schemaVersion: 1, combatId: 'combat', turnKey: 'turn', sequence: 0, previousTurnKey: '' }])(
    'rejects malformed persisted clocks %#', value => expect(normalizeDnd5eActivityTurnClock(value)).toBeUndefined())
})
