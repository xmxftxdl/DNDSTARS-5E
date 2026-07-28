import { describe, expect, it } from 'vitest'
import {
  claimPlayerTurnBanner,
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

  it('does not present the same turn again after the page remounts', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
    }
    const turn = playerTurnBannerKey({
      combatId: 'combat-remount',
      round: 1,
      slotId: 'player-initiative-slot',
    })

    expect(claimPlayerTurnBanner(storage, null, turn)).toBe(true)
    expect(claimPlayerTurnBanner(storage, null, turn)).toBe(false)
  })
})
