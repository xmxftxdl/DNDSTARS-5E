import type{Character}from'../types/character'
import type{BattleMap}from'../store/maps'
import type{GridCell}from'./gridCombat'
import{tokenCenterForAnchorCell}from'./gridCombat'
import{mapGeometryTerrainElevationAtPoint,type MapGeometryState}from'./mapGeometry'
import{readDnd5ePluginTempestuousOriginalPreparation,readDnd5ePluginTempestuousPreparationOperation,type Dnd5ePluginTempestuousPreparation}from'../rulesets/dnd5e/tempestuousPluginOriginalPreparation'
import{readDnd5ePluginTempestuousNativeOperation,type Dnd5ePluginTempestuousNativeOperation}from'../rulesets/dnd5e/pluginSpellTransaction'
import{tempestuousPluginChoiceKey}from'../../shared/tempestuous-plugin-owner-choice.mjs'
import{dnd5ePluginFeatureDefinition,dnd5ePluginFeatureCurrentEnvelopeFullV1}from'../rulesets/dnd5e/pluginApi'
import{planDnd5eTempestuousSpellFlight}from'../rulesets/dnd5e/tempestuousSpellFlight'
interface ChoiceRequest{
 id:string;transactionId:string;mapId:string;actor:Pick<Character,'id'>;pluginId:string;featureId:string;featureName:string;
 prompt:string;audience:'actor';options:Array<{id:string;label:string}>;defaultOptionId:string;timeoutMs:number;
 movementChoice?:{actorTokenId:string;originTokenId:string;rangeFeet:number;label:string};onMovementCell?:(cell:GridCell)=>void
}
/** Owner presentation for a real native pending frame. This never establishes
 * a source, native occurrence, raw die, original parent or publication permit. */
export function createPluginTempestuousOwnerRoomChoices(input:{map:BattleMap;geometry?:MapGeometryState|null;characters:()=>readonly Character[];parentTransactionId:()=>string|null|undefined;authorityUnchanged:()=>boolean;choose:(request:ChoiceRequest)=>Promise<string|undefined>}){
 return async(preparation:Dnd5ePluginTempestuousPreparation,operation:Dnd5ePluginTempestuousNativeOperation)=>{
  const held=readDnd5ePluginTempestuousOriginalPreparation(preparation),native=readDnd5ePluginTempestuousNativeOperation(operation),frame=held.frame,state=native.state
  if(readDnd5ePluginTempestuousPreparationOperation(preparation)!==operation||frame.timing!==native.phase||frame.parentId!==native.transaction.id||frame.actorId!==native.action.actorId||frame.spellId!==native.action.spell.spellId||frame.slotLevel!==native.action.spell.slotLevel)throw Error('plugin-tempestuous-room:same-actual-native-phase-required')
  const guard=()=>{readDnd5ePluginTempestuousOriginalPreparation(preparation);readDnd5ePluginTempestuousNativeOperation(operation);if(!input.authorityUnchanged()||input.parentTransactionId()!==frame.parentId)throw Error('plugin-tempestuous-room:stale-parent')};guard()
  const entries=frame.options.map(option=>({option,feature:dnd5ePluginFeatureDefinition(option.featureId)})),signature=JSON.stringify(entries)
  const current=()=>{guard();const next=frame.options.map(option=>({option,feature:dnd5ePluginFeatureDefinition(option.featureId)}));if(JSON.stringify(next)!==signature||next.some(row=>!row.feature||!dnd5ePluginFeatureCurrentEnvelopeFullV1(row.option.featureId)))throw Error('plugin-tempestuous-room:changed-source')};current()
  const actor=input.map.tokens.find(token=>token.id===frame.actorId),owner=input.characters().find(character=>character.id===actor?.characterId)
  if(!actor||!owner||!state.combatants[actor.id]||actor.x!==frame.origin.x||actor.y!==frame.origin.y)throw Error('plugin-tempestuous-room:canonical-owner-and-origin-required')
  const key=tempestuousPluginChoiceKey(frame.id)
  for(const entry of entries){const feature=entry.feature!,common={transactionId:frame.parentId,mapId:input.map.id,actor:owner,pluginId:feature.ownerPluginId,featureId:feature.id,featureName:feature.name,audience:'actor' as const,defaultOptionId:'pending',timeoutMs:120_000}
   const use=await input.choose({...common,id:key+':'+feature.id+':use',prompt:'是否在本次至少一环法术施放'+(frame.timing==='before'?'前':'后')+'，使用附赠动作飞行至多10尺？这段飞行不会触发借机攻击。',options:[{id:'pending',label:'稍后处理'},{id:'decline',label:frame.timing==='before'?'跳过施法前飞行':'跳过施法后飞行'},{id:'use',label:frame.timing==='before'?'施法前飞行':'施法后飞行'}]});current();if(use==='decline')continue;if(use!=='use')throw Error('plugin-tempestuous-room:decision-pending')
   let cell:GridCell|undefined
   const selected=await input.choose({...common,id:key+':'+feature.id+':destination',prompt:'在自己的地图上选择本次飞行终点；随后选择合法高度。',options:[{id:'pending',label:'稍后处理'},{id:'decline',label:'取消本次飞行'},{id:'select-cell',label:'选择飞行终点'}],movementChoice:{actorTokenId:actor.id,originTokenId:actor.id,rangeFeet:10,label:feature.name+' · '+(frame.timing==='before'?'施法前飞行':'施法后飞行')},onMovementCell:next=>{cell=next}});current();if(selected==='decline')return undefined;if(selected!=='select-cell'||!cell)throw Error('plugin-tempestuous-room:destination-pending')
   const to=tokenCenterForAnchorCell(cell,actor,input.map),ground=mapGeometryTerrainElevationAtPoint(input.geometry??undefined,to),heights=[...new Set([ground,frame.origin.elevationFeet,...[-10,-5,5,10].map(delta=>frame.origin.elevationFeet+delta)])].sort((a,b)=>a-b).filter(elevationFeet=>planDnd5eTempestuousSpellFlight({map:input.map,actorToken:actor,geometry:input.geometry,intent:{timing:frame.timing,featureId:feature.id,to,elevationFeet}}).ok)
   if(!heights.length)throw Error('plugin-tempestuous-room:no-legal-native-destination')
   let elevationFeet=heights[0]
   {const height=await input.choose({...common,id:key+':'+feature.id+':height',prompt:'选择本次飞行终点高度；飞行结束后仍会正常结算失去飞行速度和坠落。',options:[{id:'pending',label:'稍后处理'},{id:'decline',label:'取消本次飞行'},...heights.map(value=>({id:String(value),label:value===ground?'地面 · '+value+' 尺':'空间 · '+value+' 尺'}))]});current();if(height==='decline')return undefined;if(height===undefined||height==='pending'||!heights.includes(Number(height)))throw Error('plugin-tempestuous-room:height-pending');elevationFeet=Number(height)}
   return{frameId:frame.id,timing:frame.timing,featureId:feature.id,to,elevationFeet}
  }
  return undefined
 }
}
