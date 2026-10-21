import {expect,it} from 'vitest'
import type {BattleMap} from '../../store/maps'
import {completeDnd5eCompanionTask} from './companionTaskCompletion'
it.each(['complete','player','changed','wrong-owner','wrong-feature','released','voluntary'] as const)('validates task acknowledgement: %s',variant=>{
 const order={schemaVersion:1 as const,sourceOwnerId:'owner',sourceFeatureId:'summon',command:'task' as const,issuedRound:1,persistentOrder:true,task:{description:'送信后返回报告'},...(variant==='voluntary'?{voluntaryForTokenId:'devil'}:{})}
 const map={id:'map',name:'Map',width:500,height:500,gridSize:50,showGrid:true,tokens:[{id:'devil',label:'Devil',type:'enemy',x:25,y:25,size:1,color:'',emoji:'',dnd5eSummon:{sourceTokenId:variant==='wrong-owner'?'other':'owner',featureId:variant==='wrong-feature'?'other':'summon',controlEnded:['released','voluntary'].includes(variant)},dnd5eCombatState:{companionCommand:order}}]} as BattleMap
 const expected=structuredClone(order)
 if(variant==='changed')map.tokens[0].dnd5eCombatState!.companionCommand!.task!.description='新的任务'
 const before=structuredClone(map)
 const result=completeDnd5eCompanionTask({map,tokenId:'devil',expectedOrder:expected,isDm:variant!=='player'})
 expect(map).toEqual(before)
 if(!['complete','voluntary'].includes(variant)){expect(result).toBeUndefined();return}
 expect(result).toBeDefined()
 expect(result!.map.tokens[0].dnd5eCombatState!.companionCommand).toBeUndefined()
 expect(result!.map.tokens[0].dnd5eSummon).toEqual(map.tokens[0].dnd5eSummon)
 expect(result!.event).toMatchObject({type:'companion-order-completed',sourceOwnerId:'owner',taskDescription:'送信后返回报告'})
 expect(completeDnd5eCompanionTask({map:JSON.parse(JSON.stringify(result!.map)),tokenId:'devil',expectedOrder:expected,isDm:true})).toBeUndefined()
})
