import { describe, expect, it } from 'vitest'
import {
  DND5E_2014_ALIGNMENT_OPTIONS,
  DND5E_2014_BACKGROUND_OPTIONS,
  DND5E_2014_CLASS_OPTIONS,
  DND5E_2014_RACE_OPTIONS,
} from './characterOptions'

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

  it('provides the nine Basic Rules races in Chinese', () => {
    expect(DND5E_2014_RACE_OPTIONS).toEqual([
      '矮人', '精灵', '半身人', '人类', '龙裔', '侏儒', '半精灵', '半兽人', '提夫林',
    ])
  })

  it('provides all nine classic alignments in Chinese', () => {
    expect(DND5E_2014_ALIGNMENT_OPTIONS).toEqual([
      '守序善良', '中立善良', '混乱善良',
      '守序中立', '绝对中立', '混乱中立',
      '守序邪恶', '中立邪恶', '混乱邪恶',
    ])
  })
})
