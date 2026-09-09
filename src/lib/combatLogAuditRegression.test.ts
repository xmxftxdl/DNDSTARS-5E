import { describe, expect, it } from 'vitest'
import { formatDnd5eCombatLogDetails as full, formatDnd5eSecretCombatOutcomeDetails as shared } from './combatLogDetails'
import type { Dnd5eCombatEvent } from '../rulesets/dnd5e/headlessCombatEngine'
import { combatLogChinese } from '../pages/maps/combatLogChinese'
const publicRollerIds = new Set(['player'])
const samples: Dnd5eCombatEvent[] = [
  {type:'attack-resolved',actorId:'player',targetId:'monster',d20:16,total:21,armorClass:18,hit:true,critical:false},
  {type:'concentration-resolved',actorId:'player',d20:12,total:15,dc:10,success:true},
  {type:'death-save-resolved',actorId:'player',d20:17,successes:1,failures:0,stable:false,dead:false,currentHp:0},
  {type:'active-effect-save-resolved',targetId:'player',effectId:'hold',ability:'wis',total:14,dc:16,success:false},
  {type:'halfling-lucky-rerolled',actorId:'player',original:1,reroll:19,dieIndex:0},
  {type:'divine-intervention-resolved',actorId:'player',d100:9,success:true,automatic:false},
]
describe('combat log audit regression', () => {
  it.each(samples.map(event=>[event.type,event] as const))('preserves public player numbers for %s', (_,event) => {
    expect(shared([event],{publicRollerIds})).toEqual(full([event]))
    expect(full([event]).length).toBeGreaterThan(0)
  })
  it('redacts a monster concentration roll', () => {
    const event: Dnd5eCombatEvent = {type:'concentration-resolved',actorId:'monster',d20:12,total:15,dc:10,success:true}
    expect(shared([event],{publicRollerIds}).join('')).not.toMatch(/12|15|10/)
  })
  it('describes triggers and outcomes instead of dropping feature events', () => {
    expect(full([{type:'halfling-lucky-rerolled',actorId:'player',original:1,reroll:19,dieIndex:0}])[0]).toContain('掷出 1，重新投掷｜1 → 19')
    expect(full([{type:'action-surge-granted',actorId:'player'}])[0]).toContain('本回合获得一个额外动作')
    expect(full([{type:'legendary-resistance-used',targetId:'monster',remainingUses:2}])[0]).toContain('将失败改为成功')
  })
  it('keeps the final targets of large multi-target spells', () => {
    const events: Dnd5eCombatEvent[] = Array.from({length:40},(_,i)=>({type:'healing-applied',targetId:`target${i}`,amount:5,hpBefore:10,hpAfter:15}))
    expect(full(events)).toHaveLength(40)
    expect(full(events).at(-1)).toContain('target39')
  })
  it('uses catalog effect names and localized resource and ability labels', () => {
    expect(combatLogChinese('效果生效：activity:bestow-curse:bestow-curse-str')).toContain('降咒·力量劣势')
    expect(combatLogChinese('消耗dnd5e-spell-slot-8')).toBe('消耗8 环法术位')
    expect(combatLogChinese('规则 AC 18（athletics）')).toBe('规则 护甲等级 18（运动）')
  })
})
