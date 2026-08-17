import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DND5E_STANDARD_CONDITION_IDS } from '../../rulesets/dnd5e/conditions'
import { DND5E_CONDITION_MARKERS, DND5E_FLIGHT_MARKER_ICON } from './dnd5eConditionMarkers'

describe('D&D 5e condition marker artwork', () => {
  it('gives every standard condition a reusable transparent SVG icon', () => {
    for (const condition of DND5E_STANDARD_CONDITION_IDS) {
      const icon = DND5E_CONDITION_MARKERS[condition].icon
      expect(icon, `${condition} icon`).toMatch(/^\/assets\/icons\/conditions\/condition-[a-z-]+\.svg$/)
      expect(existsSync(`public${icon}`), `${condition} asset`).toBe(true)
    }
  })

  it('uses the same SVG artwork pipeline for the flight marker', () => {
    expect(DND5E_FLIGHT_MARKER_ICON).toBe('/assets/icons/conditions/condition-flying.svg')
    expect(existsSync(`public${DND5E_FLIGHT_MARKER_ICON}`)).toBe(true)
  })
})
