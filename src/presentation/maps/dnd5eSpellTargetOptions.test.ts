import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import {
  dnd5eMapSpellTargetOptions,
  dnd5eSustainedSpellTargetContract,
} from './dnd5eSpellTargetOptions'

const actor = { id: 'cleric', type: 'player', label: 'Cleric' } as Token
const ally = { id: 'wizard', type: 'player', label: 'Wizard' } as Token
const enemy = { id: 'bandit', type: 'enemy', label: 'Bandit' } as Token
const obstacle = { id: 'door', type: 'obstacle', label: 'Door' } as Token
const tokens = [actor, ally, enemy, obstacle]

describe('dnd5eMapSpellTargetOptions', () => {
  it('offers only qualified reachable objects for animation, including the caster’s own carried object', () => {
    const caster: Token = { ...actor, x: 25, y: 25, size: 1 }
    const object: Token = { ...obstacle, x: 75, y: 25, size: 1,
      dnd5eObjectState: { schemaVersion: 1, magical: false, wornOrCarried: false, attached: false,
        animateObjects: { size: 'tiny', mobility: 'walk', damageType: 'bludgeoning' } } }
    const map: BattleMap = { id: 'objects', name: 'Objects', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [] }
    const qualified = { ...object, id: 'held', dnd5eObjectState: { ...object.dnd5eObjectState!, wornOrCarried: true, carrierTokenId: caster.id } }
    const invalid: Token[] = [
      { ...object, id: 'magical', dnd5eObjectState: { ...object.dnd5eObjectState!, magical: true } },
      { ...object, id: 'attached', dnd5eObjectState: { ...object.dnd5eObjectState!, attached: true } },
      { ...qualified, id: 'foreign', dnd5eObjectState: { ...qualified.dnd5eObjectState, carrierTokenId: 'another' } },
      { ...object, id: 'high', elevationFeet: 100 },
      { ...object, id: 'far', x: 425 },
      { ...object, id: 'blocked' },
      { ...object, id: 'unknown', dnd5eObjectState: undefined },
    ]
    const input = { tokens: [caster, object, qualified, ...invalid], actorToken: caster, map,
      contract: { kind: 'object-animation' as const, sizes: ['tiny' as const], rangeFeet: 5 },
      hasLineOfEffect: (_actor: Token, target: Token) => target.id !== 'blocked' }
    expect(dnd5eMapSpellTargetOptions(input).map(token => token.id)).toEqual(['door', 'held'])
    expect(dnd5eMapSpellTargetOptions({ ...input, actorToken: undefined })).toEqual([])
    expect(dnd5eMapSpellTargetOptions({ ...input, contract: { ...input.contract, sizes: [] } })).toEqual([])
  })
  it('only offers opposed creatures for an enemy-only spell such as Bane', () => {
    expect(dnd5eMapSpellTargetOptions({
      tokens,
      actorToken: actor,
      contract: { kind: 'creature', relation: 'enemy', includeSelf: false },
    }).map((token) => token.id)).toEqual(['bandit'])
  })

  it('honors ally and self targeting contracts', () => {
    expect(dnd5eMapSpellTargetOptions({
      tokens,
      actorToken: actor,
      contract: { kind: 'creature', relation: 'ally', includeSelf: true },
    }).map((token) => token.id)).toEqual(['cleric', 'wizard'])
    expect(dnd5eMapSpellTargetOptions({
      tokens,
      actorToken: actor,
      contract: { kind: 'self' },
    }).map((token) => token.id)).toEqual(['cleric'])
  })

  it('does not offer a creature that is temporarily unavailable on another plane', () => {
    expect(dnd5eMapSpellTargetOptions({
      tokens,
      actorToken: enemy,
      contract: { kind: 'creature', relation: 'enemy', includeSelf: false },
      unavailableTokenIds: new Set(['wizard']),
    }).map((token) => token.id)).toEqual(['cleric'])
  })

  it('honors spell-specific eligibility such as Gentle Repose corpse state', () => {
    expect(dnd5eMapSpellTargetOptions({
      tokens,
      actorToken: actor,
      contract: { kind: 'creature', relation: 'any', includeSelf: true },
      eligibleTokenIds: new Set(['wizard']),
    }).map((token) => token.id)).toEqual(['wizard'])
  })

  it('does not offer a creature outside the projected line of effect', () => {
    expect(dnd5eMapSpellTargetOptions({
      tokens,
      actorToken: actor,
      contract: { kind: 'creature', relation: 'enemy', includeSelf: false },
      hasLineOfEffect: (_actorToken, targetToken) => targetToken.id !== 'bandit',
    }).map((token) => token.id)).toEqual([])
  })

  it('only offers Etherealness upcast targets within 10 feet', () => {
    const near = { ...ally, id: 'near', x: 25, y: 5, size: 1 } as Token
    const far = { ...ally, id: 'far', x: 35, y: 5, size: 1 } as Token
    const positionedActor = { ...actor, x: 5, y: 5, size: 1 } as Token
    const map = {
      id: 'etherealness-range', name: 'Etherealness range', width: 100, height: 100,
      gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
      feetPerCell: 5, tokens: [positionedActor, near, far],
    } as BattleMap

    expect(dnd5eMapSpellTargetOptions({
      tokens: map.tokens,
      actorToken: positionedActor,
      contract: { kind: 'creature', relation: 'ally', includeSelf: true, rangeFeet: 10 },
      map,
    }).map((token) => token.id)).toEqual(['cleric', 'near'])
  })

  it('derives Flame Blade follow-up targeting from the sustained attack instead of the self cast', () => {
    const contract = dnd5eSustainedSpellTargetContract({
      id: 'flame-blade', economy: 'action', origin: 'caster', rangeFeet: 5,
      spellAttackMode: 'melee', dice: { count: 3, sides: 6, additionalDieEverySlotLevels: 2 },
      damageType: 'fire',
    })
    expect(contract).toEqual({
      kind: 'creature', relation: 'enemy', includeSelf: false, rangeFeet: 5,
    })
    expect(dnd5eMapSpellTargetOptions({
      tokens,
      actorToken: actor,
      contract,
    }).map((token) => token.id)).toEqual(['bandit'])
  })
})
