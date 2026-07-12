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

  it('keeps the skill-tree UI and combat formulas class-agnostic', () => {
    const skillTree = source('../components/character/SkillTreeTab.tsx')
    expect(skillTree).not.toContain('ArcherSkillDef')
    expect(skillTree).not.toContain('archerSkillTree')
    expect(skillTree).toContain('ClassSkillTreeNodeView')

    const combatStats = source('./combatStats.ts')
    expect(combatStats).not.toContain('isArcherLineClass')
    expect(combatStats).toContain('classDefinitionForClassName')
  })

  it('keeps direct class-resource fields out of UI and headless authority', () => {
    for (const relative of [
      '../pages/MapsPage.tsx',
      '../components/character/SkillBar.tsx',
      './headlessDmCombatEngine.ts',
    ]) {
      expect(source(relative), `${relative} must use classResources helpers`).not.toMatch(/\.qi\b/)
    }
    expect(source('./headlessDmCombatEngine.ts')).toContain('getClassResourceCurrent')
    expect(source('./headlessDmCombatEngine.ts')).toContain('spendClassResource')
  })

  it('keeps feature presentation and class-specific action routing out of core UI dispatch', () => {
    const features = source('../components/character/FeaturesTab.tsx')
    expect(features).not.toMatch(/featureKey\s*===/)
    expect(features).toContain('buildFeaturePresentation')

    const headless = source('./headlessDmCombatEngine.ts')
    expect(headless).not.toContain("actor.charClass !== '重炮手'")
    expect(headless).toContain('headlessClassCombatActionResolver')
    expect(headless).toContain('headlessFeatureActivationResolver')
  })
})
