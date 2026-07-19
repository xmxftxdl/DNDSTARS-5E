import { describe, expect, it } from 'vitest'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'
import { prepareDnd5eMapInteraction, resolveDnd5eMapInteraction } from './mapInteraction'

const actor = { id: 'hero', type: 'player', characterId: 'char', x: 50, y: 50, size: 1 } as Token
const map = { id: 'map', width: 500, height: 500, gridSize: 50, feetPerCell: 5, tokens: [actor] } as BattleMap
const geometry = createEmptyMapGeometry(map.id, 1)
geometry.doors.push({
  id: 'door', kind: 'door', label: '石门', points: [{ x: 100, y: 25 }, { x: 100, y: 75 }],
  state: 'locked', secret: true, blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
  baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
  interaction: { lockPickDc: 17, breakDc: 20, secretDc: 14, requiresThievesTools: true },
})

describe('D&D 5e map interaction transaction', () => {
  it('rejects picking a lock without thieves tools and rebuilds the configured DC', () => {
    expect(prepareDnd5eMapInteraction({
      map, geometry, actor, payload: { doorId: 'door', operation: 'unlock', method: 'thieves-tools' },
    })).toEqual({ ok: false, reason: 'thieves-tools-required' })
    const prepared = prepareDnd5eMapInteraction({
      map, geometry, actor, hasThievesTools: true,
      payload: { doorId: 'door', operation: 'unlock', method: 'thieves-tools' },
    })
    expect(prepared.ok && prepared.prepared.dc).toBe(17)
  })

  it('supports DM DC adjustment without trusting a player supplied total', () => {
    const prepared = prepareDnd5eMapInteraction({
      map, geometry, actor,
      payload: { doorId: 'door', operation: 'break', method: 'force' },
    })
    if (!prepared.ok) throw new Error(prepared.reason)
    expect(prepared.prepared.turnCost).toBe('action')
    expect(resolveDnd5eMapInteraction({ prepared: prepared.prepared, d20: 14, modifier: 3 }).success).toBe(false)
    expect(resolveDnd5eMapInteraction({ prepared: prepared.prepared, d20: 14, modifier: 3, adjustedDc: 15 })).toMatchObject({
      success: true, total: 17, dc: 15, nextDoorState: 'open',
    })
  })

  it('uses the free object interaction for opening and closing an unlocked door', () => {
    const unlocked = structuredClone(geometry)
    unlocked.doors[0].state = 'closed'
    const prepared = prepareDnd5eMapInteraction({
      map, geometry: unlocked, actor, payload: { doorId: 'door', operation: 'open' },
    })
    expect(prepared).toMatchObject({
      ok: true,
      prepared: { spendAction: false, turnCost: 'object-interaction', automaticSuccess: true },
    })
  })

  it('reveals a secret door only after a successful authority check', () => {
    const prepared = prepareDnd5eMapInteraction({
      map, geometry, actor,
      payload: { doorId: 'door', operation: 'inspect', method: 'investigation' },
    })
    if (!prepared.ok) throw new Error(prepared.reason)
    expect(resolveDnd5eMapInteraction({ prepared: prepared.prepared, d20: 9, modifier: 4 }).revealSecret).toBe(false)
    expect(resolveDnd5eMapInteraction({ prepared: prepared.prepared, d20: 10, modifier: 4 }).revealSecret).toBe(true)
  })

  it('resolves a blind area search on the authority geometry without a player supplied door id', () => {
    const prepared = prepareDnd5eMapInteraction({
      map, geometry, actor,
      payload: { operation: 'search', point: { x: 100, y: 50 }, method: 'perception' },
    })
    expect(prepared).toMatchObject({
      ok: true,
      prepared: {
        door: { id: 'door' },
        blindSearch: true,
        operation: 'search',
        checkSkill: 'perception',
        turnCost: 'action',
      },
    })
  })

  it('returns an indistinguishable check when a blind search contains no secret door', () => {
    const prepared = prepareDnd5eMapInteraction({
      map, geometry, actor,
      payload: { operation: 'search', point: { x: 50, y: 100 }, method: 'investigation' },
    })
    if (!prepared.ok) throw new Error(prepared.reason)
    expect(prepared.prepared.door).toBeUndefined()
    expect(prepared.prepared.dc).toBe(15)
    expect(resolveDnd5eMapInteraction({ prepared: prepared.prepared, d20: 20, modifier: 5 }).revealSecret).toBe(false)
  })

  it('rejects blind search coordinates outside the actor search reach', () => {
    expect(prepareDnd5eMapInteraction({
      map, geometry, actor,
      payload: { operation: 'search', point: { x: 450, y: 450 }, method: 'perception' },
    })).toEqual({ ok: false, reason: 'search-area-out-of-reach' })
  })
})
