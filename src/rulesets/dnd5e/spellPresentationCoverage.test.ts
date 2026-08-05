import { describe, expect, it } from 'vitest'
import {
  COMBAT_PRESENTATION_AREA_SPELL_CONTRACTS,
  COMBAT_PRESENTATION_PROJECTILE_SPELL_IDS,
  COMBAT_PRESENTATION_TARGET_EFFECT_SPELL_IDS,
} from '../../../shared/combat-presentation-contract.mjs'
import { dnd5eSpellbookEntries } from './spellbook'

const SPECIAL_PRESENTATION_SPELL_IDS = ['fireball', 'chill-touch', 'sacred-flame'] as const

describe('core Headless spell presentation coverage', () => {
  it('keeps the explicit no-map-animation list visible as a coverage ratchet', () => {
    const presented = new Set<string>([
      ...COMBAT_PRESENTATION_PROJECTILE_SPELL_IDS,
      ...COMBAT_PRESENTATION_TARGET_EFFECT_SPELL_IDS,
      ...Object.keys(COMBAT_PRESENTATION_AREA_SPELL_CONTRACTS),
      ...SPECIAL_PRESENTATION_SPELL_IDS,
    ])
    const withoutMapAnimation = dnd5eSpellbookEntries([])
      .filter((spell) => spell.headless && !presented.has(spell.id))
      .map((spell) => spell.id)
      .sort()

    expect(withoutMapAnimation).toEqual([])
  })
})
