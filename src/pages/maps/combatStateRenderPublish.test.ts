import { describe, expect, it } from 'vitest'
import { shouldPublishCombatStateFromRender } from './combatStateRenderPublish'

describe('shouldPublishCombatStateFromRender', () => {
  it('never republishes an inactive snapshot while a new initiative order is being installed', () => {
    expect(shouldPublishCombatStateFromRender({
      combatActive: false,
      initiativeOrderCount: 19,
    })).toBe(false)
  })

  it('publishes only a complete active combat snapshot', () => {
    expect(shouldPublishCombatStateFromRender({
      combatActive: true,
      initiativeOrderCount: 0,
    })).toBe(false)
    expect(shouldPublishCombatStateFromRender({
      combatActive: true,
      initiativeOrderCount: 19,
    })).toBe(true)
  })
})
