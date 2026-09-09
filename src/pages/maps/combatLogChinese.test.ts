import { describe, expect, it } from 'vitest'
import { combatLogChinese } from './combatLogChinese'

describe('Chinese combat log display', () => {
  it('translates historical roll identifiers while retaining values and resolving targets', () => {
    expect(combatLogChinese('Activity d20 骰据：spell-save-d20:abc｜候选 11｜采用 11 + 2 = 13', id => id === 'abc' ? '卓尔' : undefined))
      .toBe('规则骰值：法术豁免骰（20 面骰）（卓尔）｜候选 11｜采用 11 + 2 = 13')
    expect(combatLogChinese('Activity 骰据：prismatic-extra-ray-a-d8:abc｜6 = 6')).toBe('规则骰值：虹光额外颜色骰一（8 面骰）｜6 = 6｜目标受到靛色虹光（束缚／石化）')
  })
  it('translates spell effects and rule abbreviations without changing player names', () => {
    expect(combatLogChinese('Test02｜效果生效：activity:prismatic-spray:prismatic-spray-indigo'))
      .toBe('Test02｜效果生效：虹光喷射 · 靛色光线（束缚与石化）')
    expect(combatLogChinese('Test02｜敏捷豁免 d20 11 +2 = 13 vs DC 19｜HP 44 → 2'))
      .toBe('Test02｜敏捷豁免 20 面骰 11 +2 = 13 对抗难度 19｜生命值 44 → 2')
  })
})

 it('names the ray for each target and retains the actual d8 result', () => {
   expect(combatLogChinese('Activity 骰据：prismatic-ray-d8:hero｜5 = 5', () => 'Test02'))
     .toContain('5 = 5｜Test02受到蓝色虹光（冷冻伤害）')
   expect(combatLogChinese('Activity 骰据：prismatic-ray-d8:hero｜8 = 8', () => 'Test02'))
     .toContain('双重虹光（另掷两次决定颜色）')
   expect(combatLogChinese('Activity 骰据：prismatic-extra-ray-b-d8:hero｜7 = 7', () => 'Test02'))
     .toContain('Test02受到紫色虹光（目盲／传送）')
 })
