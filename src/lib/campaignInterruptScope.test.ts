import {expect,it} from 'vitest'
import {campaignVisibleInterruptQueue} from './campaignInterruptScope'
import {createCombatInterrupt} from './combatInterruptQueue'
import {buildCombatInterruptPromptViews,resolveCombatInterruptPromptSelection} from './combatInterruptPrompts'
import type {Character} from '../types/character'

const feather=createCombatInterrupt({id:'feather',mapId:'temple',transactionId:'temple-expiry:test',kind:'plugin-choice',actorCharId:'wizard',now:1,expiresAt:100,
 payload:{pluginId:'srd-5.1',featureId:'spell:feather-fall',featureName:'Feather Fall',prompt:'Fall',audience:'actor',options:[{id:'cast',label:'Cast'},{id:'decline',label:'Decline'}],defaultOptionId:'decline'}})
const attack=createCombatInterrupt({id:'attack',mapId:'temple',kind:'dodge',payload:{},now:1})
const queue={mapId:'temple',interrupts:[feather,attack],updatedAt:1}
it('exposes campaign choices across maps without forwarding ordinary combat prompts',()=>{
 expect(campaignVisibleInterruptQueue(queue,'temple')).toBe(queue)
 expect(campaignVisibleInterruptQueue(queue,'elsewhere')?.interrupts).toEqual([feather])
 expect(campaignVisibleInterruptQueue({...queue,interrupts:[attack]},'elsewhere')).toBeUndefined()
 expect(queue.interrupts).toEqual([feather,attack])
})
it('keeps the source map in the authorized player prompt and rejects another character',()=>{
 const scoped=campaignVisibleInterruptQueue(queue,'elsewhere')!
 const character={id:'wizard',name:'Wizard',currentHp:30,maxHp:30} as Character
 const select=(actor:Character)=>resolveCombatInterruptPromptSelection({queue:scoped,mapId:scoped.mapId,now:2,suppressed:{},
  answerContext:{characters:[character,actor],visibleCharacters:[actor],playerCharId:actor.id,assignedCharacterId:actor.id,tokens:[],authority:'player'}})
 expect(buildCombatInterruptPromptViews(select(character)).pluginChoice).toMatchObject({id:'feather',mapId:'temple'})
 expect(buildCombatInterruptPromptViews(select({...character,id:'other'})).pluginChoice).toBeUndefined()
})
