import { describe, expect, it } from 'vitest'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { removePersistentAreaByDm, removeWallOfFireByDm, resolvePersistentAreaEntityAttackByDm } from './dmWallOfFireRemoval'

describe('DM Wall of Fire removal', () => {
  it('ejects an occupant from Passwall before the DM closes the passage', () => {
    const map = {
      id: 'map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [{
        id: 'occupant', label: 'Occupant', type: 'player', x: 125, y: 125,
        size: 1, color: '#fff', emoji: 'O',
      }],
      dnd5ePluginAreas: [{
        id: 'passwall', pluginId: 'srd-5.1', featureId: 'spell:passwall',
        sourceKind: 'core-spell', coreSpellId: 'passwall', label: '穿墙术', color: '#a78bfa',
        sourceCharacterId: 'caster', sourceTokenId: 'caster-token',
        cells: [{ col: 2, row: 1 }, { col: 2, row: 2 }, { col: 2, row: 3 }],
        vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 8 },
        blocking: { suppressesMappedBarriers: true },
        createdRound: 1, expiresAfterRound: 600,
      }],
    } as BattleMap

    const result = removePersistentAreaByDm({ map, characters: [], areaId: 'passwall' })

    expect(result?.map.dnd5ePluginAreas).toEqual([])
    expect(result?.map.tokens[0]).toMatchObject({ id: 'occupant', x: 75, y: 75 })
  })

  it('uses entity AC before damage and removes a spell entity at 0 HP', () => {
    const map = {
      id: 'map',
      tokens: [
        { id: 'caster-token', label: 'Caster', type: 'player', x: 0, y: 0, size: 1 },
        { id: 'servant-token', label: 'Servant', type: 'obstacle', x: 50, y: 50, size: 1, dnd5eSpellEffect: {
          schemaVersion: 1, spellId: 'unseen-servant', sourceCharacterId: 'caster',
          sourceTokenId: 'caster-token', createdRound: 1, expiresAfterRound: 600,
        } },
      ],
      dnd5ePluginAreas: [{
        id: 'servant', pluginId: 'srd-5.1', featureId: 'spell:unseen-servant',
        sourceKind: 'core-spell', coreSpellId: 'unseen-servant', label: '隐形仆役', color: '#94a3b8',
        sourceCharacterId: 'caster', sourceTokenId: 'caster-token', anchorMode: 'effect-token',
        anchorTokenId: 'servant-token', cells: [{ col: 1, row: 1 }], createdRound: 1, expiresAfterRound: 600,
        entityProfile: { armorClass: 10, hitPoints: 1, strength: 2, cannotAttack: true, invisible: true },
        entityCurrentHitPoints: 1,
      }],
    } as BattleMap

    const missed = resolvePersistentAreaEntityAttackByDm({
      map, characters: [], areaId: 'servant', attackTotal: 9, damage: 1,
    })
    expect(missed).toMatchObject({ outcome: 'miss', armorClass: 10, hitPointsBefore: 1, hitPointsAfter: 1 })
    expect(missed?.map).toBe(map)

    const destroyed = resolvePersistentAreaEntityAttackByDm({
      map, characters: [], areaId: 'servant', attackTotal: 10, damage: 1,
    })
    expect(destroyed).toMatchObject({ outcome: 'destroyed', damage: 1, hitPointsBefore: 1, hitPointsAfter: 0 })
    expect(destroyed?.map.dnd5ePluginAreas).toEqual([])
    expect(destroyed?.map.tokens.map((token) => token.id)).toEqual(['caster-token'])
  })

  it('removes only the selected wall and ends its matching source concentration', () => {
    const character = {
      id: 'caster', name: 'Caster', concentrating: true,
      dnd5eCombatState: { concentrationSpellId: 'wall-of-fire', concentrationSpellLevel: 4, concentrationRoundsRemaining: 10 },
    } as Character
    const map = {
      id: 'map', tokens: [{ id: 'caster-token', characterId: 'caster', label: 'Caster', type: 'player', x: 0, y: 0, size: 1 }],
      dnd5ePluginAreas: [{ id: 'wall', pluginId: 'srd-5.1', featureId: 'wall', sourceKind: 'core-spell', coreSpellId: 'wall-of-fire', label: '火墙术', color: '#ff0000', sourceCharacterId: 'caster', sourceTokenId: 'caster-token', cells: [{ col: 1, row: 1 }], createdRound: 1, expiresAfterRound: 10 }],
    } as BattleMap
    const result = removeWallOfFireByDm({ map, characters: [character], areaId: 'wall' })
    expect(result?.map.dnd5ePluginAreas).toEqual([])
    expect(result?.character?.concentrating).toBe(false)
    expect(result?.character?.dnd5eCombatState?.concentrationSpellId).toBeUndefined()
  })

  it('does not end a newer concentration spell or delete non-wall areas', () => {
    const character = { id: 'caster', concentrating: true, dnd5eCombatState: { concentrationSpellId: 'bless' } } as Character
    const map = { id: 'map', tokens: [], dnd5ePluginAreas: [] } as unknown as BattleMap
    expect(removeWallOfFireByDm({ map, characters: [character], areaId: 'missing' })).toBeUndefined()
  })

  it('lets the DM remove Darkness while preserving a newer concentration', () => {
    const character = {
      id: 'caster', name: 'Caster', concentrating: true,
      dnd5eCombatState: { concentrationSpellId: 'fly', concentrationSpellLevel: 3 },
    } as Character
    const map = {
      id: 'map',
      tokens: [{ id: 'caster-token', characterId: 'caster', label: 'Caster', type: 'player', x: 0, y: 0, size: 1 }],
      dnd5ePluginAreas: [{
        id: 'darkness', pluginId: 'srd-5.1', featureId: 'darkness', sourceKind: 'core-spell',
        coreSpellId: 'darkness', concentrationId: 'darkness', label: '黑暗术', color: '#581c87',
        sourceCharacterId: 'caster', sourceTokenId: 'caster-token', cells: [{ col: 1, row: 1 }],
        createdRound: 1, expiresAfterRound: 10,
      }],
    } as BattleMap

    const result = removePersistentAreaByDm({ map, characters: [character], areaId: 'darkness' })

    expect(result?.map.dnd5ePluginAreas).toEqual([])
    expect(result?.character).toBe(character)
    expect(result?.concentrationEnded).toBe(false)
  })

  it('removes round-based child effects linked to the deleted concentration controller', () => {
    const source = {
      kind: 'spell', actorId: 'caster-token', actorName: 'Caster', rulesId: 'mislead',
      pluginId: 'srd-5.1', spellLevel: 5, spellSaveDc: 17, magical: true,
    } as const
    const character = {
      id: 'caster', name: 'Caster', concentrating: true, conditions: ['invisible'],
      dnd5eCombatState: {
        schemaVersion: 2,
        concentrationSpellId: 'mislead',
        concentrationSpellLevel: 5,
        concentrationRoundsRemaining: 600,
        activeEffects: [{
          schemaVersion: 1, id: 'mislead-controller',
          definitionId: 'activity:mislead:mislead-controller:modifiers:0',
          label: '假象术·投影控制', kind: 'debuff', source,
          appliedAt: 1,
          duration: { type: 'concentration', sourceActorId: 'caster-token', remainingRounds: 600 },
          stackingKey: 'mislead-controller:caster-token', stackingPolicy: 'replace', visibility: 'public',
        }, {
          schemaVersion: 1, id: 'mislead-invisible', definitionId: 'condition:invisible',
          label: '隐形', kind: 'condition', standardCondition: 'invisible', source,
          appliedAt: 1,
          duration: { type: 'rounds', remainingRounds: 600, tickOn: 'source-turn-end' },
          removal: { sourceLink: { sourceRequiresEffect: 'mislead-controller' } },
          stackingKey: 'activity:mislead:mislead-invisible:condition:invisible:caster-token',
          stackingPolicy: 'refresh-duration', visibility: 'public',
        }, {
          schemaVersion: 1, id: 'unrelated', definitionId: 'condition:prone',
          label: '倒地', kind: 'condition', standardCondition: 'prone',
          source: { kind: 'system', rulesId: 'prone' }, appliedAt: 1,
          duration: { type: 'permanent' }, stackingKey: 'condition:prone',
          stackingPolicy: 'replace', visibility: 'public',
        }],
      },
    } as unknown as Character
    const map = {
      id: 'map',
      tokens: [{ id: 'caster-token', characterId: 'caster', label: 'Caster', type: 'player', x: 0, y: 0, size: 1 }],
      dnd5ePluginAreas: [{
        id: 'mislead-area', pluginId: 'srd-5.1', featureId: 'spell:mislead',
        sourceKind: 'core-spell', coreSpellId: 'mislead', concentrationId: 'mislead',
        label: '假象术', color: '#a78bfa', sourceCharacterId: 'caster', sourceTokenId: 'caster-token',
        cells: [{ col: 1, row: 1 }], createdRound: 1, expiresAfterRound: 601,
      }],
    } as BattleMap

    const result = removePersistentAreaByDm({ map, characters: [character], areaId: 'mislead-area' })

    expect(result?.character?.dnd5eCombatState?.activeEffects?.map((effect) => effect.id)).toEqual(['unrelated'])
    expect(result?.character?.conditions).toEqual(['prone'])
    expect(result?.character?.dnd5eCombatState?.concentrationSpellId).toBeUndefined()
  })

  it('removes an effect-token anchor and all of its attached persistent areas', () => {
    const map = {
      id: 'map',
      tokens: [
        { id: 'caster-token', label: 'Caster', type: 'enemy', x: 0, y: 0, size: 1 },
        { id: 'effect-token', label: 'Effect', type: 'obstacle', x: 50, y: 50, size: 1, dnd5eSpellEffect: {
          schemaVersion: 1, spellId: 'flaming-sphere', sourceCharacterId: 'monster',
          sourceTokenId: 'caster-token', createdRound: 1, expiresAfterRound: 10,
          concentrationId: 'flaming-sphere',
        } },
      ],
      dnd5ePluginAreas: ['a', 'b'].map((id) => ({
        id, pluginId: 'srd-5.1', featureId: 'sphere', sourceKind: 'core-spell' as const,
        coreSpellId: 'flaming-sphere', concentrationId: 'flaming-sphere', label: '炽焰法球',
        color: '#f97316', sourceCharacterId: 'monster', sourceTokenId: 'caster-token',
        anchorMode: 'effect-token' as const, anchorTokenId: 'effect-token',
        cells: [{ col: 1, row: 1 }], createdRound: 1, expiresAfterRound: 10,
      })),
    } as BattleMap

    const result = removePersistentAreaByDm({ map, characters: [], areaId: 'a' })

    expect(result?.map.dnd5ePluginAreas).toEqual([])
    expect(result?.map.tokens.map((token) => token.id)).toEqual(['caster-token'])
  })
})
