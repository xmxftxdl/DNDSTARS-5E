import { describe, expect, it } from 'vitest'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { DND5E_LONGBOW, DND5E_SHORTSWORD } from './equipment'
import {
  prepareDnd5eHunterMultiattack,
  previewDnd5eHunterMultiattack,
  resolvePreparedDnd5eHunterMultiattack,
} from './hunterMultiattackAction'

function ranger(feature: 'volley' | 'whirlwind-attack'): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1', id: 'ranger', name: '猎人', player: '', avatar: '', accent: '', race: '人类',
    charClass: '游侠', level: 11, background: '', experience: 0, reputation: 0,
    abilities: { str: 14, dex: 18, con: 14, int: 10, wis: 14, cha: 10 }, savingThrows: [], skills: [],
    maxHp: 80, currentHp: 80, tempHp: 0, hitDice: '11d10', ac: 16, speed: 30, initiativeBonus: 0,
    saveDC: 14, passivePerception: 12, inspiration: 0, 
    conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    equipment: { mainWeapon: feature === 'volley' ? DND5E_LONGBOW : DND5E_SHORTSWORD },
    dnd5eClassChoices: { classes: { ranger: { subclass: 'hunter', selections: { multiattack: [feature] } } } },
  }
}

function token(id: string, type: 'player' | 'enemy', x: number, y: number, characterId?: string): Token {
  return { id, label: id, type, x, y, size: 1, color: '', emoji: '', characterId, hp: 30, maxHp: 30 }
}

function action(feature: 'volley' | 'whirlwind-attack', centerId: string): SharedPlayerActionState {
  return {
    id: 'multiattack', mapId: 'map', combatId: 'combat', sourceMode: 'player', status: 'pending',
    type: 'dnd5e-weapon-attack', actorTokenId: 'ranger-token', characterId: 'ranger', targetTokenId: centerId,
    dnd5eWeaponAttackOptions: { hunterMultiattack: feature }, round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
  }
}

function prepare(feature: 'volley' | 'whirlwind-attack', tokens: Token[], extraCharacters: Character[] = []) {
  const character = ranger(feature)
  const map: BattleMap = {
    id: 'map', name: 'Map', width: 1000, height: 600, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0,
    showGrid: true, feetPerCell: 5, tokens,
  }
  return prepareDnd5eHunterMultiattack({
    action: action(feature, 'center'), map, characters: [character, ...extraCharacters],
    initiativeOrder: tokens.map((entry, index) => ({ tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index })),
    turnEconomy: createDnd5eTurnEconomyCounts('combat:1:ranger-token', 30),
  })
}

describe('Hunter Multiattack authority bridge', () => {
  it('uses a visible token as the Volley point and attacks each hostile creature within 10 feet once', () => {
    const prepared = prepare('volley', [
      token('ranger-token', 'player', 25, 25, 'ranger'),
      token('center', 'enemy', 275, 25),
      token('nearby', 'enemy', 325, 25),
      token('outside-burst', 'enemy', 475, 25),
    ])
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targets.map((target) => target.token.id)).toEqual(['center', 'nearby'])
    expect(previewDnd5eHunterMultiattack(prepared.prepared, 0, 12).hit).toBe(true)
    const resolved = resolvePreparedDnd5eHunterMultiattack({
      prepared: prepared.prepared,
      rolls: [
        { d20: 12, damageRolls: [5], classDamageRolls: [] },
        { d20: 12, damageRolls: [6], classDamageRolls: [] },
      ],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events.filter((event) => event.type === 'attack-resolved')).toHaveLength(2)
    expect(resolved.result.events.filter((event) => event.type === 'turn-resource-spent' && event.resource === 'action')).toHaveLength(1)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === 'center')?.hp).toBe(21)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === 'nearby')?.hp).toBe(20)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === 'outside-burst')?.hp).toBe(30)
  })

  it('uses Whirlwind Attack only with a melee weapon and attacks every hostile creature within 5 feet', () => {
    const prepared = prepare('whirlwind-attack', [
      token('ranger-token', 'player', 25, 25, 'ranger'),
      token('center', 'enemy', 75, 25),
      token('adjacent-two', 'enemy', 25, 75),
      token('far', 'enemy', 175, 25),
    ])
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.targets.map((target) => target.token.id)).toEqual(['center', 'adjacent-two'])
    const resolved = resolvePreparedDnd5eHunterMultiattack({
      prepared: prepared.prepared,
      rolls: [
        { d20: 12, damageRolls: [4], classDamageRolls: [] },
        { d20: 12, damageRolls: [5], classDamageRolls: [] },
      ],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === 'center')?.hp).toBe(22)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === 'adjacent-two')?.hp).toBe(21)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === 'far')?.hp).toBe(30)
  })

  it('lets a Lore Bard reduce one Hunter Multiattack damage roll', () => {
    const bard: Character = {
      ...ranger('volley'), id: 'bard', name: '吟游诗人', charClass: '吟游诗人', level: 5,
      equipment: undefined,
      dnd5eClassChoices: { classes: { bard: { subclass: 'lore', selections: {} } } },
      classResources: { 'dnd5e-bardic-inspiration': { current: 2, max: 3 } },
    }
    const prepared = prepare('volley', [
      token('ranger-token', 'player', 25, 25, 'ranger'),
      token('center', 'enemy', 275, 25),
      token('bard-token', 'player', 225, 25, 'bard'),
    ], [bard])
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eHunterMultiattack({
      prepared: prepared.prepared,
      rolls: [{
        d20: 12,
        cuttingWordsDamage: { bardId: 'bard-token', roll: 3, distanceFeet: 30 },
        damageRolls: [5],
        classDamageRolls: [],
      }],
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === 'center')?.hp).toBe(24)
    expect(resolved.application?.characters.find((entry) => entry.id === bard.id)?.classResources?.['dnd5e-bardic-inspiration']).toEqual({ current: 1, max: 3 })
  })

  it('rejects a mismatched Hunter choice or weapon mode before any dice are rolled', () => {
    const character = ranger('volley')
    character.equipment = { mainWeapon: DND5E_SHORTSWORD }
    const rangerToken = token('ranger-token', 'player', 25, 25, 'ranger')
    const center = token('center', 'enemy', 75, 25)
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0,
      showGrid: true, feetPerCell: 5, tokens: [rangerToken, center],
    }
    expect(prepareDnd5eHunterMultiattack({
      action: action('volley', center.id), map, characters: [character],
      initiativeOrder: [
        { tokenId: rangerToken.id, label: rangerToken.label, emoji: '', color: '', roll: 20 },
        { tokenId: center.id, label: center.label, emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })).toEqual({ ok: false, reason: 'wrong-weapon' })
  })
})
