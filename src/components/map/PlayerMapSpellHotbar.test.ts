import { describe, expect, it } from 'vitest'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { resolvePlayerMapSpellHotbarCharacter } from './playerMapSpellHotbarCharacter'
import { playerMapMovablePersistentAreas, playerMapSustainedAreaControls } from './playerMapPersistentAreas'

const character = {
  id: 'wizard',
  name: 'Wizard',
  classResources: {},
} as Character

describe('playerMapMovablePersistentAreas', () => {
  it('keeps the assigned player character as the spell-bar actor during an enemy turn', () => {
    const wizard = { ...character, id: 'assigned-wizard' }
    const archmage = { ...character, id: 'enemy-archmage' }

    expect(resolvePlayerMapSpellHotbarCharacter({
      playerCharacter: wizard,
      activeCharacter: archmage,
      combatActive: true,
    })).toBe(wizard)
  })

  it('keeps Dancing Lights movable in exploration and migrates a legacy area declaration', () => {
    const map = {
      id: 'map',
      name: 'Map',
      width: 500,
      height: 500,
      gridSize: 50,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      tokens: [],
      dnd5ePluginAreas: [{
        id: 'lights',
        pluginId: 'srd-5.1',
        featureId: 'srd-5.1:spell:dancing-lights',
        sourceKind: 'core-spell',
        coreSpellId: 'dancing-lights',
        label: '舞光术',
        color: '#67e8f9',
        sourceCharacterId: character.id,
        sourceTokenId: 'wizard-token',
        cells: [{ col: 1, row: 1 }],
        createdRound: 1,
        expiresAfterRound: 11,
        anchorMode: 'fixed',
        movement: undefined,
      }],
    } as BattleMap

    expect(playerMapMovablePersistentAreas(map, character)).toEqual([{
      id: 'lights',
      label: '舞光术',
      economy: 'bonus-action',
      maximumFeet: 60,
      coreSpellId: 'dancing-lights',
    }])
  })

  it('projects an existing Major Image as an action reposition within the caster range', () => {
    const map = {
      id: 'map', name: 'Map', width: 1500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [],
      dnd5ePluginAreas: [{
        id: 'major-image', pluginId: 'srd-5.1', featureId: 'srd-5.1:spell:major-image',
        sourceKind: 'core-spell', coreSpellId: 'major-image', label: '高等幻影', color: '#8b5cf6',
        sourceCharacterId: character.id, sourceTokenId: 'wizard-token',
        cells: [{ col: 1, row: 1 }], anchorCell: { col: 1, row: 1 },
        createdRound: 1, expiresAfterRound: 101, anchorMode: 'fixed',
        movement: { economy: 'action', maximumFeet: 240, maximumDistanceFromSourceFeet: 120 },
      }],
    } as BattleMap

    expect(playerMapMovablePersistentAreas(map, character)).toEqual([{
      id: 'major-image', label: '高等幻影', economy: 'action', maximumFeet: 240,
      destinationRangeFeet: 120, coreSpellId: 'major-image',
    }])
  })

  it('projects repeat attacks only from authoritative persistent spell entities', () => {
    const cleric = {
      ...character,
      id: 'cleric',
      charClass: '牧师',
      dnd5eClassLevels: { cleric: 5 },
      dnd5eClassChoices: {
        classes: { cleric: { selections: { 'spell-prepared': ['spiritual-weapon'] } } },
      },
    } as Character
    const map = {
      id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [],
      dnd5ePluginAreas: [{
        id: 'weapon', pluginId: 'srd-5.1', featureId: 'srd-5.1:spell:spiritual-weapon',
        sourceKind: 'core-spell', coreSpellId: 'spiritual-weapon', castingClassId: 'cleric',
        slotLevel: 4, label: '灵体武器', color: '#c4b5fd', sourceCharacterId: cleric.id,
        sourceTokenId: 'cleric-token', cells: [{ col: 1, row: 1 }], createdRound: 1,
        expiresAfterRound: 11, anchorMode: 'effect-token', anchorCell: { col: 1, row: 1 },
      }, {
        id: 'other-caster-cloud', pluginId: 'srd-5.1', featureId: 'srd-5.1:spell:call-lightning',
        sourceKind: 'core-spell', coreSpellId: 'call-lightning', castingClassId: 'druid',
        slotLevel: 3, label: '召雷术·雷云', color: '#60a5fa', sourceCharacterId: 'other',
        sourceTokenId: 'other-token', cells: [{ col: 2, row: 2 }], createdRound: 1,
        expiresAfterRound: 101,
      }],
    } as BattleMap

    expect(playerMapSustainedAreaControls(map, cleric)).toEqual([{
      areaId: 'weapon',
      spellId: 'spiritual-weapon',
      castingClassId: 'cleric',
      slotLevel: 4,
      controlId: 'spiritual-weapon',
      label: '移动并攻击：灵体武器',
      economy: 'bonus-action',
      targeting: 'creature',
    }])
    expect(playerMapSustainedAreaControls({ ...map, dnd5ePluginAreas: [] }, cleric)).toEqual([])
  })
})
