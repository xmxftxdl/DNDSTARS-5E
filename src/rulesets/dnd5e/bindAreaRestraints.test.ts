import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import type { BattleMap, Dnd5ePluginArea } from '../../store/maps'
import { createDnd5eConditionEffect } from './activeEffects'
import { bindDnd5eAreaRestraints } from './bindAreaRestraints'
import { resolvePersistentAreaEntityAttackByDm } from './persistentAreaRemoval'

it.each(['column-1', 'activity-area:map:player-action:' + 'a'.repeat(140) + ':pillars'])('binds and persists a player restraint to its own pillar without capturing another spell: %s', areaId => {
  const effect = (id: string, rulesId = 'test:pillar') => ({ ...createDnd5eConditionEffect({ id, condition: 'restrained',
    targetId: 'player', source: { kind: 'spell', actorId: 'caster', rulesId }, duration: { type: 'permanent' } }),
    definitionId: `activity:${rulesId}:pinned` })
  const character = normalizeCharacter({ id: 'hero', name: 'Hero', currentHp: 20, maxHp: 20,
    dnd5eCombatState: { activeEffects: [effect('own'), effect('unrelated', 'test:other')] } })
  const area: Dnd5ePluginArea = { id: areaId, pluginId: 'test', featureId: 'pillar', sourceTokenId: 'caster',
    sourceCharacterId: '', label: 'Pillar', color: '#888', createdRound: 1, expiresAfterRound: 1, permanent: true,
    cells: [{ col: 2, row: 2 }], entityProfile: { armorClass: 5, hitPoints: 30, cannotAttack: true, invisible: false } }
  const map: BattleMap = { id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true, dnd5ePluginAreas: [area], tokens: [
      { id: 'player', characterId: character.id, type: 'player', label: 'Hero', x: 125, y: 125, size: 1, emoji: '', color: '' }] }
  const before = structuredClone({ map, character })
  const bound = bindDnd5eAreaRestraints({ map, characters: [character], area, effectIds: ['pinned'] })
  expect(bound.changedCharacterIds).toEqual(['hero'])
  expect(bound.characters[0].dnd5eCombatState?.activeEffects?.map(e => e.areaLifetime?.areaId)).toEqual([areaId, undefined])
  expect(bound.map.tokens[0].dnd5eCombatState?.activeEffects).toEqual(bound.characters[0].dnd5eCombatState?.activeEffects)
  expect({ map, character }).toEqual(before)
  const reloaded = JSON.parse(JSON.stringify(bound))
  reloaded.characters = reloaded.characters.map(normalizeCharacter)
  const destroyed = resolvePersistentAreaEntityAttackByDm({ map: reloaded.map, characters: reloaded.characters,
    areaId: area.id, attackTotal: 5, damage: 30 })!
  expect(destroyed.characters?.[0].dnd5eCombatState?.activeEffects?.map(e => e.id)).toEqual(['unrelated'])
  const elsewhere = bindDnd5eAreaRestraints({ map, characters: [character], area: { ...area, cells: [{ col: 3, row: 2 }] }, effectIds: ['pinned'] })
  expect(elsewhere.changedTokenIds).toEqual([])
})
