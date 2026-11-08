import type{Character}from'../types/character'
import type{BattleMap}from'../store/maps'
import type{Dnd5eDamageReactionFlowOptions}from'../rulesets/dnd5e/damageReactionFlow'
import{dnd5ePluginFeatureDefinition,dnd5ePluginFeatureCurrentEnvelopeFullV1}from'../rulesets/dnd5e/pluginApi'
interface ChoiceRequest{id:string;transactionId:string;mapId:string;actor:Pick<Character,'id'>;pluginId:string;featureId:string;featureName:string;prompt:string;audience:'actor';options:Array<{id:string;label:string}>;defaultOptionId:string;timeoutMs:number}
interface PoolOwner{durableRollRequestId:string;rollerTokenId:string;rollerCharacterId:string;skipChoiceReroll:true}
/** Presentation only: the suspended original native frame determines owners,
 * original groups and eligibility. No character, HP, resource or dice is invented. */
export function createSpellHealingRerollRoomChoiceDriver(input:{map:BattleMap;characters:()=>readonly Character[];parentTransactionId:()=>string|null|undefined;choose:(request:ChoiceRequest)=>Promise<string|undefined>;rollDice:(count:number,sides:number,label:string,targetName:string,owner:PoolOwner)=>Promise<readonly number[]>;authorityUnchanged:()=>boolean}):Pick<Dnd5eDamageReactionFlowOptions,'chooseSpellHealingReroll'>{
return{chooseSpellHealingReroll:async({frame,state})=>{
 const parent=frame.parentId,guard=()=>{if(!input.authorityUnchanged()||input.parentTransactionId()!==parent)throw Error('spell-healing-reroll-room:stale-parent')};guard()
 const definitions=frame.options.map(option=>({option,feature:dnd5ePluginFeatureDefinition(option.featureId)})),signature=JSON.stringify(definitions)
 const current=()=>{guard();const next=frame.options.map(option=>({option,feature:dnd5ePluginFeatureDefinition(option.featureId)}));if(JSON.stringify(next)!==signature||next.some(row=>!row.feature||!dnd5ePluginFeatureCurrentEnvelopeFullV1(row.option.featureId)))throw Error('spell-healing-reroll-room:changed-source')};current()
 let a=2166136261,b=2246822519;for(let i=0;i<frame.id.length;i++){a=Math.imul(a^frame.id.charCodeAt(i),16777619);b=Math.imul(b^frame.id.charCodeAt(i),3266489917)}const key='spell-healing-reroll:'+(a>>>0).toString(36)+(b>>>0).toString(36)
 for(const row of definitions){
  const token=input.map.tokens.find(t=>t.id===row.option.ownerId),owner=input.characters().find(c=>c.id===token?.characterId)
  if(!owner||!state.combatants[row.option.ownerId])throw Error('spell-healing-reroll-room:canonical-owner-required')
  const feature=row.feature!,common={transactionId:parent,mapId:input.map.id,actor:owner,pluginId:feature.ownerPluginId,featureId:feature.id,featureName:feature.name,audience:'actor' as const,defaultOptionId:'pending',timeoutMs:60_000}
  const use=await input.choose({...common,id:key+':'+row.option.ownerId+':use',prompt:'本次法术正在恢复生命值。是否花费 1 术法点使用强效治疗？可以选择任意数量的原始治疗骰，必须采用新结果；每回合一次。',options:[{id:'pending',label:'稍后处理'},{id:'decline',label:'保留强效治疗'},{id:'use',label:'使用强效治疗'}]});current()
  if(use==='decline')continue;if(use!=='use')throw Error('spell-healing-reroll-room:decision-pending')
  const rerolls:Array<{rollId:string;dieIndex:number;value:number}>=[],selectedGroups:Array<{groupIndex:number;indices:number[]}>=[]
  for(let groupIndex=0;groupIndex<frame.groups.length;groupIndex++){
   const group=frame.groups[groupIndex],indices:number[]=[]
   for(let dieIndex=0;dieIndex<group.rolls.length;dieIndex++){
    const selected=await input.choose({...common,id:key+':'+row.option.ownerId+':group:'+groupIndex+':die:'+dieIndex,prompt:'治疗骰组 '+(groupIndex+1)+' 的第 '+(dieIndex+1)+' 枚 d'+group.sides+' 原结果为 '+group.rolls[dieIndex]+'。保留还是重掷？',options:[{id:'pending',label:'稍后处理'},{id:'cancel',label:'取消强效治疗'},{id:'keep',label:'保留此骰'},{id:'reroll',label:'重掷此骰'}]});current();if(selected==='cancel')return undefined;if(selected==='reroll')indices.push(dieIndex);else if(selected!=='keep')throw Error('spell-healing-reroll-room:decision-pending')
   }
   selectedGroups.push({groupIndex,indices})
  }
  for(const {groupIndex,indices} of selectedGroups){const group=frame.groups[groupIndex]
   if(indices.length){const values=await input.rollDice(indices.length,group.sides,'强效治疗 · 重掷治疗骰',owner.name,{durableRollRequestId:key+':'+row.option.ownerId+':group:'+groupIndex+':indices:'+indices.join('-'),rollerTokenId:row.option.ownerId,rollerCharacterId:owner.id,skipChoiceReroll:true});current();if(values.length!==indices.length||values.some(v=>!Number.isInteger(v)||v<1||v>group.sides))throw Error('spell-healing-reroll-room:actual-replacement-pool-required');indices.forEach((dieIndex,i)=>rerolls.push({rollId:group.rollId,dieIndex,value:values[i]}))}
  }
  return{frameId:frame.id,ownerId:row.option.ownerId,featureId:row.option.featureId,rerolls}
 }
 return undefined
}}}
