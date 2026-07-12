import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8')

describe('class extensibility boundaries', () => {
  it('keeps archer progression details out of the character store', () => {
    const characters = source('../store/characters.ts')
    for (const forbidden of [
      'syncArcherCombatSkills',
      'syncArcherTraits',
      'canLearnSkill(',
      'canUpgradeSkillRank(',
      'getSkillRank(',
    ]) {
      expect(characters, `character store must not contain ${forbidden}`).not.toContain(forbidden)
    }
    expect(characters).toContain('syncCharacterClassProgression')
  })

  it('keeps concrete skill ids out of UI and authoritative attack routing', () => {
    for (const relative of [
      '../pages/MapsPage.tsx',
      './playerAttackAction.ts',
      './headlessDmCombatEngine.ts',
    ]) {
      const text = source(relative)
      expect(text, `${relative} must resolve skills through registries`).not.toMatch(
        /skillTreeId\s*[!=]==?\s*['"][^'"]+['"]|['"][^'"]+['"]\s*[!=]==?\s*skillTreeId/,
      )
    }
  })

  it('uses the same range registry in UI and headless validation', () => {
    expect(source('../pages/mapsPageHelpers.ts')).toContain("from '../lib/skillRangeRegistry'")
    expect(source('./headlessDmCombatEngine.ts')).toContain("from './skillRangeRegistry'")
  })
})
