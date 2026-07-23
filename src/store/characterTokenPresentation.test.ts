import { describe, expect, it } from 'vitest'
import { projectCharacterTokenPresentations, type Token } from './maps'

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
})
