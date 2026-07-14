import { describe, expect, it } from 'vitest'
import { DND5E_2014_BACKGROUND_OPTIONS, DND5E_2014_CLASS_OPTIONS } from './characterOptions'

describe('D&D 5e 2014 character options', () => {
  it('provides the twelve Basic Rules classes in Chinese', () => {
    expect(DND5E_2014_CLASS_OPTIONS).toEqual([
      '野蛮人', '吟游诗人', '牧师', '德鲁伊', '战士', '武僧',
      '圣武士', '游侠', '游荡者', '术士', '邪术师', '法师',
    ])
  })

  it('provides the six Basic Rules backgrounds in Chinese', () => {
    expect(DND5E_2014_BACKGROUND_OPTIONS).toEqual([
      '侍僧', '罪犯／间谍', '平民英雄', '贵族', '贤者', '士兵',
    ])
  })
})
