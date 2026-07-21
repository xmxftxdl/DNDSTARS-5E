import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DND5E_SRD_SPELL_NAMES_ZH } from './spellNamesZh'
import {
  DND5E_SRD_5_1_ATTRIBUTION,
  DND5E_SRD_5_1_LICENSE_URL,
  DND5E_SRD_5_1_SOURCE_URL,
  normalizeDnd5eSrdSpellNamesInText,
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
    expect(normalizeDnd5eSrdSpellNamesInText('施放位面移动法术、愿望咒语和识别咒语。'))
      .toBe('施放异界传送、祈愿术和鉴定术。')
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
})
