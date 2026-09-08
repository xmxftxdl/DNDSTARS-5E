import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import { createDnd5eMapCombatSnapshot } from './mapBridge'
import { resolveDnd5eHeadlessAction, type Dnd5eAction } from './headlessCombatEngine'
import { dnd5eLegendaryActionWindowCandidates } from './legendaryActionWindow'

// SRD 5.1: https://media.dndbeyond.com/compendium-images/srd/5.1/SRD-OGL_V5.1.pdf
// Shapechanger forbids mist actions; Unarmed Strike requires vampire form.
describe('Vampire form restrictions through production legendary entry points', () => {
  it.each([
    ['vampire-bat', 'legendary-unarmed-strike'],
    ['vampire-mist', 'legendary-unarmed-strike'],
    ['vampire-mist', 'legendary-bite-costs-2-actions'],
    ['vampire-mist', 'move'],
  ])('%s rejects forbidden %s without spending points or changing HP', (slug, actionId) => {
    const actor: Token = { id: 'actor', label: slug, type: 'enemy', poolId: 'srd-5.1:' + slug,
      x: 35, y: 35, size: 1, color: '', emoji: '', hp: 100, maxHp: 100 }
    const target: Token = { ...actor, id: 'target', label: 'target', poolId: 'srd-5.1:commoner', x: 105 }
    const map: BattleMap = { id: 'forms', name: 'forms', width: 700, height: 700,
      gridSize: 70, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [actor, target] }
    const initiativeOrder = [target, actor].map((token, index) => ({ tokenId: token.id,
      slotId: token.id, label: token.label, emoji: '', color: '', roll: 20 - index * 10 }))
    const { state } = createDnd5eMapCombatSnapshot({ combatId: 'forms', map, characters: [], initiativeOrder })
    const command: Dnd5eAction = actionId === 'move'
      ? { type: 'monster-legendary-special-action', actorId: 'actor', actionId }
      : { type: 'monster-legendary-action', actorId: 'actor', actionId,
          rolls: [{ targetId: 'target', d20: 20, damageRolls: [[1, 1], [1, 1, 1, 1, 1, 1]] }] }
    const result = resolveDnd5eHeadlessAction(state, command)
    expect(result.ok).toBe(false)
    expect(result.state.combatants).toEqual(state.combatants)
    const candidates = dnd5eLegendaryActionWindowCandidates({ map, endingTokenId: 'target' })
    if (slug === 'vampire-mist') expect(candidates).toEqual([])
    else expect(candidates[0].actions.map(action => action.id))
      .toEqual(['move', 'legendary-bite-costs-2-actions'])
  })
})
