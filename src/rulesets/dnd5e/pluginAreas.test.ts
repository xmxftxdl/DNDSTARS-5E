import { describe, expect, it } from 'vitest'
import type { Dnd5ePluginArea } from '../../store/maps'
import type { Character } from '../../types/character'
import { reconcileDnd5ePluginAreas } from './pluginAreas'

const area = (patch: Partial<Dnd5ePluginArea> = {}): Dnd5ePluginArea => ({
  id: 'area-1', pluginId: 'com.example.area', featureId: 'com.example.area:mist', label: '迷雾', color: '#8b5cf6',
  sourceCharacterId: 'caster', sourceTokenId: 'caster-token', cells: [{ col: 1, row: 1 }],
  createdRound: 1, expiresAfterRound: 3, ...patch,
})

const character = (patch: Partial<Character> = {}): Character => ({
  id: 'caster', name: 'caster', player: '', avatar: '', accent: '', race: '人类', charClass: '法师', level: 3,
  background: '', experience: 0, reputation: 0, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  savingThrows: [], skills: [], maxHp: 10, currentHp: 10, tempHp: 0, hitDice: '3d6', ac: 10, speed: 30,
  initiativeBonus: 0, saveDC: 12, passivePerception: 10, inspiration: 0, conditions: [], notes: '', dmNotes: '',
  visibleToPlayers: true, ...patch,
})

describe('D&D 5e plugin persistent areas', () => {
  it('expires finite areas after their declared round', () => {
    expect(reconcileDnd5ePluginAreas([area()], [character()], 3)).toHaveLength(1)
    expect(reconcileDnd5ePluginAreas([area()], [character()], 4)).toHaveLength(0)
  })

  it('removes concentration areas as soon as the source concentration no longer matches', () => {
    const concentrated = area({ concentrationId: 'plugin-area:action-1' })
    expect(reconcileDnd5ePluginAreas([concentrated], [character({
      concentrating: true,
      dnd5eCombatState: { concentrationSpellId: 'plugin-area:action-1' },
    })], 2)).toHaveLength(1)
    expect(reconcileDnd5ePluginAreas([concentrated], [character({ concentrating: false })], 2)).toHaveLength(0)
  })
})
