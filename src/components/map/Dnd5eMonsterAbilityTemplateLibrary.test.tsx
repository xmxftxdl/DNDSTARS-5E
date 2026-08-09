import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Dnd5eMonsterAbilityTemplate } from '../../rulesets/dnd5e/monsterWorkshopAbilityTemplates'
import Dnd5eMonsterAbilityTemplateLibrary from './Dnd5eMonsterAbilityTemplateLibrary'

const TEMPLATE: Dnd5eMonsterAbilityTemplate = {
  id: 'srd-5.1:test:trait:0:magic-resistance',
  section: 'trait',
  name: '魔法抗性',
  description: '对抗法术和其他魔法效应时进行的豁免检定具有优势。',
  sourceMonsterId: 'srd-5.1:test',
  sourceMonsterName: '测试魔物',
  sourceMonsterEnglishName: 'Test Monster',
  ruleKind: 'magic-resistance',
  dependencyCount: 0,
  searchText: '魔法抗性 magic-resistance 测试魔物 test monster',
  sourceIndex: 0,
}

describe('Dnd5eMonsterAbilityTemplateLibrary', () => {
  it('renders source, Headless status and the reusable rule description', () => {
    const markup = renderToStaticMarkup(createElement(Dnd5eMonsterAbilityTemplateLibrary, {
      open: true,
      templates: [TEMPLATE],
      initialSection: 'trait',
      onAdd: () => undefined,
      onClose: () => undefined,
    }))
    expect(markup).toContain('Headless 怪物能力模板库')
    expect(markup).toContain('魔法抗性')
    expect(markup).toContain('测试魔物 / Test Monster')
    expect(markup).toContain('对抗法术和其他魔法效应')
  })

  it('does not render while closed', () => {
    const markup = renderToStaticMarkup(createElement(Dnd5eMonsterAbilityTemplateLibrary, {
      open: false,
      templates: [TEMPLATE],
      onAdd: () => undefined,
      onClose: () => undefined,
    }))
    expect(markup).toBe('')
  })
})
