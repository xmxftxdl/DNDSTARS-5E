import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { applyDnd5eInventoryMutation, dnd5eInventoryItemTemplate } from './items'
import {
  dnd5eItemAreasEnteredByMove,
  dnd5eMovementPathCells,
  placeDnd5eItemArea,
  previewDnd5eItemAreaPlacement,
} from './itemAreas'

const map: BattleMap = {
  id: 'map', name: '测试', width: 500, height: 500, gridSize: 50,
  gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [], dnd5eItemAreas: [],
}

const token: Token = {
  id: 'token', label: '战士', x: 125, y: 125, color: '#fff', emoji: '⚔️', size: 1,
  type: 'player', characterId: 'character',
}

function character(): Character {
  return {
    id: 'character', name: '战士', player: '玩家', avatar: '⚔️', accent: '#fff',
    rulesetId: 'dnd5e-2014-srd-5.1', charClass: '战士', race: '人类',
    level: 1, background: '士兵', experience: 0, reputation: 0,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }, savingThrows: [], skills: [],
    maxHp: 12, currentHp: 12, tempHp: 0, hitDice: '1d10', ac: 16, speed: 30, initiativeBonus: 0,
    saveDC: 10, passivePerception: 10, inspiration: 0, 
    conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
  }
}

it('预览只允许把区域放在相邻且不与自己重叠的格子', () => {
  const item = dnd5eInventoryItemTemplate('srd-5.1:item:caltrops-bag')!
  expect(previewDnd5eItemAreaPlacement({ map, actorToken: token, targeting: item.use!.targeting!, targetCell: { col: 3, row: 2 } }).valid).toBe(true)
  expect(previewDnd5eItemAreaPlacement({ map, actorToken: token, targeting: item.use!.targeting!, targetCell: { col: 2, row: 2 } }).reason).toBe('area-overlaps-actor')
  expect(previewDnd5eItemAreaPlacement({ map, actorToken: token, targeting: item.use!.targeting!, targetCell: { col: 7, row: 7 } }).reason).toBe('target-out-of-range')
})

it('放置区域原子消耗库存并返回持久实体', () => {
  const granted = applyDnd5eInventoryMutation(
    [character()],
    { type: 'grant', characterId: 'character', templateId: 'srd-5.1:item:caltrops-bag', quantity: 1 },
  )
  const actor = granted.characters[0]
  const entry = actor.dnd5eInventory!.entries[0]
  const result = placeDnd5eItemArea({
    map: { ...map, tokens: [token] }, characters: [actor], actor, actorToken: token, entry,
    targetCell: { col: 3, row: 2 },
    turnEconomy: {
      turnKey: 'combat:1:token', attacksUsed: 0,
      action: { current: 1, max: 1 }, bonusAction: { current: 1, max: 1 },
      reaction: { current: 1, max: 1 }, movement: { current: 30, max: 30 },
    },
    areaId: 'area', createdAt: 1,
  })
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.area).toMatchObject({ id: 'area', kind: 'caltrops', cells: [{ col: 3, row: 2 }] })
  expect(result.characters[0].dnd5eInventory?.entries).toHaveLength(0)
  expect(result.spentEconomy).toBe('action')
})

describe('移动路径触发', () => {
  it('按移动顺序找出经过的持久区域', () => {
    const areaMap: BattleMap = {
      ...map,
      tokens: [{ ...token, x: 25, y: 25 }],
      dnd5eItemAreas: [
        { id: 'a', kind: 'caltrops', sourceCharacterId: 'x', sourceTokenId: 'x', sourceItemTemplateId: 'x', sourceItemName: '铁蒺藜', cells: [{ col: 2, row: 0 }], createdAt: 1, armed: true },
        { id: 'b', kind: 'hunting-trap', sourceCharacterId: 'x', sourceTokenId: 'x', sourceItemTemplateId: 'x', sourceItemName: '捕猎陷阱', cells: [{ col: 4, row: 0 }], createdAt: 1, armed: true },
      ],
    }
    const moving = areaMap.tokens[0]
    expect(dnd5eMovementPathCells({ col: 0, row: 0 }, { col: 5, row: 0 })).toHaveLength(6)
    expect(dnd5eItemAreasEnteredByMove({ map: areaMap, token: moving, to: { x: 275, y: 25 } }).map((entry) => entry.area.id)).toEqual(['a', 'b'])
  })
})
