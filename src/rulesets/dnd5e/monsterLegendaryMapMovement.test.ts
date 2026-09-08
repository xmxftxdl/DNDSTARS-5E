import { afterEach, describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import { setMapGeometryRuntime } from '../../lib/mapGeometry'
import { resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from './mapBridge'
import { resolveDnd5eMonsterMapMove } from './monsterMoveAction'

describe('legendary movement survives the production map round trip', () => {
  afterEach(() => setMapGeometryRuntime([]))
  it.each(['vampire-vampire', 'vampire-bat', 'tarrasque'])('%s moves once during the same other-creature turn', slug => {
    const actor: Token = { id: 'actor', label: slug, type: 'enemy', poolId: `srd-5.1:${slug}`,
      x: 45, y: 45, size: 1, color: '', emoji: '', hp: 100, maxHp: 100 }
    const other: Token = { ...actor, id: 'other', label: 'Other', poolId: 'srd-5.1:commoner', x: 155 }
    const map: BattleMap = { id: 'legendary-map', name: 'Legendary map', width: 200, height: 200,
      gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [actor, other] }
    const initiativeOrder = [other, actor].map((token, index) => ({ tokenId: token.id, slotId: token.id,
      label: token.label, emoji: '', color: '', roll: 20 - index * 10 }))
    const combatId = 'legendary-map-combat'
    const snapshot = createDnd5eMapCombatSnapshot({ combatId, map, characters: [], initiativeOrder })
    snapshot.state.combatants.actor.turn.movementRemaining = 0
    const result = resolveDnd5eHeadlessAction(snapshot.state, {
      type: 'monster-legendary-special-action', actorId: actor.id, actionId: 'move',
    })
    expect(result.ok, result.ok ? '' : result.reason).toBe(true)
    const projected = planDnd5eMapResultApplication({ state: result.state, map, characters: [],
      characterIdByCombatantId: snapshot.characterIdByCombatantId, events: [...result.events] })
    expect(projected.map.tokens[0].dnd5eCombatState?.monsterLegendaryMovement).toEqual(
      result.state.combatants.actor.classState.monsterLegendaryMovement)
    const moved = resolveDnd5eMonsterMapMove({ combatId, map: projected.map, characters: [], initiativeOrder,
      actorTokenId: actor.id, to: { x: 65, y: 45 }, traversalMode: slug.startsWith('vampire-') && slug !== 'vampire-vampire' ? 'fly' : 'walk',
      legendaryMovement: { currentInitiativeIndex: 0 } })
    expect(moved.ok, moved.ok ? '' : moved.reason).toBe(true)
    if (!moved.ok) return
    expect(moved.result.ok, moved.result.ok ? '' : moved.result.reason).toBe(true)
    expect(moved.application?.map.tokens[0]).toMatchObject({ x: 65, y: 45 })
    expect(moved.result.state.combatants.actor.classState.monsterLegendaryMovement).toBeUndefined()
    if (!moved.application) return
    const duplicate = resolveDnd5eMonsterMapMove({ combatId, map: moved.application.map, characters: [], initiativeOrder,
      actorTokenId: actor.id, to: { x: 75, y: 45 }, legendaryMovement: { currentInitiativeIndex: 0 } })
    expect(duplicate.ok && duplicate.result.ok).toBe(false)
  })
})
