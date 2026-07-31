import { describe, expect, it } from 'vitest'
import {
  resolveInitiativePortrait,
  resolveMapTokenPortrait,
} from './portraitPresentation'

describe('portrait presentation resolution', () => {
  const character = {
    portrait: 'character-full.png',
    initiativePortrait: 'character-initiative.png',
    tokenPortrait: 'character-token.png',
  }
  const token = {
    portrait: 'token-initiative.png',
    tokenPortrait: 'token-map.png',
  }

  it('uses the dedicated character crop on map-token surfaces', () => {
    expect(resolveMapTokenPortrait(character, token)).toBe('character-token.png')
    expect(resolveMapTokenPortrait({ portrait: character.portrait }, token)).toBe('token-map.png')
    expect(resolveMapTokenPortrait({ portrait: character.portrait })).toBe('character-full.png')
  })

  it('uses the dedicated initiative crop on turn-order surfaces', () => {
    expect(resolveInitiativePortrait(character, token)).toBe('character-initiative.png')
    expect(resolveInitiativePortrait({ portrait: character.portrait }, token)).toBe('character-full.png')
    expect(resolveInitiativePortrait(undefined, token)).toBe('token-initiative.png')
  })
})
