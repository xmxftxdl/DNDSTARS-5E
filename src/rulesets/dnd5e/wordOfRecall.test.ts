import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  designateDnd5eWordOfRecallSanctuary,
  dnd5eWordOfRecallSanctuary,
  normalizeDnd5eWordOfRecallDeclarationV1,
  normalizeDnd5eWordOfRecallResolutionV1,
  settleDnd5eWordOfRecallTeleport,
} from './wordOfRecall'

const token = (id: string, patch: Partial<Token> = {}): Token => ({
  id,
  label: id,
  x: 150,
  y: 150,
  color: '#fff',
  emoji: '🧝',
  size: 1,
  type: 'player',
  ...patch,
})

const map = (id: string, tokens: Token[]): BattleMap => ({
  id,
  name: id,
  width: 1_000,
  height: 1_000,
  gridSize: 50,
  gridOffsetX: 0,
  gridOffsetY: 0,
  showGrid: true,
  tokens,
})

const character = (id: string): Character => ({
  id,
  name: id,
  player: 'player',
  avatar: '🧝',
  accent: 'from-cyan-500',
  race: '人类',
  charClass: '牧师',
  level: 20,
  background: '侍僧',
  experience: 0,
  reputation: 0,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 20, cha: 10 },
  savingThrows: [],
  skills: [],
  maxHp: 100,
  currentHp: 100,
  tempHp: 0,
  hitDice: '20d8',
  ac: 10,
  speed: 30,
  initiativeBonus: 0,
  saveDC: 19,
  inspiration: 0,
  notes: '', dmNotes: '', visibleToPlayers: true,
  passivePerception: 15,
  equipment: {},
  conditions: [],
})

describe('Word of Recall structured authority', () => {
  it('normalizes designation, zero-to-five companions, and Host confirmations', () => {
    expect(normalizeDnd5eWordOfRecallDeclarationV1({
      schemaVersion: 1,
      mode: 'designate-sanctuary',
      sanctuaryName: ' 星辉圣殿主祭坛 ',
      deityConnection: ' 奉献给晨曦之主 ',
    })).toEqual({
      schemaVersion: 1,
      mode: 'designate-sanctuary',
      sanctuaryName: '星辉圣殿主祭坛',
      deityConnection: '奉献给晨曦之主',
    })
    expect(normalizeDnd5eWordOfRecallDeclarationV1({
      schemaVersion: 1,
      mode: 'recall',
      targets: [],
    })).toEqual({ schemaVersion: 1, mode: 'recall', targets: [] })
    expect(normalizeDnd5eWordOfRecallDeclarationV1({
      schemaVersion: 1,
      mode: 'recall',
      targets: Array.from({ length: 6 }, (_, index) => ({ tokenId: `t${index}`, name: `T${index}` })),
    })).toBeUndefined()
    expect(normalizeDnd5eWordOfRecallDeclarationV1({
      schemaVersion: 1,
      mode: 'recall',
      targets: [{ tokenId: 'same', name: 'A' }, { tokenId: 'same', name: 'B' }],
    })).toBeUndefined()
    expect(normalizeDnd5eWordOfRecallResolutionV1({
      schemaVersion: 1,
      sanctuaryConsecratedConfirmed: true,
      willingCreaturesConfirmed: false,
    })).toEqual({
      schemaVersion: 1,
      sanctuaryConsecratedConfirmed: true,
      willingCreaturesConfirmed: false,
    })
  })

  it('stores one authoritative sanctuary per caster, including exact map position and actual slot', () => {
    const cleric = character('cleric')
    const clericToken = token('cleric-token', { characterId: cleric.id, x: 425, y: 575, elevationFeet: 10 })
    const sanctuaryMap = map('temple-map', [clericToken])
    const designated = designateDnd5eWordOfRecallSanctuary({
      character: cleric,
      declaration: {
        schemaVersion: 1,
        mode: 'designate-sanctuary',
        sanctuaryName: '主祭坛',
        deityConnection: '奉献给晨曦之主',
      },
      map: sanctuaryMap,
      actorToken: clericToken,
      sourceActionId: 'cast-1',
      slotLevel: 7,
      createdWorldMinute: 1_234,
    })
    expect(dnd5eWordOfRecallSanctuary(designated)).toMatchObject({
      kind: 'recall-sanctuary',
      sourceActivityId: 'cast-1',
      slotLevel: 7,
      destinationMapId: 'temple-map',
      destinationX: 425,
      destinationY: 575,
      destinationElevationFeet: 10,
    })
  })

  it('moves the caster and willing companions across maps into distinct nearest unoccupied spaces', () => {
    const actor = token('actor', { characterId: 'cleric', label: '牧师' })
    const ally = token('ally', { characterId: 'wizard', label: '法师' })
    const source = map('battle-map', [actor, ally])
    const blockingObject = token('altar-occupant', { type: 'obstacle', x: 425, y: 575 })
    const staleDestinationActor = token('old-actor-token', { characterId: 'cleric', x: 50, y: 50 })
    const destination = map('temple-map', [blockingObject, staleDestinationActor])
    const result = settleDnd5eWordOfRecallTeleport({
      maps: [source, destination],
      sourceMapId: source.id,
      actorTokenId: actor.id,
      declaration: {
        schemaVersion: 1,
        mode: 'recall',
        targets: [{ tokenId: ally.id, name: ally.label }],
      },
      sanctuary: {
        schemaVersion: 1,
        id: 'recall-sanctuary:cleric',
        kind: 'recall-sanctuary',
        sourceActorId: 'cleric',
        subjectActorId: 'cleric',
        sourceActivityId: 'cast-1',
        createdWorldMinute: 1_234,
        slotLevel: 6,
        sanctuaryName: '主祭坛',
        deityConnection: '奉献给晨曦之主',
        destinationMapId: destination.id,
        destinationMapName: destination.name,
        destinationX: 425,
        destinationY: 575,
        destinationElevationFeet: 10,
      },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.maps.find((entry) => entry.id === source.id)?.tokens).toHaveLength(0)
    const destinationTokens = result.maps.find((entry) => entry.id === destination.id)?.tokens ?? []
    expect(destinationTokens.some((entry) => entry.id === 'old-actor-token')).toBe(false)
    const recalled = destinationTokens.filter((entry) => entry.id === actor.id || entry.id === ally.id)
    expect(recalled).toHaveLength(2)
    expect(new Set(recalled.map((entry) => `${entry.x},${entry.y}`)).size).toBe(2)
    expect(recalled.every((entry) => entry.elevationFeet === 10)).toBe(true)
    expect(recalled.every((entry) => entry.x !== 425 || entry.y !== 575)).toBe(true)
  })
})
