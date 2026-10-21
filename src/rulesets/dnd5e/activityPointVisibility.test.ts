import { expect, it } from 'vitest'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'
import { normalizeCharacter } from '../../store/characters'
import { dnd5eActivityPointVisible } from './activityPointVisibility'
import { createDnd5eMechanicalEffect } from './activeEffects'

it('uses linked character senses and occupied-area blindness for Host point visibility', () => {
  const hero = normalizeCharacter({ id: 'hero', name: 'Hero', maxHp: 20, currentHp: 20,
    dnd5eCombatState: { activeEffects: [createDnd5eMechanicalEffect({ id: 'vision', definitionId: 'vision', label: 'Vision',
      source: { kind: 'spell', magical: true }, targetId: 'viewer', duration: { type: 'permanent' }, modifiers: { darkvisionRangeFeet: 10 } })] },
  })
  const viewer: Token = { id: 'viewer', characterId: hero.id, type: 'player', label: '', emoji: '', color: '', size: 1, x: 25, y: 25 }
  const map: BattleMap = { id: 'point-visibility', name: '', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [viewer] }
  const geometry = createEmptyMapGeometry(map.id)
  geometry.vision.ambientLight = 'darkness'
  const point = { x: 125, y: 25, elevationFeet: 0 }
  setMapGeometryRuntime([geometry])
  try {
    expect(dnd5eActivityPointVisible({ map, viewer, characters: [hero], point })).toBe(true)
    expect(dnd5eActivityPointVisible({ map, viewer, characters: [hero], point: { ...point, x: 135 } })).toBe(false)
    const blinded: BattleMap = { ...map, dnd5ePluginAreas: [{ id: 'blind-area', pluginId: 'test', featureId: 'test', label: 'Blind area', color: '', sourceTokenId: 'source', sourceCharacterId: 'source', cells: [{ col: 0, row: 0 }], createdRound: 1, expiresAfterRound: 100, includeSelf: true, relation: 'any', occupantModifiers: { conditions: ['blinded'] } }] }
    expect(dnd5eActivityPointVisible({ map: blinded, viewer, characters: [hero], point })).toBe(false)
    const sensing = { ...viewer, blindsightRangeFeet: 10 }
    expect(dnd5eActivityPointVisible({ map: { ...blinded, tokens: [sensing] }, viewer: sensing, characters: [hero], point })).toBe(true)
    const removed = { ...blinded, dnd5ePluginAreas: [] }
    expect(dnd5eActivityPointVisible({ map: removed, viewer, characters: [hero], point })).toBe(true)
  } finally { setMapGeometryRuntime([]) }
})

it.each(['darkvision', 'truesight'] as const)('suspends %s effects, preserves natural senses and restores after leaving antimagic', sense => {
  const effect = createDnd5eMechanicalEffect({ id: 'vision', definitionId: 'vision', label: 'Vision', source: { kind: 'spell', magical: true }, targetId: 'viewer', duration: { type: 'permanent' }, modifiers: sense === 'darkvision' ? { darkvisionRangeFeet: 10 } : { truesightRangeFeet: 10 } })
  const hero = normalizeCharacter({ id: 'hero', name: 'Hero', maxHp: 20, currentHp: 20, dnd5eCombatState: { activeEffects: [effect] } })
  const viewer: Token = { id: 'viewer', characterId: hero.id, type: 'player', label: '', emoji: '', color: '', size: 1, x: 25, y: 25 }
  const map: BattleMap = { id: 'suppressed-sense', name: '', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [viewer] }
  const geometry = createEmptyMapGeometry(map.id)
  geometry.vision.ambientLight = 'darkness'
  const point = { x: 125, y: 25, elevationFeet: 0 }
  setMapGeometryRuntime([geometry])
  try {
    const before = JSON.stringify({ hero, map })
    expect(dnd5eActivityPointVisible({ map, viewer, characters: [hero], point })).toBe(true)
    const manuallySuspended = { ...hero, dnd5eCombatState: { ...hero.dnd5eCombatState, activeEffects: [{ ...effect, suspendedBy: ['manual'] }] } }
    expect(dnd5eActivityPointVisible({ map, viewer, characters: [manuallySuspended], point })).toBe(false)
    const antimagic: BattleMap = { ...map, dnd5ePluginAreas: [{ id: 'antimagic', pluginId: 'test', featureId: 'test', label: 'Antimagic', color: '', sourceTokenId: 'source', sourceCharacterId: 'source', cells: [{ col: 0, row: 0 }], createdRound: 1, expiresAfterRound: 100, includeSelf: true, relation: 'any', occupantModifiers: { suppressesMagic: true } }] }
    expect(dnd5eActivityPointVisible({ map: antimagic, viewer, characters: [hero], point })).toBe(false)
    const natural = { ...viewer, darkvisionRangeFeet: 10 }
    expect(dnd5eActivityPointVisible({ map: { ...antimagic, tokens: [natural] }, viewer: natural, characters: [hero], point })).toBe(true)
    const nonmagical = { ...hero, dnd5eCombatState: { ...hero.dnd5eCombatState, activeEffects: [{ ...effect, source: { ...effect.source, magical: false } }] } }
    expect(dnd5eActivityPointVisible({ map: antimagic, viewer, characters: [nonmagical], point })).toBe(true)
    expect(dnd5eActivityPointVisible({ map: { ...antimagic, dnd5ePluginAreas: [] }, viewer, characters: [hero], point })).toBe(true)
    expect(JSON.stringify({ hero, map })).toBe(before)
  } finally { setMapGeometryRuntime([]) }
})

it('does not use expired or unsynchronized timed light to see a point', () => {
  const viewer: Token = { id: 'viewer', type: 'player', label: '', emoji: '', color: '', size: 1, x: 25, y: 25,
    lightSource: { enabled: true, brightRadiusFeet: 20, dimRadiusFeet: 0, color: '#fff', expiresAtWorldMinute: 10 } }
  const map: BattleMap = { id: 'timed-point', name: '', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [viewer] }
  const geometry = createEmptyMapGeometry(map.id)
  geometry.vision.ambientLight = 'darkness'
  setMapGeometryRuntime([geometry])
  try {
    const point = { x: 125, y: 25, elevationFeet: 0 }
    expect(dnd5eActivityPointVisible({ map, viewer, point, worldMinute: 9 })).toBe(true)
    expect(dnd5eActivityPointVisible({ map, viewer, point, worldMinute: 10 })).toBe(false)
    expect(dnd5eActivityPointVisible({ map, viewer, point })).toBe(false)
    const permanent = { ...viewer, lightSource: { ...viewer.lightSource!, expiresAtWorldMinute: undefined } }
    expect(dnd5eActivityPointVisible({ map: { ...map, tokens: [permanent] }, viewer: permanent, point })).toBe(true)
  } finally { setMapGeometryRuntime([]) }
})
