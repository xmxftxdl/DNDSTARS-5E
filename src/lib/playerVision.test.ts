import { describe, expect, it } from 'vitest'
import { resolvePlayerVisionSourceTokenIds } from './playerVision'

const tokens = [
  { id: 'player-a-token', type: 'player', characterId: 'character-a' },
  { id: 'player-b-token', type: 'player', characterId: 'character-b' },
  { id: 'enemy-token', type: 'enemy' },
]

describe('player vision sources', () => {
  it('uses every party token when party vision is shared', () => {
    expect(resolvePlayerVisionSourceTokenIds({ tokens, sharePartyVision: true }))
      .toEqual(['player-a-token', 'player-b-token'])
  })

  it('keeps the controlled character as viewer across enemy turns', () => {
    expect(resolvePlayerVisionSourceTokenIds({
      tokens,
      sharePartyVision: false,
      controlledCharacterIds: [null, 'character-b'],
    })).toEqual(['player-b-token'])
  })

  it('uses the only player token as a safe recovery fallback', () => {
    expect(resolvePlayerVisionSourceTokenIds({
      tokens: [tokens[0], tokens[2]],
      sharePartyVision: false,
      controlledCharacterIds: [],
    })).toEqual(['player-a-token'])
    expect(resolvePlayerVisionSourceTokenIds({ tokens, sharePartyVision: false, controlledCharacterIds: [] }))
      .toEqual([])
  })
})
