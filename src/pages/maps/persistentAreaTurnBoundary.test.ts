import { describe, expect, it } from 'vitest'
import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import { cellsForAoe } from '../../lib/skillTargeting'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  createDnd5eCoreSpellArea,
  getDnd5eCoreSpellAreaDeclaration,
} from '../../rulesets/dnd5e/coreSpellAreas'
import {
  collectDnd5ePersistentAreaTriggers,
  expireDnd5ePluginAreasAtTurnBoundary,
  reconcileDnd5ePluginAreasOnMap,
} from '../../rulesets/dnd5e/pluginAreas'
import {
  prepareDnd5ePersistentAreaTrigger,
  resolvePreparedDnd5ePersistentAreaTrigger,
} from '../../rulesets/dnd5e/pluginAreaTransactions'
import {
  commitDnd5ePersistentAreaTurnCursorAfterSuccess,
  dnd5ePersistentAreaTurnCursor,
  mergeDnd5ePersistentAreaTurnCharacterDelta,
  mergeDnd5ePersistentAreaTurnMapDelta,
  planDnd5ePersistentAreaTurnTransition,
  settleDnd5ePersistentAreaTurnTransition,
  type Dnd5ePersistentAreaTurnTransition,
} from './persistentAreaTurnBoundary'

function character(id: string, patch: Partial<Character> = {}): Character {
  return {
    id,
    name: id,
    player: '',
    avatar: '',
    accent: '',
    race: 'Human',
    charClass: 'Wizard',
    level: 5,
    background: '',
    experience: 0,
    reputation: 0,
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
    savingThrows: [],
    skills: [],
    maxHp: 100,
    currentHp: 100,
    tempHp: 0,
    hitDice: '5d6',
    ac: 10,
    speed: 30,
    initiativeBonus: 0,
    saveDC: 16,
    passivePerception: 10,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    ...patch,
  }
}

function token(id: string, patch: Partial<Token> = {}): Token {
  return {
    id,
    label: id,
    x: 25,
    y: 25,
    color: '#fff',
    emoji: '',
    size: 1,
    type: 'player',
    hp: 100,
    maxHp: 100,
    ...patch,
  }
}

function entry(tokenId: string, slotId = `${tokenId}-slot`): InitiativeEntry {
  return { tokenId, slotId, label: tokenId, emoji: '', color: '#fff', roll: 10 }
}

