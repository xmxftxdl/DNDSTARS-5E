import type {Character} from '../types/character'
import type {BattleMap} from '../store/maps'
import type {Dnd5eDamageReactionFlowOptions} from '../rulesets/dnd5e/damageReactionFlow'
import {dnd5ePluginFeatureDefinition,dnd5ePluginFeatureCurrentEnvelopeFullV1} from '../rulesets/dnd5e/pluginApi'
import {dnd5eBoundedHostEventId} from '../rulesets/dnd5e/activities/dnd5eActivityIdentity'
interface ChoiceRequest{id:string;transactionId:string;mapId:string;actor:Pick<Character,'id'>;pluginId:string;featureId:string;featureName:string;prompt:string;audience:'actor';options:Array<{id:string;label:string}>;defaultOptionId:string;timeoutMs:number}
/** Presents a real suspended native pool. The Session validates the returned
 * source and commits its original result; this driver publishes no world state. */
export function createSpellDamageSelectedAbilityRoomChoiceDriver(input:{
 map:BattleMap;characters:()=>readonly Character[];parentTransactionId:()=>string|null|undefined
 choose:(request:ChoiceRequest)=>Promise<string|undefined>;authorityUnchanged:()=>boolean
}):Pick<Dnd5eDamageReactionFlowOptions,'chooseSpellSelectedAbilityBonus'>{
 return{chooseSpellSelectedAbilityBonus:async({frame,state})=>{
  const guard=()=>{if(!input.authorityUnchanged()||input.parentTransactionId()!==frame.parentId)throw Error('spell-selected-ability-room:stale-parent')};guard()
  const definitions=frame.options.map(option=>({option,feature:dnd5ePluginFeatureDefinition(option.featureId)})),signature=JSON.stringify(definitions)
  const current=()=>{guard();const next=frame.options.map(option=>({option,feature:dnd5ePluginFeatureDefinition(option.featureId)}));if(JSON.stringify(next)!==signature||next.some(row=>!row.feature||!dnd5ePluginFeatureCurrentEnvelopeFullV1(row.option.featureId)))throw Error('spell-selected-ability-room:changed-source')};current()
  for(const {option,feature} of definitions){
   const token=input.map.tokens.find(t=>t.id===option.actorId),owner=input.characters().find(c=>c.id===token?.characterId),actor=state.combatants[option.actorId],target=state.combatants[option.targetId]
   if(!owner||!actor||!target||!actor.pluginFeatureIds.includes(option.featureId)||Math.floor((actor.abilities.cha-10)/2)!==option.amount)throw Error('spell-selected-ability-room:canonical-owner-and-pool-required')
   const amount=option.amount>=0?'+'+option.amount:String(option.amount),type=option.damageType==='fire'?'火焰':'光耀'
   const selected=await input.choose({id:dnd5eBoundedHostEventId('spell-selected-ability:'+frame.id+':'+option.featureId),transactionId:frame.parentId,mapId:input.map.id,actor:owner,pluginId:feature!.ownerPluginId,featureId:feature!.id,featureName:feature!.name,audience:'actor',defaultOptionId:'pending',timeoutMs:60_000,prompt:'是否将魅力调整值（'+amount+'）加入该法术对「'+target.name+'」的这次'+type+'伤害？同一次施法只能加入一次。',options:[{id:'pending',label:'稍后处理'},{id:'decline',label:'保留加值，供该法术的其他伤害使用'},{id:'use',label:'加入 '+amount+' 伤害'}]});current()
   if(selected==='use')return{frameId:frame.id,featureId:option.featureId}
   if(selected!=='decline')throw Error('spell-selected-ability-room:decision-pending')
  }
  return undefined
 }}
}
