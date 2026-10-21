import {expect,it} from 'vitest'
import {advanceDnd5eActivityTurnClock,normalizeDnd5eActivityTurnClock} from '../../rulesets/dnd5e/activities/dnd5eActivityTurnClock'
import {mergeDnd5ePersistentAreaTurnMapDelta} from './persistentAreaTurnBoundary'
import type {BattleMap} from '../../store/maps'
function fixture(){
 const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[],dnd5eActivityTurnClock:{schemaVersion:1,combatId:'combat',turnKey:'1:a',sequence:0}}
 const first=advanceDnd5eActivityTurnClock({map,combatId:'combat',fromTurnKey:'1:a',toTurnKey:'1:b',expectedSequence:0})
 if(!first.ok)throw Error('fixture')
 const before=first.map
 const second=advanceDnd5eActivityTurnClock({map:before,combatId:'combat',fromTurnKey:'1:b',toTurnKey:'2:a',expectedSequence:1})
 if(!second.ok)throw Error('fixture')
 return {before,settled:second.map,current:{...before,dnd5eActivityTurnClock:normalizeDnd5eActivityTurnClock(JSON.parse(JSON.stringify(before.dnd5eActivityTurnClock)))}}
}
it('accepts the same clock after shared-state normalization while a saving throw is pending',()=>{
 const input=fixture()
 expect(input.current.dnd5eActivityTurnClock).toEqual(input.before.dnd5eActivityTurnClock)
 expect(mergeDnd5ePersistentAreaTurnMapDelta(input).dnd5eActivityTurnClock).toEqual(input.settled.dnd5eActivityTurnClock)
})
it('still rejects a genuinely advanced clock without mutating input',()=>{
 const input=fixture();input.current.dnd5eActivityTurnClock=input.settled.dnd5eActivityTurnClock
 const snapshot=JSON.stringify(input)
 expect(()=>mergeDnd5ePersistentAreaTurnMapDelta(input)).toThrow('stale-activity-turn-clock-commit')
 expect(JSON.stringify(input)).toBe(snapshot)
})
