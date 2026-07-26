import { describe, expect, it } from 'vitest'
import { sidebarNavItems } from './sidebarNavigation'

describe('sidebar navigation visibility', () => {
  it('exposes the combat simulator only to the DM surface', () => {
    expect(sidebarNavItems('dm').map((item) => item.to).at(-1)).toBe('/simulation')
    expect(sidebarNavItems('player').map((item) => item.to)).not.toContain('/simulation')
    expect(sidebarNavItems('player', 'spectator').map((item) => item.to)).not.toContain('/simulation')
  })

  it('projects links into one campaign workspace without changing role visibility', () => {
    expect(sidebarNavItems('dm', 'dm', '/campaign/ABC234').map((item) => item.to)).toEqual([
      '/campaign/ABC234/overview',
      '/campaign/ABC234/maps',
      '/campaign/ABC234/characters',
      '/campaign/ABC234/spellbook',
      '/campaign/ABC234/communications',
      '/campaign/ABC234/simulation',
    ])
    expect(sidebarNavItems('player', 'spectator', '/campaign/ABC234').map((item) => item.to))
      .toEqual(['/campaign/ABC234/maps'])
  })
})
