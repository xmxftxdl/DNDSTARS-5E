import type{Character}from'../types/character'
import type{BattleMap}from'../store/maps'
import type{Dnd5eDamageReactionFlowOptions}from'../rulesets/dnd5e/damageReactionFlow'
import{dnd5ePluginFeatureDefinition,dnd5ePluginFeatureCurrentEnvelopeFullV1}from'../rulesets/dnd5e/pluginApi'
interface ChoiceRequest{id:string;transactionId:string;mapId:string;actor:Pick<Character,'id'>;pluginId:string;featureId:string;featureName:string;prompt:string;audience:'actor';options:Array<{id:string;label:string}>;defaultOptionId:string;timeoutMs:number}
/** Presentation for a true native casting-start occurrence. The original Session
 * owns qualification and final damage; this driver cannot mint either. */
export function createStormCastRoomChoiceDriver(input:{map:BattleMap;characters:()=>readonly Character[];parentTransactionId:()=>string|null|undefined;choose:(request:ChoiceRequest)=>Promise<string|undefined>;authorityUnchanged:()=>boolean}):Pick<Dnd5eDamageReactionFlowOptions,'chooseStormCast'>{
return{chooseStormCast:async({frame,state})=>{
 const guard=()=>{if(!input.authorityUnchanged()||input.parentTransactionId()!==frame.parentId)throw Error('storm-cast-room:stale-parent')};guard()
 const definitions=frame.options.map(option=>({option,feature:dnd5ePluginFeatureDefinition(option.featureId)})),signature=JSON.stringify(definitions)
 const current=()=>{guard();const next=frame.options.map(option=>({option,feature:dnd5ePluginFeatureDefinition(option.featureId)}));if(JSON.stringify(next)!==signature||next.some(row=>!row.feature||!dnd5ePluginFeatureCurrentEnvelopeFullV1(row.option.featureId)))throw Error('storm-cast-room:changed-source')};current()
 const token=input.map.tokens.find(t=>t.id===frame.actorId),owner=input.characters().find(c=>c.id===token?.characterId)
 if(!owner||!state.combatants[frame.actorId])throw Error('storm-cast-room:canonical-owner-required')
 let a=2166136261,b=2246822519;for(let i=0;i<frame.id.length;i++){a=Math.imul(a^frame.id.charCodeAt(i),16777619);b=Math.imul(b^frame.id.charCodeAt(i),3266489917)}const key='storm-cast:'+(a>>>0).toString(36)+(b>>>0).toString(36)
 for(const row of definitions){const feature=row.feature!,common={transactionId:frame.parentId,mapId:input.map.id,actor:owner,pluginId:feature.ownerPluginId,featureId:feature.id,featureName:feature.name,audience:'actor' as const,defaultOptionId:'pending',timeoutMs:60_000}
  const use=await input.choose({...common,id:key+':'+row.option.featureId+':use',prompt:'你开始施放了至少一环、造成闪电或雷鸣伤害的法术。是否使用风暴之心，对你选择的可见10尺生物各造成 '+row.option.damage+' 点伤害？',options:[{id:'pending',label:'稍后处理'},{id:'decline',label:'不使用风暴之心'},{id:'use',label:'使用风暴之心'}]});current();if(use==='decline')continue;if(use!=='use')throw Error('storm-cast-room:decision-pending')
  const damageType=await input.choose({...common,id:key+':'+row.option.featureId+':damage-type',prompt:'选择本次风暴之心的伤害类型。',options:[{id:'pending',label:'稍后处理'},{id:'cancel',label:'取消风暴之心'},{id:'lightning',label:'闪电伤害'},{id:'thunder',label:'雷鸣伤害'}]});current();if(damageType==='cancel')return undefined;if(damageType!=='lightning'&&damageType!=='thunder')throw Error('storm-cast-room:decision-pending')
  const targetIds:string[]=[]
  for(const targetId of frame.targetIds){const target=state.combatants[targetId];if(!target)throw Error('storm-cast-room:current-target-required');const selected=await input.choose({...common,id:key+':'+row.option.featureId+':target:'+targetId,prompt:'是否让 '+target.name+' 受到本次风暴之心的 '+row.option.damage+' 点'+(damageType==='lightning'?'闪电':'雷鸣')+'伤害？可以不选择任何生物。',options:[{id:'pending',label:'稍后处理'},{id:'cancel',label:'取消风暴之心'},{id:'skip',label:'不选择此生物'},{id:'select',label:'选择此生物'}]});current();if(selected==='cancel')return undefined;if(selected==='select')targetIds.push(targetId);else if(selected!=='skip')throw Error('storm-cast-room:decision-pending')}
  return{frameId:frame.id,featureId:row.option.featureId,damageType,targetIds}
 }
 return undefined
}}}