describe('persistent-area authoritative turn boundaries', () => {
  it('plans one stable end/start pair and treats a repeated ACK cursor as a no-op', () => {
    const initiativeOrder = [entry('hero', 'hero-primary'), entry('monster', 'monster-primary')]
    const previous = dnd5ePersistentAreaTurnCursor({
      mapId: 'map', combatId: 'combat', round: 4, initiativeIndex: 0, initiativeOrder,
    })!
    const current = dnd5ePersistentAreaTurnCursor({
      mapId: 'map', combatId: 'combat', round: 4, initiativeIndex: 1, initiativeOrder,
    })!

    expect(planDnd5ePersistentAreaTurnTransition(previous, current)).toEqual({
      cursor: current,
      boundaries: [
        { timing: 'turn-end', round: 4, tokenId: 'hero', turnKey: '4:hero-primary' },
        { timing: 'turn-start', round: 4, tokenId: 'monster', turnKey: '4:monster-primary' },
      ],
    })
    expect(planDnd5ePersistentAreaTurnTransition(current, current).boundaries).toEqual([])
  })

  it('does not advance the fallback cursor when authoritative persistence fails', async () => {
    const initiativeOrder = [entry('hero'), entry('monster')]
    const previous = dnd5ePersistentAreaTurnCursor({
      mapId: 'map', combatId: 'combat', round: 1, initiativeIndex: 0, initiativeOrder,
    })!
    const current = dnd5ePersistentAreaTurnCursor({
      mapId: 'map', combatId: 'combat', round: 1, initiativeIndex: 1, initiativeOrder,
    })!
    let committed = previous

    await expect(commitDnd5ePersistentAreaTurnCursorAfterSuccess({
      cursor: current,
      task: async () => { throw new Error('CAS rejected') },
      commit: (cursor) => { committed = cursor },
    })).rejects.toThrow('CAS rejected')
    expect(committed).toBe(previous)

    await commitDnd5ePersistentAreaTurnCursorAfterSuccess({
      cursor: current,
      task: async () => 'saved',
      commit: (cursor) => { committed = cursor },
    })
    expect(committed).toBe(current)
  })

  it('removes a concentration area and its effect Token in the same boundary result', async () => {
    const declaration = getDnd5eCoreSpellAreaDeclaration('flaming-sphere')!
    const sphereToken = token('sphere-token', {
      type: 'obstacle',
      x: 125,
      y: 125,
      dnd5eSpellEffect: {
        schemaVersion: 1,
        spellId: 'flaming-sphere',
        sourceCharacterId: 'caster',
        sourceTokenId: 'caster-token',
        createdRound: 1,
        expiresAfterRound: 11,
        concentrationId: 'flaming-sphere',
      },
    })
    const createdArea = createDnd5eCoreSpellArea({
      declaration,
      actionId: 'sphere-concentration',
      sourceCharacterId: 'caster',
      sourceTokenId: 'caster-token',
      anchorTokenId: sphereToken.id,
      slotLevel: 2,
      sourceSaveDc: 16,
      round: 1,
      cells: [{ col: 2, row: 2 }],
      anchorCell: { col: 2, row: 2 },
      baseElevationFeet: 0,
    })
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [token('caster-token', { characterId: 'caster' }), sphereToken],
      dnd5ePluginAreas: [createdArea],
    }
    const concentratingCaster = character('caster', {
      concentrating: true,
      dnd5eCombatState: { concentrationSpellId: 'flaming-sphere' },
    })
    const failedCaster = character('caster', {
      concentrating: false,
      dnd5eCombatState: {},
    })
    const cursor = dnd5ePersistentAreaTurnCursor({
      mapId: map.id,
      combatId: 'combat',
      round: 1,
      initiativeIndex: 0,
      initiativeOrder: [entry('caster-token')],
    })!
    const settled = await settleDnd5ePersistentAreaTurnTransition({
      transition: {
        cursor,
        boundaries: [{
          timing: 'turn-end', round: 1, tokenId: 'caster-token', turnKey: '1:caster-token-slot',
        }],
      },
      map,
      characters: [concentratingCaster],
      // This is the state returned after boundary damage failed its
      // concentration check in settleDnd5eConcentrationChecks.
      settleBoundary: async ({ map: boundaryMap }) => ({
        map: boundaryMap,
        characters: [failedCaster],
        logs: [],
      }),
      expireBoundary: ({ boundary, map: boundaryMap, characters }) =>
        reconcileDnd5ePluginAreasOnMap(
          expireDnd5ePluginAreasAtTurnBoundary({
            map: boundaryMap,
            timing: boundary.timing,
            round: boundary.round,
            tokenId: boundary.tokenId,
          }),
          characters,
          boundary.round,
        ),
    })

    expect(settled.map.dnd5ePluginAreas).toEqual([])
    expect(settled.map.tokens.map((candidate) => candidate.id)).toEqual(['caster-token'])
  })

  it('merges relation changes into the latest map without reverting unrelated DM edits', () => {
    const source = token('source', { hp: 100, x: 25 })
    const effect = token('effect', { type: 'obstacle' })
    const persistentArea = {
      id: 'area', pluginId: 'srd-5.1', featureId: 'spell', label: 'Area', color: '#fff',
      sourceCharacterId: 'caster', sourceTokenId: source.id, cells: [{ col: 0, row: 0 }],
      createdRound: 1, expiresAfterRound: 10,
    }
    const before: BattleMap = {
      id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
      tokens: [source, effect], dnd5ePluginAreas: [persistentArea],
    }
    const settled: BattleMap = {
      ...before,
      tokens: [{ ...source, hp: 94 }],
      dnd5ePluginAreas: [],
    }
    const concurrent = token('concurrent', { x: 300, y: 300 })
    const current: BattleMap = {
      ...before,
      name: 'DM renamed map',
      tokens: [{ ...source, hp: 80, x: 225, label: 'DM edited' }, effect, concurrent],
    }
    const merged = mergeDnd5ePersistentAreaTurnMapDelta({ before, settled, current })

    expect(merged.name).toBe('DM renamed map')
    expect(merged.tokens.find((candidate) => candidate.id === source.id)).toMatchObject({
      hp: 74, x: 225, label: 'DM edited',
    })
    expect(merged.tokens.some((candidate) => candidate.id === effect.id)).toBe(false)
    expect(merged.tokens.some((candidate) => candidate.id === concurrent.id)).toBe(true)
    expect(merged.dnd5ePluginAreas).toEqual([])
  })

  it('unions concurrent receipts and never moves a Flaming Sphere back to its stale position', () => {
    const receipt = (transactionId: string) => ({
      triggerId: 'flaming-sphere-turn-end',
      targetTokenId: 'target',
      round: 1,
      turnKey: `turn:${transactionId}`,
      transactionId,
    })
    const source = token('source', { characterId: 'caster' })
    const sphere = token('sphere', {
      type: 'obstacle',
      x: 125,
      y: 125,
      dnd5eSpellEffect: {
        schemaVersion: 1,
        spellId: 'flaming-sphere',
        sourceCharacterId: 'caster',
        sourceTokenId: source.id,
        createdRound: 1,
        expiresAfterRound: 11,
        concentrationId: 'flaming-sphere',
      },
    })
    const baseArea = {
      id: 'sphere-area', pluginId: 'srd-5.1', featureId: 'sphere', label: 'Sphere', color: '#f80',
      sourceCharacterId: 'caster', sourceTokenId: source.id,
      sourceKind: 'core-spell' as const, coreSpellId: 'flaming-sphere',
      anchorMode: 'effect-token' as const, anchorTokenId: sphere.id,
      anchorCell: { col: 2, row: 2 }, cells: [{ col: 2, row: 2 }],
      createdRound: 1, expiresAfterRound: 11,
      triggerReceipts: [receipt('base')],
    }
    const before: BattleMap = {
      id: 'sphere-map', name: 'Sphere', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
      tokens: [source, sphere], dnd5ePluginAreas: [baseArea],
    }
    const settled: BattleMap = {
      ...before,
      dnd5ePluginAreas: [{
        ...baseArea,
        triggerReceipts: [receipt('base'), receipt('boundary')],
      }],
    }
    const current: BattleMap = {
      ...before,
      tokens: [source, { ...sphere, x: 325, y: 225 }],
      dnd5ePluginAreas: [{
        ...baseArea,
        anchorCell: { col: 6, row: 4 },
        cells: [{ col: 6, row: 4 }],
        triggerReceipts: [receipt('base'), receipt('concurrent')],
      }],
    }
    const merged = mergeDnd5ePersistentAreaTurnMapDelta({ before, settled, current })

    expect(merged.tokens.find((candidate) => candidate.id === sphere.id)).toMatchObject({
      x: 325, y: 225,
    })
    expect(merged.dnd5ePluginAreas?.[0]).toMatchObject({
      anchorCell: { col: 6, row: 4 },
      cells: [{ col: 6, row: 4 }],
    })
    expect(merged.dnd5ePluginAreas?.[0].triggerReceipts?.map((entry) => entry.transactionId))
      .toEqual(['base', 'concurrent', 'boundary'])
  })

  it('replays character damage while preserving concurrent profile and nested combat edits', () => {
    const before = character('hero', {
      currentHp: 100,
      notes: 'before',
      dnd5eCombatState: { raging: true, rageTurnsRemaining: 10 },
    })
    const settled = character('hero', {
      currentHp: 94,
      notes: 'before',
      dnd5eCombatState: {
        raging: true,
        rageTurnsRemaining: 9,
        turnStartResolvedTurnKey: 'combat:1:hero',
      },
    })
    const current = character('hero', {
      currentHp: 80,
      notes: 'DM concurrent note',
      avatar: 'concurrent-avatar',
      dnd5eCombatState: {
        raging: true,
        rageTurnsRemaining: 8,
        dodgingTurnKey: 'concurrent-dodge',
      },
    })
    const merged = mergeDnd5ePersistentAreaTurnCharacterDelta({
      before: [before], settled: [settled], current: [current],
    })[0]

    expect(merged).toMatchObject({
      currentHp: 74,
      notes: 'DM concurrent note',
      avatar: 'concurrent-avatar',
      dnd5eCombatState: {
        raging: true,
        rageTurnsRemaining: 8,
        turnStartResolvedTurnKey: 'combat:1:hero',
        dodgingTurnKey: 'concurrent-dodge',
      },
    })
  })

  it.each([
    { label: 'player', targetType: 'player' as const, poolOnly: false },
    { label: 'linked enemy', targetType: 'enemy' as const, poolOnly: false },
    { label: 'pool-only monster', targetType: 'enemy' as const, poolOnly: true },
  ])(
    'settles Flaming Sphere inside the $label end-turn path once, including a legacy snapshot',
    async ({ targetType, poolOnly }) => {
      const declaration = getDnd5eCoreSpellAreaDeclaration('flaming-sphere')!
      const anchorCell = { col: 2, row: 2 }
      const createdArea = createDnd5eCoreSpellArea({
        declaration,
        actionId: `sphere-${targetType}`,
        sourceCharacterId: 'caster',
        sourceTokenId: 'caster-token',
        slotLevel: 2,
        sourceSaveDc: 16,
        round: 1,
        cells: cellsForAoe(declaration.template, anchorCell, anchorCell),
        anchorCell,
        baseElevationFeet: 0,
      })
      // Simulate a persisted area created before automatic settlement and
      // per-turn frequency were introduced.
      const legacyArea = {
        ...createdArea,
        triggers: createdArea.triggers?.map((trigger) =>
          trigger.id === 'flaming-sphere-turn-end'
            ? { ...trigger, dmAdjustable: true, oncePerRound: true, oncePerTurn: false }
            : trigger),
      }
      const casterToken = token('caster-token', {
        characterId: 'caster', x: 25, y: 125,
      })
      const targetToken = token('target-token', {
        characterId: poolOnly ? undefined : 'target',
        poolId: poolOnly ? 'srd-5.1:flesh-golem' : undefined,
        type: targetType,
        x: 175,
        y: 125,
        hp: poolOnly ? 93 : 100,
        maxHp: poolOnly ? 93 : 100,
      })
      const nextToken = token('next-token', {
        characterId: 'next', type: targetType === 'player' ? 'enemy' : 'player', x: 425, y: 425,
      })
      const initiativeOrder = [
        entry(targetToken.id, `${targetType}-turn-slot`),
        entry(nextToken.id, 'next-turn-slot'),
        entry(casterToken.id, 'caster-turn-slot'),
      ]
      const map: BattleMap = {
        id: `${targetType}-map`,
        name: `${targetType} map`,
        width: 500,
        height: 500,
        gridSize: 50,
        gridOffsetX: 0,
        gridOffsetY: 0,
        showGrid: true,
        feetPerCell: 5,
        tokens: [casterToken, targetToken, nextToken],
        dnd5ePluginAreas: [legacyArea],
      }
      const characters = [
        character('caster', {
          concentrating: true,
          dnd5eCombatState: {
            concentrationSpellId: 'flaming-sphere',
            concentrationSpellLevel: 2,
          },
        }),
        ...(poolOnly ? [] : [character('target')]),
        character('next'),
      ]
      const previous = dnd5ePersistentAreaTurnCursor({
        mapId: map.id, combatId: 'combat', round: 1, initiativeIndex: 0, initiativeOrder,
      })!
      const current = dnd5ePersistentAreaTurnCursor({
        mapId: map.id, combatId: 'combat', round: 1, initiativeIndex: 1, initiativeOrder,
      })!
      const transition = planDnd5ePersistentAreaTurnTransition(previous, current)

      const settle = (candidateTransition: Dnd5ePersistentAreaTurnTransition, inputMap: BattleMap, inputCharacters: readonly Character[]) =>
        settleDnd5ePersistentAreaTurnTransition({
          transition: candidateTransition,
          map: inputMap,
          characters: inputCharacters,
          settleBoundary: async ({ boundary, map: boundaryMap, characters: boundaryCharacters }) => {
            let nextMap = boundaryMap
            let nextCharacters = [...boundaryCharacters]
            const candidates = collectDnd5ePersistentAreaTriggers({
              map: nextMap,
              timing: boundary.timing,
              round: boundary.round,
              targetTokenId: boundary.tokenId,
              turnKey: boundary.turnKey,
            })
            for (const candidate of candidates) {
              expect(candidate.trigger).toMatchObject({
                id: 'flaming-sphere-turn-end',
                oncePerTurn: true,
                oncePerRound: false,
              })
              expect(candidate.trigger.dmAdjustable).not.toBe(true)
              const prepared = prepareDnd5ePersistentAreaTrigger({
                combatId: 'combat',
                round: boundary.round,
                map: nextMap,
                characters: nextCharacters,
                initiativeOrder,
                candidate,
              })
              expect(prepared.ok).toBe(true)
              if (!prepared.ok) continue
              if (poolOnly) {
                expect(prepared.prepared.save?.mode).toBe('advantage')
                expect(resolvePreparedDnd5ePersistentAreaTrigger({
                  prepared: prepared.prepared,
                  d20: 2,
                  damageRolls: [6, 6],
                }).result).toMatchObject({ ok: false, reason: 'invalid-dice' })
              }
              const resolved = resolvePreparedDnd5ePersistentAreaTrigger({
                prepared: prepared.prepared,
                d20: poolOnly ? 2 : 20,
                d20Second: poolOnly ? 20 : undefined,
                damageRolls: [6, 6],
              })
              expect(resolved.result.ok).toBe(true)
              if (poolOnly) {
                expect(resolved.result.events).toContainEqual(expect.objectContaining({
                  type: 'persistent-area-triggered',
                  triggerId: 'flaming-sphere-turn-end',
                  saveSuccess: true,
                  damage: 6,
                }))
              }
              if (resolved.application) {
                nextMap = resolved.application.map
                nextCharacters = resolved.application.characters
              }
            }
            return { map: nextMap, characters: nextCharacters, logs: [] }
          },
          expireBoundary: ({ boundary, map: boundaryMap }) =>
            expireDnd5ePluginAreasAtTurnBoundary({
              map: boundaryMap,
              timing: boundary.timing,
              round: boundary.round,
              tokenId: boundary.tokenId,
            }),
        })

      const first = await settle(transition, map, characters)
      if (poolOnly) {
        expect(first.map.tokens.find((candidate) => candidate.id === targetToken.id)?.hp).toBe(87)
      } else {
        expect(first.characters.find((candidate) => candidate.id === 'target')?.currentHp).toBe(94)
      }
      expect(first.map.dnd5ePluginAreas?.[0].triggerReceipts).toHaveLength(1)
      expect(first.map.dnd5ePluginAreas?.[0].triggerReceipts?.[0]).toMatchObject({
        targetTokenId: 'target-token',
        turnKey: `1:${targetType}-turn-slot`,
      })

      // A duplicate action retry still carries the same stable turnKey. Even if
      // it reaches settlement again, the persisted receipt prevents double damage.
      const duplicate = await settle(transition, first.map, first.characters)
      if (poolOnly) {
        expect(duplicate.map.tokens.find((candidate) => candidate.id === targetToken.id)?.hp).toBe(87)
      } else {
        expect(duplicate.characters.find((candidate) => candidate.id === 'target')?.currentHp).toBe(94)
      }
      expect(duplicate.map.dnd5ePluginAreas?.[0].triggerReceipts).toHaveLength(1)

      const replayCursor = planDnd5ePersistentAreaTurnTransition(current, current)
      expect(replayCursor.boundaries).toEqual([])
      const replay = await settle(replayCursor, duplicate.map, duplicate.characters)
      if (poolOnly) {
        expect(replay.map.tokens.find((candidate) => candidate.id === targetToken.id)?.hp).toBe(87)
      } else {
        expect(replay.characters.find((candidate) => candidate.id === 'target')?.currentHp).toBe(94)
      }
    },
  )
})
