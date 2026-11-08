import {it,expect} from 'vitest'
import {assertBountifulSpellPostSaveRows} from './bountifulLuckAfterDice'
const late=[{legendaryResistance:true},{postD20Adjustment:{featureId:'foreign',actorId:'future',direction:'add',roll:20}},{rerollResourceKey:'foreign',rerollD20:20},{rerollD20Second:20},{blessRoll:4},{baneRoll:1},{bardicInspirationRoll:12},{darkOnesOwnLuckRoll:10}]
it.each(late)('keeps an unrolled zero sentinel unchanged: %j',addition=>{const original={targetId:'future',d20:0};expect(()=>assertBountifulSpellPostSaveRows([original],[{...original,...addition}])).toThrow('changed-unrolled-sentinel')})
it('preserves legitimate zero sentinels and lets already rolled targets add concrete late choices',()=>{const before=[{targetId:'past',d20:1},{targetId:'future',d20:0}];expect(()=>assertBountifulSpellPostSaveRows(before,[{targetId:'past',d20:1,blessRoll:3},structuredClone(before[1])])).not.toThrow()})
