import { describe, expect, it } from 'vitest'
import { buildDnd5eMonsterPortraitPrompt } from './dnd5eMonsterPortraitPrompt'

describe('D&D 5e monster portrait prompt', () => {
  it('uses the current monster identity and asks for crop-safe original artwork', () => {
    const prompt = buildDnd5eMonsterPortraitPrompt({
      name: '伊利法统领虚体',
      englishName: 'Ilifa Commander Phantom',
      size: '中型',
      creatureType: '类人生物（红龙裔）',
      alignment: '守序中立',
      description: '一名披着暗红法袍的幽灵统领。',
    })

    expect(prompt).toContain('伊利法统领虚体 / Ilifa Commander Phantom')
    expect(prompt).toContain('圆形地图 Token')
    expect(prompt).toContain('窄幅先攻立绘')
    expect(prompt).toContain('不得临摹或复现任何现有官方美术')
    expect(prompt.length).toBeLessThan(4_000)
  })
})
