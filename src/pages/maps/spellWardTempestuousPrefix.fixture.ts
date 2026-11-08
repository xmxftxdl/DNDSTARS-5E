import {expect} from 'vitest'
import type {createNativeEnvelopeApi} from './mastermindMagicFamilies.fixture'
import type {MastermindSpellWindowGateway} from './mastermindSpellWindowParent'
import {readMastermindSpellWindowOriginal} from './mastermindSpellWindowParent'
import {beginMastermindSpellWindowCollector,readMastermindSpellWindowCollector} from './mastermindSpellWindowCollector'
import {actualHostPageTempestuousClock,actualHostPageTempestuousPrefix} from '../../rulesets/dnd5e/testFixtures/tempestuousActualHostPage.fixture'
import {beginTempestuousHostOriginalPreparation} from '../../rulesets/dnd5e/tempestuousHostOriginalPreparation'
import {createTempestuousBeforeRoomChoiceDriver} from '../../lib/tempestuousBeforeRoomChoices'
import {createCombatInterrupt} from '../../lib/combatInterruptQueue'

type Driver=Parameters<typeof createTempestuousBeforeRoomChoiceDriver>[0]
export async function prepareActualWardTempestuousPrefix(args:{parentId:string;g:MastermindSpellWindowGateway;api:Awaited<ReturnType<typeof createNativeEnvelopeApi>>;map:Driver['map'];characters:ReturnType<Driver['characters']>;choice:'use'|'decline'}){
 const initial=await readMastermindSpellWindowOriginal(args.parentId,args.g),action=initial.prepared.action;if(!action.dnd5eSpellCast)throw Error('Actual spell selection required')
 const collector=await beginMastermindSpellWindowCollector({parentTransactionId:action.id,mapId:initial.prepared.map.id,actorTokenId:initial.prepared.actorToken.id,spellCast:action.dnd5eSpellCast},args.g),original=await readMastermindSpellWindowCollector(collector),clock=await actualHostPageTempestuousClock(original,action),input={prepared:original.prepared,effectRolls:[]as number[],transactionId:action.id}
 let lifecycle:Awaited<ReturnType<typeof beginTempestuousHostOriginalPreparation>>|undefined
 const rpc=async(operation:string,payload:unknown)=>{const response=await args.api.post(operation,payload,'dm');expect(response.status,operation+':'+JSON.stringify(response.payload)).toBe(200);return response.payload}
 const driver=createTempestuousBeforeRoomChoiceDriver({map:args.map,geometry:null,characters:()=>args.characters,parentTransactionId:()=>action.id,authorityUnchanged:()=>true,choose:async request=>{
  const interrupt=createCombatInterrupt({id:request.id,transactionId:request.transactionId,mapId:request.mapId,kind:'plugin-choice',actorCharId:request.actor.id,payload:{pluginId:request.pluginId,featureId:request.featureId,featureName:request.featureName,prompt:request.prompt,audience:request.audience,options:request.options,defaultOptionId:request.defaultOptionId,movementChoice:request.movementChoice},expiresAt:Date.now()+120000})
  const optionId=args.choice==='decline'?'decline':request.id.endsWith(':use')?'use':request.movementChoice?'select-cell':'0',response={optionId,...(request.movementChoice?{movementCell:{col:0,row:1}}:{})}
  for(const [operation,body] of [['upsert',{interrupt}],['answer',{id:interrupt.id,response}],['finish',{id:interrupt.id,response}]]as const){const result=await args.api.post('combat-interrupts/interrupt',{operation,mapId:args.map.id,...body},'dm','PATCH');expect(result.status,operation+':'+JSON.stringify(result.payload)).toBe(200)}
  if(request.movementChoice)request.onMovementCell?.({col:0,row:1});return optionId
 }})
 const prefix=await actualHostPageTempestuousPrefix({source:input,clock,choose:driver.chooseTempestuousBeforeSpell!,begin:async(operation,request)=>{lifecycle=await beginTempestuousHostOriginalPreparation(operation,request);return lifecycle},request:(operation,payload)=>rpc('tempestuous-host-original/'+operation,payload),load:async identity=>{const result=await rpc('tempestuous-before-preparation/probe',identity);return result.present?result:undefined},publish:async(channel,payload)=>{const result=await args.api.post('../events/'+channel,payload,'dm');expect(result.status,channel+':'+JSON.stringify(result.payload)).toBe(200)}})
 if(!prefix||prefix.next.status!=='spell-attack-target-window')throw Error('Actual authenticated pre-raw prefix required')
 expect(prefix.next.snapshot.combatants['mage-token'].position).toEqual({x:25,y:args.choice==='use'?75:25});expect(prefix.next.snapshot.combatants['mage-token'].turn.bonusActionAvailable).toBe(args.choice!=='use')
 return{choice:args.choice,actualTargetFrontier:true as const,close:async()=>lifecycle?.cancel()}
}
