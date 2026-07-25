import { describe, expect, it } from 'vitest'
import { sidebarNavItems } from './sidebarNavigation'

describe('sidebar navigation visibility', () => {
  it('exposes the combat simulator only to the DM surface', () => {
    expect(sidebarNavItems('dm').map((item) => item.to).at(-1)).toBe('/simulation')
    expect(sidebarNavItems('player').map((item) => item.to)).not.toContain('/simulation')
    expect(sidebarNavItems('player', 'spectator').map((item) => item.to)).not.toContain('/simulation')
  })
})
