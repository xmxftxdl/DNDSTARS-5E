import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DND5E_SRD_SPELL_NAMES_ZH } from './spellNamesZh'
import {
  DND5E_SRD_5_1_ATTRIBUTION,
  DND5E_SRD_5_1_LICENSE_URL,
  DND5E_SRD_5_1_SOURCE_URL,
} from './srdContent'

describe('SRD 5.1 content provenance', () => {
  it('keeps the required CC BY 4.0 attribution and canonical source links', () => {
    expect(DND5E_SRD_5_1_ATTRIBUTION).toContain('System Reference Document 5.1')
    expect(DND5E_SRD_5_1_ATTRIBUTION).toContain('Wizards of the Coast LLC')
    expect(DND5E_SRD_5_1_ATTRIBUTION).toContain(DND5E_SRD_5_1_SOURCE_URL)
    expect(DND5E_SRD_5_1_ATTRIBUTION).toContain(DND5E_SRD_5_1_LICENSE_URL)
  })

  it('uses one canonical Chinese name table for all 319 core spells', () => {
    expect(Object.keys(DND5E_SRD_SPELL_NAMES_ZH)).toHaveLength(319)
    expect(DND5E_SRD_SPELL_NAMES_ZH['plane-shift']).toBe('异界传送')
    expect(DND5E_SRD_SPELL_NAMES_ZH.wish).toBe('祈愿术')
    expect(DND5E_SRD_SPELL_NAMES_ZH.identify).toBe('鉴定术')
  })

  it('does not allow translation-service clients back into either review generator', () => {
    for (const relativePath of [
      '../../../scripts/generate-srd-spell-translations.py',
      '../../../scripts/generate-srd-magic-item-rules.py',
    ]) {
      const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
      expect(source).not.toMatch(/lingva|google\s*translate|deepl|translate_chunk/i)
      expect(source).toContain('reviewedBy')
      expect(source).toContain('--emit')
    }
  })

  it('keeps retired non-release content out of the runtime and public build', () => {
    for (const relativePath of [
      './spellDescriptionsZh.generated.ts',
      './magicItemRulesZh.generated.ts',
      '../../../public/plugin-templates/phb-2014-compat-template.dndstars5e',
      '../../../public/plugin-templates/custom-equipment-pack-template.dndstars5e',
    ]) {
      expect(existsSync(new URL(relativePath, import.meta.url)), relativePath).toBe(false)
    }

    const spellbook = readFileSync(new URL('./spellbook.ts', import.meta.url), 'utf8')
    const magicItems = readFileSync(new URL('./magicItems.ts', import.meta.url), 'utf8')
    expect(spellbook).not.toMatch(/legacy-runtime|spellDescriptionsZh\.generated/)
    expect(magicItems).not.toMatch(/magicItemRulesZh\.generated|LEGACY_MAGIC_ITEM/)
  })
})
