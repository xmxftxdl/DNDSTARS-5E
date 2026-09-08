import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import CharacterRailEntry from './CharacterRailEntry'

describe('CharacterRailEntry', () => {
  it('uses the same dedicated portrait as the initiative rail', () => {
    const character = {
      id: 'hero',
      name: 'Hero',
      avatar: '🧙',
      accent: 'from-violet-500 to-sky-500',
      portrait: 'full-portrait.png',
      initiativePortrait: 'initiative-portrait.png',
      tokenPortrait: 'map-token-portrait.png',
    } as Character

    const markup = renderToStaticMarkup(createElement(CharacterRailEntry, {
      character,
      isActive: true,
      onAvatarClick: () => undefined,
    }))

    expect(markup).toContain('src="initiative-portrait.png"')
    expect(markup).not.toContain('map-token-portrait.png')
  })
})
