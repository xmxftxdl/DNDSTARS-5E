import { describe, expect, it } from 'vitest'
import { projectCharacterTokenPresentations, type Token } from './maps'
import { createDnd5eMechanicalEffect } from '../rulesets/dnd5e/activeEffects'

function token(patch: Partial<Token> = {}): Token {
  return {
    id: 'token-1',
    label: '旧名称',
    x: 0,
    y: 0,
    color: '#fff',
    emoji: '🛡️',
    size: 1,
    type: 'player',
    characterId: 'character-1',
    ...patch,
  }
}

describe('character token presentation', () => {
  it('projects the current character avatar and name onto an existing map token', () => {
    expect(projectCharacterTokenPresentations([token()], [
      { id: 'character-1', name: '艾利娅', avatar: '🧙‍♀️' },
    ])).toMatchObject([{ label: '艾利娅', emoji: '🧙‍♀️' }])
  })

  it('does not alter unlinked tokens or allocate a new array without changes', () => {
    const original = [token({ characterId: undefined })]
    expect(projectCharacterTokenPresentations(original, [])).toBe(original)
  })

  it('projects full portrait and the separately cropped map token from the character', () => {
    const projected = projectCharacterTokenPresentations([token()], [{
      id: 'character-1',
      name: 'Hero',
      avatar: 'H',
      portrait: 'data:image/webp;base64,AAAA',
      tokenPortrait: 'data:image/webp;base64,BBBB',
    }])
    expect(projected[0]).toMatchObject({
      portrait: 'data:image/webp;base64,AAAA',
      tokenPortrait: 'data:image/webp;base64,BBBB',
    })
  })

  it('projects temporary Darkvision without overwriting the stored token range', () => {
    const original = token({ darkvisionRangeFeet: 30 })
    const effect = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:darkvision',
      label: '黑暗视觉',
      targetId: original.id,
      source: { kind: 'spell', actorId: 'caster', rulesId: 'darkvision' },
      modifiers: { darkvisionRangeFeet: 60 },
    })
    const projected = projectCharacterTokenPresentations([original], [{
      id: 'character-1',
      name: original.label,
      avatar: original.emoji,
      dnd5eCombatState: { activeEffects: [effect] },
    }])
    expect(projected[0].darkvisionRangeFeet).toBe(60)
    expect(original.darkvisionRangeFeet).toBe(30)
    const withoutEffect = [original]
    expect(projectCharacterTokenPresentations(withoutEffect, [{
      id: 'character-1',
      name: original.label,
      avatar: original.emoji,
    }])).toBe(withoutEffect)
    expect(original.darkvisionRangeFeet).toBe(30)
  })

  it('projects bundled initiative portraits and map tokens for new and legacy monster ids', () => {
    const cases = [
      {
        ids: ['srd-5.1:goblin', 'goblin'],
        asset: 'goblin-forest-scout',
      },
      {
        ids: ['srd-5.1:bugbear', 'bugbear'],
        asset: 'bugbear-forest-raider',
      },
    ]
    for (const { ids, asset } of cases) {
      for (const poolId of ids) {
        const projected = projectCharacterTokenPresentations([
          token({ type: 'enemy', characterId: undefined, poolId }),
        ], [])
        expect(projected[0]).toMatchObject({
          portrait: `/assets/portraits/${asset}-initiative.png`,
          tokenPortrait: `/assets/portraits/${asset}-token.png`,
        })
      }
    }
    for (const poolId of ['srd-5.1:air-elemental', 'air-elemental']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/air-elemental-storm-canyon-initiative.png',
        tokenPortrait: '/assets/portraits/air-elemental-storm-canyon-token.png',
      })
    }
  })

  it('keeps a room-specific monster portrait ahead of the bundled goblin artwork', () => {
    const original = [
      token({
        type: 'enemy',
        characterId: undefined,
        poolId: 'srd-5.1:goblin',
        portraitImageId: 'custom-goblin',
      }),
    ]
    expect(projectCharacterTokenPresentations(original, [])).toBe(original)
  })

  it('projects the selected goblin appearance into both map and initiative artwork', () => {
    const projected = projectCharacterTokenPresentations([
      token({
        type: 'enemy',
        characterId: undefined,
        poolId: 'srd-5.1:goblin',
        visualVariantId: 'cave-skulk',
      }),
    ], [])
    expect(projected[0]).toMatchObject({
      portrait: '/assets/portraits/goblin-cave-skulk-initiative.png',
      tokenPortrait: '/assets/portraits/goblin-cave-skulk-token.png',
    })
  })
})
