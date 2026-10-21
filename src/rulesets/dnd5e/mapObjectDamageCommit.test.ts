import { expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import { applyDnd5eCombatResultApplication } from '../../pages/maps/commitDnd5eCombatResult'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from './mapBridge'
import { rebaseDnd5ePluginFeatureApplication } from './pluginFeatureAction'

it.each([40, 26, 0])('persists object HP %s through rebasing and entity commit', hp => {
  const object: Token = { id: 'object', label: 'Object', type: 'obstacle', x: 25, y: 25,
    size: 1, hp: 40, maxHp: 40, color: '', emoji: '',
    dnd5eObjectState: { schemaVersion: 1, combatProfile: { armorClass: 15 } } }
  const map = { id: 'object-map', name: 'Map', width: 500, height: 500, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [object] } as BattleMap
  const snapshot = createDnd5eMapCombatSnapshot({ map, characters: [], initiativeOrder: [],
    combatId: 'object-commit', objectAttackTargetIds: [object.id], geometry: null })
  snapshot.state.combatants[object.id].currentHp = hp
  const application = planDnd5eMapResultApplication({ state: snapshot.state, map,
    characters: [], characterIdByCombatantId: snapshot.characterIdByCombatantId, geometry: null })
  expect(application.changedTokenIds).toEqual(hp === 40 ? [] : [object.id])
  const rebased = rebaseDnd5ePluginFeatureApplication({ baseMap: map, baseCharacters: [],
    application, latestMap: map, latestCharacters: [] })
  expect(rebased.ok).toBe(true)
  if (!rebased.ok) throw new Error(rebased.reason)
  expect(rebased.application.map.tokens[0].hp).toBe(hp)
  let committed = object
  applyDnd5eCombatResultApplication({ application: rebased.application, mapId: map.id,
    applyCharacter: () => { throw new Error('Objects must not patch characters') },
    applyToken: (_mapId, id, token, patch) => {
      expect(id).toBe(object.id)
      expect(patch).toEqual({ hp })
      committed = { ...committed, ...(patch ?? token) }
    } })
  expect(committed.hp).toBe(hp)
  expect(committed.dnd5eCombatState).toBeUndefined()
  expect(committed.dnd5eObjectState).toEqual(object.dnd5eObjectState)
  expect(object.hp).toBe(40)
})
