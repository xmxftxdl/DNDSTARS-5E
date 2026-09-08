import { describe, expect, it } from 'vitest'
import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { validateAndMigrateSharedResource } from '../../lib/sharedResourceValidation'
import {
  DND5E_ACTIVE_EFFECT_SCHEMA_VERSION,
  DND5E_COMBAT_STATE_SCHEMA_VERSION,
  type Dnd5eActiveEffectInstance,
} from './activeEffects'
import {
  expireDnd5eWebAreaAtTurnBoundary,
  igniteDnd5eWebAreaCell,
  setDnd5eWebAreaUnsupported,
} from './webAreaRules'

function webEffect(targetId: string): Dnd5eActiveEffectInstance {
  return {
    schemaVersion: DND5E_ACTIVE_EFFECT_SCHEMA_VERSION,
    id: `web-${targetId}`,
    definitionId: 'srd-5.1:spell:web:restrained',
    label: '蛛网术束缚',
    kind: 'condition',
    standardCondition: 'restrained',
    source: { kind: 'spell', actorId: 'caster', characterId: 'wizard', rulesId: 'web', magical: true },
    appliedAt: 1,
    duration: { type: 'concentration', sourceActorId: 'caster', concentrationId: 'web', remainingRounds: 600 },
    stackingKey: `web:${targetId}`,
    stackingPolicy: 'replace',
  }
}

function fixture(): { map: BattleMap; characters: Character[] } {
  const area: Dnd5ePluginArea = {
    id: 'web-area', pluginId: 'srd-5.1', featureId: 'spell:web', sourceKind: 'core-spell', coreSpellId: 'web',
    label: '蛛网术', color: '#ffffff', sourceCharacterId: 'wizard', sourceTokenId: 'caster',
    cells: [{ col: 0, row: 0 }, { col: 1, row: 0 }, { col: 0, row: 1 }, { col: 1, row: 1 }],
    createdRound: 1, expiresAfterRound: 601, concentrationId: 'web', movementCostMultiplier: 2,
  }
  const caster: Token = {
    id: 'caster', characterId: 'wizard', label: '法师', x: 125, y: 125, color: '#ffffff', emoji: '🧙', size: 1, type: 'player',
  }
  const target: Token = {
    id: 'target', label: '强盗', x: 25, y: 25, color: '#ffffff', emoji: '👤', size: 1, type: 'enemy',
    dnd5eCombatState: {
      schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
      activeEffects: [webEffect('target')],
      conditions: ['restrained'],
    },
  }
  const wizard = {
    id: 'wizard', name: '法师', concentrating: true, conditions: [],
    dnd5eCombatState: {
      schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
      concentrationSpellId: 'web', concentrationSpellLevel: 2, concentrationRoundsRemaining: 600,
      activeEffects: [webEffect('caster')],
    },
  } as unknown as Character
  return {
    map: {
      id: 'map', name: 'map', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0,
      showGrid: true, feetPerCell: 5, tokens: [caster, target], dnd5ePluginAreas: [area],
    },
    characters: [wizard],
  }
}

describe('Web persistent-area lifecycle', () => {
  it('persists support state and collapses at the caster next turn start with concentration cleanup', () => {
    const state = fixture()
    const marked = setDnd5eWebAreaUnsupported({ map: state.map, areaId: 'web-area', collapseAtRound: 2 })!
    expect(marked.dnd5ePluginAreas?.[0].webState?.unsupportedCollapseAtRound).toBe(2)

    const before = expireDnd5eWebAreaAtTurnBoundary({
      map: marked, characters: state.characters, timing: 'turn-start', round: 1, tokenId: 'caster',
    })
    expect(before.map.dnd5ePluginAreas).toHaveLength(1)

    const collapsed = expireDnd5eWebAreaAtTurnBoundary({
      map: marked, characters: state.characters, timing: 'turn-start', round: 2, tokenId: 'caster',
    })
    expect(collapsed.map.dnd5ePluginAreas).toEqual([])
    expect(collapsed.map.tokens.find((token) => token.id === 'target')?.dnd5eCombatState?.activeEffects).toBeUndefined()
    expect(collapsed.characters[0].concentrating).toBe(false)
    expect(collapsed.characters[0].dnd5eCombatState?.concentrationSpellId).toBeUndefined()
  })

  it('adds a 2d4 fire turn-start trigger and burns only the ignited cube after one round', () => {
    const state = fixture()
    const ignited = igniteDnd5eWebAreaCell({
      map: state.map, areaId: 'web-area', cell: { col: 0, row: 0 }, round: 1, turnTokenId: 'target',
    })!
    const trigger = ignited.dnd5ePluginAreas?.[0].triggers?.find((candidate) => candidate.id === 'web-burning-turn-start')
    expect(trigger?.damage).toEqual({ count: 2, sides: 4, type: 'fire' })
    expect(trigger?.cells).toEqual([{ col: 0, row: 0 }])

    const withReceipt: BattleMap = {
      ...ignited,
      dnd5ePluginAreas: ignited.dnd5ePluginAreas?.map((area) => ({
        ...area,
        triggerReceipts: [{
          triggerId: 'web-burning-turn-start', targetTokenId: 'target', round: 2,
          transactionId: 'burn-trigger', damage: 4,
        }],
      })),
    }
    const burned = expireDnd5eWebAreaAtTurnBoundary({
      map: withReceipt, characters: state.characters, timing: 'turn-start', round: 2, tokenId: 'target',
    })
    expect(burned.map.dnd5ePluginAreas?.[0].cells).toHaveLength(3)
    expect(burned.map.dnd5ePluginAreas?.[0].cells).not.toContainEqual({ col: 0, row: 0 })
    expect(burned.map.dnd5ePluginAreas?.[0].triggers?.some((candidate) => candidate.id === 'web-burning-turn-start') ?? false).toBe(false)
    expect(burned.map.dnd5ePluginAreas?.[0].triggerReceipts).toBeUndefined()
    expect(burned.map.tokens.find((token) => token.id === 'target')?.dnd5eCombatState?.activeEffects).toBeUndefined()
    expect(burned.map.tokens.find((token) => token.id === 'target')?.dnd5eCombatState?.conditions).toBeUndefined()
    expect(validateAndMigrateSharedResource('maps', {
      maps: [burned.map], selectedId: burned.map.id, updatedAt: 2,
    }).status).toBe('valid')
  })
})
