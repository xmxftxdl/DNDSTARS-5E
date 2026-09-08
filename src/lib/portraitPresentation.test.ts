import { describe, expect, it } from 'vitest'
import {
  resolveAvailablePortraitSource,
  resolveCompactPortraitImageId,
  resolveInitiativePortrait,
  resolveInitiativePortraitImageId,
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

  it('keeps compact and initiative room-image fallbacks on the same monster artwork', () => {
    const shared = {
      portraitImageId: 'initiative-image',
      tokenPortraitImageId: 'token-image',
    }
    expect(resolveCompactPortraitImageId(shared)).toBe('token-image')
    expect(resolveInitiativePortraitImageId(shared)).toBe('initiative-image')
    expect(resolveCompactPortraitImageId({ portraitImageId: 'only-image' })).toBe('only-image')
    expect(resolveInitiativePortraitImageId({ tokenPortraitImageId: 'only-token' })).toBe('only-token')
  })

  it('falls back from a failed catalog portrait to a shared image and then to no image', () => {
    expect(resolveAvailablePortraitSource('catalog.png', 'blob:shared', [])).toBe('catalog.png')
    expect(resolveAvailablePortraitSource('catalog.png', 'blob:shared', ['catalog.png'])).toBe('blob:shared')
    expect(resolveAvailablePortraitSource('catalog.png', 'blob:shared', ['catalog.png', 'blob:shared'])).toBeUndefined()
  })
})
