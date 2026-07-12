import { describe, expect, it } from 'vitest'
import type { Character } from '../types/character'
import { pendingTraitChoices, registerTraitChoiceGroup } from './traitRegistry'

describe('trait choice registry', () => {
  it('allows a non-archer class module to register progression choices', () => {
    const dispose = registerTraitChoiceGroup({
      id: 'test-mage-lv1',
      title: '测试法师特性',
      hint: '选择一个特性',
      minLevel: 1,
      pickCount: 1,
      options: [],
      applies: (character) => character.charClass === '测试法师',
    })
    try {
      const mage = {
        id: 'mage',
        charClass: '测试法师',
        level: 1,
        traitChoicesDone: {},
      } as Character
      expect(pendingTraitChoices(mage).map((group) => group.id)).toContain('test-mage-lv1')
    } finally {
      dispose()
    }
  })
})
