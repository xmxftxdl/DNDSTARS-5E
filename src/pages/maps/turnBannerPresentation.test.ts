import { describe, expect, it } from 'vitest'
import {
  playerTurnBannerKey,
  shouldPresentPlayerTurnBanner,
} from './turnBannerPresentation'

describe('player turn banner presentation', () => {
  it('is one-shot for an initiative slot even after the banner has disappeared', () => {
    const firstTurn = playerTurnBannerKey({
      combatId: 'combat-1',
      round: 2,
      slotId: 'player-initiative-slot',
    })

    expect(shouldPresentPlayerTurnBanner(null, firstTurn)).toBe(true)
    expect(shouldPresentPlayerTurnBanner(firstTurn, firstTurn)).toBe(false)
  })

  it('presents again only when the initiative turn actually changes', () => {
    const firstTurn = playerTurnBannerKey({
      combatId: 'combat-1',
      round: 2,
      slotId: 'player-initiative-slot',
    })
    const nextTurn = playerTurnBannerKey({
      combatId: 'combat-1',
      round: 3,
      slotId: 'player-initiative-slot',
    })

    expect(shouldPresentPlayerTurnBanner(firstTurn, nextTurn)).toBe(true)
  })
})
