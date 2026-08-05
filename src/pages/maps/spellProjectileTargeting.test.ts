import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  appendDnd5eRepeatedProjectileTarget,
  dnd5eRepeatedProjectileTargetsComplete,
  dnd5eRepeatedProjectileTargetsRemaining,
} from './spellProjectileTargeting'

describe('repeated spell projectile targeting', () => {
  it('allocates each Magic Missile dart independently and preserves duplicate targets', () => {
    const first = appendDnd5eRepeatedProjectileTarget({
      maximumTargets: 3,
      targetTokenIds: [],
    }, 'goblin-a')
    const second = appendDnd5eRepeatedProjectileTarget({
      maximumTargets: 3,
      targetTokenIds: first,
    }, 'goblin-a')
    const third = appendDnd5eRepeatedProjectileTarget({
      maximumTargets: 3,
      targetTokenIds: second,
    }, 'goblin-b')

    expect(third).toEqual(['goblin-a', 'goblin-a', 'goblin-b'])
    expect(dnd5eRepeatedProjectileTargetsComplete({
      maximumTargets: 3,
      targetTokenIds: third,
    })).toBe(true)
  })

  it('does not accept more projectiles than the spell grants', () => {
    expect(appendDnd5eRepeatedProjectileTarget({
      maximumTargets: 3,
      targetTokenIds: ['a', 'b', 'c'],
    }, 'd')).toEqual(['a', 'b', 'c'])
  })

  it('reports how many projectile targets still need to be chosen', () => {
    expect(dnd5eRepeatedProjectileTargetsRemaining({
      maximumTargets: 5,
      targetTokenIds: ['a', 'a'],
    })).toBe(3)
  })

  it('keeps the projectile-allocation prompt above the initiative toolbar and below banners', () => {
    const source = readFileSync(new URL('../MapsWorkspacePage.tsx', import.meta.url), 'utf8')
    const promptLayer = source.match(
      /data-testid="dnd5e-spell-targeting-overlay"[\s\S]{0,320}?z-\[(\d+)\]/,
    )
    const toolbarLayer = source.match(
      /pointer-events-none absolute inset-x-2 top-2 z-\[(\d+)\] flex flex-col items-center/,
    )
    const bannerLayer = source.match(
      /pointer-events-none absolute inset-x-0 top-\[3%\] z-\[(\d+)\] flex justify-center/,
    )

    expect(promptLayer?.[1]).toBeDefined()
    expect(toolbarLayer?.[1]).toBeDefined()
    expect(bannerLayer?.[1]).toBeDefined()
    expect(Number(promptLayer?.[1])).toBeGreaterThan(Number(toolbarLayer?.[1]))
    expect(Number(promptLayer?.[1])).toBeLessThan(Number(bannerLayer?.[1]))
  })
})
