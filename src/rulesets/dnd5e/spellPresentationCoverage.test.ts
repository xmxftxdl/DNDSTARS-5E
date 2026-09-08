import { describe, expect, it } from 'vitest'
import {
  COMBAT_PRESENTATION_AREA_SPELL_CONTRACTS,
  COMBAT_PRESENTATION_PROJECTILE_SPELL_IDS,
  COMBAT_PRESENTATION_TARGET_EFFECT_SPELL_IDS,
} from '../../../shared/combat-presentation-contract.mjs'
import { dnd5eSpellbookEntries } from './spellbook'
import { getDnd5eSrdCombatSpell } from './spells'
import { dnd5eSrdAuditedSpellDefinitionV1 } from './activities/dnd5eSrdAuditedSpellActivities'

const SPECIAL_PRESENTATION_SPELL_IDS = ['fireball', 'chill-touch', 'sacred-flame'] as const
const PRESENTATION_PARENT_SPELL_IDS: Readonly<Record<string, string>> = {
  'call-lightning-strike': 'call-lightning',
}

describe('core spell presentation coverage', () => {
  it('keeps every declared map presentation bound to an implemented spell', () => {
    const presented = new Set<string>([
      ...COMBAT_PRESENTATION_PROJECTILE_SPELL_IDS,
      ...COMBAT_PRESENTATION_TARGET_EFFECT_SPELL_IDS,
      ...Object.keys(COMBAT_PRESENTATION_AREA_SPELL_CONTRACTS),
      ...SPECIAL_PRESENTATION_SPELL_IDS,
    ])
    const spellbook = new Map(dnd5eSpellbookEntries([]).map((spell) => [spell.id, spell]))
    const invalidPresentationContracts = [...presented]
      .filter((spellId) => {
        const executableSpellId = PRESENTATION_PARENT_SPELL_IDS[spellId] ?? spellId
        const implemented = getDnd5eSrdCombatSpell(executableSpellId) ??
          dnd5eSrdAuditedSpellDefinitionV1(executableSpellId)
        return !implemented || spellbook.get(executableSpellId)?.catalogOnly !== false
      })
      .sort()

    // Visuals may also belong to assisted casts. Require an implemented
    // definition, without treating animation support as proof that every
    // rule branch is fully automatic.
    expect(invalidPresentationContracts).toEqual([])
  })
})
