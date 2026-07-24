import { describe, expect, it } from 'vitest'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'
import { prepareDnd5eMapInteraction, resolveDnd5eMapInteraction } from './mapInteraction'
import type { SceneInteractionPoint } from '../../lib/sceneOrchestration'

const actor = { id: 'hero', type: 'player', characterId: 'char', x: 50, y: 50, size: 1 } as Token
const map = { id: 'map', width: 500, height: 500, gridSize: 50, feetPerCell: 5, tokens: [actor] } as BattleMap
const geometry = createEmptyMapGeometry(map.id, 1)
geometry.doors.push({
  id: 'door', kind: 'door', label: '石门', points: [{ x: 100, y: 25 }, { x: 100, y: 75 }],
  state: 'locked', secret: true, blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
  baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
  interaction: { lockPickDc: 17, breakDc: 20, secretDc: 14, requiresThievesTools: true },
})
const bookshelf: SceneInteractionPoint = {
  id: 'bookshelf',
  name: '旧书柜',
  enabled: true,
  visibleToPlayers: true,
  icon: 'bookshelf',
  x: 50,
  y: 100,
  interactionRadiusFeet: 5,
  prompt: '搜索书柜。',
  repeat: 'per-character',
  check: {
    label: '智力（调查）检定',
    selection: 'skill:investigation',
    dc: 13,
    mode: 'advantage',
  },
  successText: '发现夹层。',
  failureText: '没有发现。',
  rewards: [{ templateId: 'srd-5.1:item:potion-of-healing', quantity: 1, identified: true }],
  successEffects: [],
  failureEffects: [],
}

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

  it('rebuilds a scene point check and reward from the DM-only authority declaration', () => {
    const prepared = prepareDnd5eMapInteraction({
      map,
      actor,
      interactionPoints: [bookshelf],
      payload: { operation: 'interact-point', interactionPointId: bookshelf.id },
    })
    expect(prepared).toMatchObject({
      ok: true,
      prepared: {
        point: { id: bookshelf.id, rewards: bookshelf.rewards },
        interactionId: 'scene-point:bookshelf',
        checkAbility: 'int',
        checkSkill: 'investigation',
        dc: 13,
        rollMode: 'advantage',
        turnCost: 'action',
      },
    })
    if (!prepared.ok) return
    expect(resolveDnd5eMapInteraction({
      prepared: prepared.prepared,
      d20: 10,
      modifier: 3,
    })).toMatchObject({ success: true, total: 13, dc: 13 })
  })

  it('rejects a forged or out-of-reach scene point id before any roll', () => {
    expect(prepareDnd5eMapInteraction({
      map,
      actor,
      interactionPoints: [bookshelf],
      payload: { operation: 'interact-point', interactionPointId: 'forged' },
    })).toEqual({ ok: false, reason: 'interaction-point-not-found' })
    expect(prepareDnd5eMapInteraction({
      map,
      actor,
      interactionPoints: [{ ...bookshelf, x: 450, y: 450 }],
      payload: { operation: 'interact-point', interactionPointId: bookshelf.id },
    })).toEqual({ ok: false, reason: 'interaction-point-out-of-reach' })
  })
})
