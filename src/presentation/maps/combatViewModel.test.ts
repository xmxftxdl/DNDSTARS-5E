import { describe, expect, it, vi } from 'vitest'
import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { combatHotbarActiveActionId, projectCombatInitiativeOrder } from './combatViewModel'

describe('combat view model', () => {
  it('projects live token identity without mutating the authoritative initiative entry', () => {
    const entry: InitiativeEntry = {
      tokenId: 'token-1', label: '旧名称', emoji: 'A', color: '#111111', roll: 18,
    }
    const token = {
      id: 'token-1', characterId: 'character-1', label: '新名称', emoji: 'B',
      portraitImageId: 'portrait-1',
    } as Token
    const character = { id: 'character-1', name: '角色' } as Character
    const projected = projectCombatInitiativeOrder([entry], [token], [character], {
      resolvePortrait: vi.fn(() => 'portrait-data'),
      resolveColor: vi.fn(() => '#22d3ee'),
    })

    expect(projected[0]).toMatchObject({
      label: '新名称', emoji: 'B', portrait: 'portrait-data', portraitImageId: 'portrait-1',
      color: '#22d3ee', turnGlowColor: '#22d3ee',
    })
    expect(entry).toMatchObject({ label: '旧名称', color: '#111111' })
  })

  it('uses the room Token image when a monster has no separate initiative image', () => {
    const entry: InitiativeEntry = {
      tokenId: 'sphinx', label: '雄性斯芬克斯', emoji: '🦁', color: '#b45309', roll: 18,
    }
    const token = {
      id: 'sphinx', label: entry.label, emoji: entry.emoji,
      type: 'enemy', color: entry.color, tokenPortraitImageId: 'room-sphinx-token',
    } as Token

    expect(projectCombatInitiativeOrder([entry], [token], [], {
      resolvePortrait: vi.fn(() => undefined),
      resolveColor: vi.fn(() => entry.color),
    })[0]?.portraitImageId).toBe('room-sphinx-token')
  })

  it('derives hotbar selection with active targeting taking precedence', () => {
    expect(combatHotbarActiveActionId({
      baseSelectionId: 'system:dodge',
      activeCharacterId: 'wizard',
      spell: { characterId: 'wizard', castingClassId: 'wizard', spellId: 'fireball' },
    })).toBe('spell:wizard:fireball')
    expect(combatHotbarActiveActionId({
      activeCharacterId: 'wizard',
      spell: { characterId: 'wizard', castingClassId: 'wizard', spellId: 'fireball' },
      moveActive: true,
      playerCanControlTurn: true,
    })).toBe('system:move')
    expect(combatHotbarActiveActionId({
      activeCharacterId: 'wizard',
      spell: { characterId: 'wizard', castingClassId: 'wizard', spellId: 'prismatic-spray' },
    })).toBe('spell:wizard:prismatic-spray')
  })

  it('keeps the selected creature-form attack highlighted', () => {
    expect(combatHotbarActiveActionId({
      activeCharacterId: 'druid',
      weapon: {
        characterId: 'druid',
        creatureFormId: 'giant-eagle',
        wildShapeActionIndex: 2,
      },
    })).toBe('creature-form:giant-eagle:attack:2')
  })
})
