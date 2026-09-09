import { describe, expect, it } from 'vitest'
import { formatDnd5eSecretCombatOutcomeDetails } from '../../lib/combatLogDetails'
import { publicActivityRollDetails } from './combatRollVisibility'
import type { ActivityRollLogEvidence } from './dnd5eActivityHandoffLogDetails'
import { combatLogChinese } from './combatLogChinese'

describe('player spell with player and monster saving throws', () => {
  const players = new Set(['hero', 'caster'])
  const extra = [
    'Activity d20 骰据：spell-save-d20:hero｜候选 11｜采用 11 + 2 = 13',
    'Activity d20 骰据：spell-save-d20:monster｜候选 5｜采用 5 + 1 = 6',
    'Activity 骰据：prismatic-ray-d8:monster｜8 = 8',
    'Activity 骰据：prismatic-extra-ray-a-d8:monster｜6 = 6',
  ].map((text, i): ActivityRollLogEvidence => ({kind:'activity-roll',text,rollId:String(i),rollerId:i === 0 ? 'hero' : i === 1 ? 'monster' : 'caster',values:[],modifier:0,total:0}))
  it('keeps player save arithmetic, DC and caster d8 while hiding monster dice', () => {
    const details = formatDnd5eSecretCombatOutcomeDetails([
      { type: 'saving-throw-resolved', targetId: 'hero', ability: 'dex', d20: 11, modifier: 2, total: 13, dc: 19, success: false },
      { type: 'saving-throw-resolved', targetId: 'monster', ability: 'dex', d20: 5, modifier: 1, total: 6, dc: 19, success: false },
    ], { publicRollerIds: players, publicExtra: publicActivityRollDetails(extra, players, true), resolveName: id => id === 'hero' ? 'Test02' : '卓尔' })
    const text = details.map(line => combatLogChinese(line)).join('\n')
    expect(text).toContain('Test02｜敏捷豁免 20 面骰 11 +2 = 13 对抗难度 19｜失败')
    expect(text).toContain('虹光颜色骰（8 面骰）｜8 = 8')
    expect(text).toContain('虹光额外颜色骰一（8 面骰）｜6 = 6')
    expect(text).toContain('卓尔｜敏捷豁免结果：失败')
    expect(text).not.toContain('候选 5')
    expect(text).not.toContain('5 +1 = 6')
  })
  it('does not expose the color/damage dice of a hidden monster caster', () => {
    expect(publicActivityRollDetails(extra.map(entry => ({...entry, rollerId:entry.rollerId === 'caster' ? 'monster' : entry.rollerId})), players)).toEqual([extra[0].text])
  })
})
