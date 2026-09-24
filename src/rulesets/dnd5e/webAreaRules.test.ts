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
  igniteDnd5eWebAreasFromFire,
  igniteDnd5eWebAreasFromSpell,
  reconcileDnd5eWebRestraints,
  reconcileDnd5eWebRestraintsOnMap,
  setDnd5eWebAreaUnsupported,
} from './webAreaRules'
import { collectDnd5ePersistentAreaTriggers, dnd5eFirstAreaMovementCheckpoint, dnd5eFailedAreaMovementCheckpoint } from './pluginAreas'
import { getDnd5eCoreSpellAreaDeclaration } from './coreSpellAreas'
import { dnd5ePersistentAreaDifficultTerrainMultiplierAt } from './persistentAreaGeometry'
import { getDnd5eSrdMonsterBySlug } from './monsters'
import { DND5E_SRD_COMBAT_SPELLS, getDnd5eSrdCombatSpell } from './spells'
import { createDnd5eCombatant, startDnd5eHeadlessCombat } from './headlessCombatEngine'

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
  it.each(DND5E_SRD_COMBAT_SPELLS.filter(spell => spell.area &&
    (spell.damageType === 'fire' || spell.additionalDamageComponents?.some(component => component.damageType === 'fire')))
    .map(spell => [spell.id, spell] as const))('ignites empty web cells for %s', (_id, spell) => {
    const { map } = fixture()
    const result = igniteDnd5eWebAreasFromSpell({ map, spell, cells: [{ col: 1, row: 1 }],
      round: 1, turnTokenId: 'caster' })
    expect(result.dnd5ePluginAreas![0].webState?.burningCells?.map(({ col, row }) => ({ col, row })))
      .toEqual([{ col: 1, row: 1 }])
  })

  it('uses selected fire damage and secondary fire components for empty-cell exposure', () => {
    const { map } = fixture()
    const input = { map, cells: [{ col: 1, row: 1 }], round: 1, turnTokenId: 'caster' }
    const spell = { ...getDnd5eSrdCombatSpell('fireball')!, damageType: 'cold' as const }
    expect(igniteDnd5eWebAreasFromSpell({ ...input, spell })).toBe(map)
    expect(igniteDnd5eWebAreasFromSpell({ ...input, spell, damageType: 'fire' })
      .dnd5ePluginAreas![0].webState?.burningCells).toHaveLength(1)
    expect(igniteDnd5eWebAreasFromSpell({ ...input, spell: { ...spell,
      additionalDamageComponents: [{ damageType: 'fire', dice: { count: 1, sides: 6, bonus: 0 } }] } })
      .dnd5ePluginAreas![0].webState?.burningCells).toHaveLength(1)
  })

  it('limits persistent fire to its trigger cells', () => {
    const { map } = fixture()
    map.dnd5ePluginAreas!.push({ ...map.dnd5ePluginAreas![0], id: 'fire', coreSpellId: 'wall-of-fire',
      triggers: [{ id: 'fire', label: 'fire', timing: 'turn-end', cells: [{ col: 1, row: 0 }],
        damage: { count: 5, sides: 8, type: 'fire' } }] })
    const result = igniteDnd5eWebAreasFromFire({ map, round: 1, turnTokenId: 'caster' })
    expect(result.dnd5ePluginAreas![0].webState?.burningCells?.map(({ col, row }) => ({ col, row })))
      .toEqual([{ col: 1, row: 0 }])
  })

  it('pauses at the first web square and stops only when restraint was actually applied', () => {
    const { map } = fixture()
    const token = { ...map.tokens[1], x: 175, y: 25, dnd5eCombatState: undefined }
    map.tokens = [map.tokens[0], token]
    map.dnd5ePluginAreas![0].triggers = getDnd5eCoreSpellAreaDeclaration('web')!.triggers.map((trigger) => ({
      ...trigger, savingThrow: trigger.savingThrow ? { ...trigger.savingThrow, dc: 14 } : undefined,
      condition: trigger.condition ? { ...trigger.condition,
        escapeCheck: trigger.condition.escapeCheck ? { ...trigger.condition.escapeCheck, dc: 14 } : undefined,
      } : undefined,
    }))
    const candidates = collectDnd5ePersistentAreaTriggers({ map, timing: 'on-enter', round: 1,
      turnKey: 'turn-1', movement: { token, to: { x: -25, y: 25 } } })
    expect(candidates).toHaveLength(1)
    expect(dnd5eFirstAreaMovementCheckpoint({ map, token, candidates })?.position).toEqual({ x: 75, y: 25 })
    const event = { type: 'persistent-area-triggered', areaId: 'web-area', triggerId: 'web-enter',
      targetId: token.id, saveSuccess: false, conditionApplied: 'restrained' }
    expect(dnd5eFailedAreaMovementCheckpoint({ map, token, candidates, events: [event] })?.position)
      .toEqual({ x: 75, y: 25 })
    expect(dnd5eFailedAreaMovementCheckpoint({ map, token, candidates,
      events: [{ ...event, saveSuccess: true, conditionApplied: undefined }] })).toBeUndefined()
    expect(dnd5eFailedAreaMovementCheckpoint({ map, token, candidates,
      events: [{ ...event, conditionApplied: undefined }] })).toBeUndefined()
  })

  it('lets a Web Walker traverse webs while retaining the burning damage trigger', () => {
    const { map } = fixture()
    const spider = { ...map.tokens[1], poolId: getDnd5eSrdMonsterBySlug('giant-spider')!.id }
    map.tokens = [map.tokens[0], spider]
    map.dnd5ePluginAreas![0].triggers = getDnd5eCoreSpellAreaDeclaration('web')!.triggers.map((trigger) => ({
      ...trigger, savingThrow: trigger.savingThrow ? { ...trigger.savingThrow, dc: 14 } : undefined,
      condition: trigger.condition ? { ...trigger.condition,
        escapeCheck: trigger.condition.escapeCheck ? { ...trigger.condition.escapeCheck, dc: 14 } : undefined,
      } : undefined,
    }))
    const burning = igniteDnd5eWebAreaCell({ map, areaId: 'web-area', cell: { col: 0, row: 0 },
      round: 1, turnTokenId: 'caster' })!
    expect(dnd5ePersistentAreaDifficultTerrainMultiplierAt({ map: burning, token: spider, position: spider })).toBe(1)
    const candidates = collectDnd5ePersistentAreaTriggers({ map: burning, timing: 'turn-start',
      targetTokenId: spider.id, round: 1, turnKey: 'spider-1' })
    expect(candidates.map((candidate) => candidate.trigger.id)).toEqual(['web-burning-turn-start'])
  })

  it('ignites empty squares and never postpones burning away through repeated exposure', () => {
    const { map } = fixture()
    const input = { map, cells: [{ col: 1, row: 1 }], round: 1, turnTokenId: 'caster' }
    const burning = igniteDnd5eWebAreasFromSpell({ ...input, spell: getDnd5eSrdCombatSpell('fireball')! })
    expect(burning.dnd5ePluginAreas![0].webState?.burningCells).toHaveLength(1)
    const repeated = igniteDnd5eWebAreasFromFire({ ...input, map: burning, round: 2, turnTokenId: 'target' })
    expect(repeated.dnd5ePluginAreas![0].webState).toEqual(burning.dnd5ePluginAreas![0].webState)
    expect(igniteDnd5eWebAreasFromSpell({ ...input, spell: getDnd5eSrdCombatSpell('lightning-bolt')! }))
      .toBe(map)
  })

  it('does not ignite webs on another vertical level', () => {
    const { map } = fixture()
    map.dnd5ePluginAreas![0].vertical = { mode: 'volume', baseElevationFeet: 100, heightFeet: 20 }
    const result = igniteDnd5eWebAreasFromSpell({ map, spell: getDnd5eSrdCombatSpell('fireball')!,
      cells: [{ col: 0, row: 0 }], elevationFeet: 0, round: 1, turnTokenId: 'caster' })
    expect(result.dnd5ePluginAreas![0].webState).toBeUndefined()
  })

  it('ignites overlapping persistent flames without spreading to adjacent web squares', () => {
    const { map } = fixture()
    map.dnd5ePluginAreas!.push({ ...map.dnd5ePluginAreas![0], id: 'fire-wall', coreSpellId: 'wall-of-fire',
      cells: [{ col: 1, row: 0 }], triggers: [{ id: 'fire', label: 'fire', timing: 'turn-end',
        damage: { count: 5, sides: 8, type: 'fire' } }] })
    const result = igniteDnd5eWebAreasFromFire({ map, round: 1, turnTokenId: 'caster' })
    expect(result.dnd5ePluginAreas![0].webState?.burningCells?.map(({ col, row }) => ({ col, row })))
      .toEqual([{ col: 1, row: 0 }])
  })

  it('clears web restraint after forced movement through and out of the area', () => {
    const { map, characters } = fixture()
    map.tokens[1] = { ...map.tokens[1], x: 225, y: 225 }
    const result = reconcileDnd5eWebRestraintsOnMap(map, characters)
    expect(result.map.tokens[1].dnd5eCombatState?.activeEffects).toBeUndefined()
    expect(result.map.tokens[1].dnd5eCombatState?.conditions).toBeUndefined()
  })

  it('removes only the departed web source and preserves a separate restraint', () => {
    const { map } = fixture()
    const other = { ...webEffect('target'), id: 'other-restraint',
      source: { ...webEffect('target').source, rulesId: 'entangle' } }
    const target = createDnd5eCombatant({ id: 'target', name: 'target', initiative: 1,
      controller: 'dm', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      proficiencyBonus: 2, armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30,
      concentrating: false,
      classState: { activeEffects: [webEffect('target'), other] }, position: { x: 225, y: 225 } })
    const state = startDnd5eHeadlessCombat('web-test', [target])
    reconcileDnd5eWebRestraints(state, map)
    expect(state.combatants.target.classState.activeEffects?.map((effect) => effect.id)).toEqual(['other-restraint'])
    expect(state.combatants.target.conditions).toContain('restrained')
  })

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
