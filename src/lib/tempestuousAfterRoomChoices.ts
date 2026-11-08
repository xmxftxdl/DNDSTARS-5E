import{readDnd5eTempestuousAfterSpellOriginalOperation}from'../rulesets/dnd5e/damageCommitSession'
import{verifySharedTempestuousAfterOwnerDecision}from'./sharedApi'
import{tokenAnchorCellFromPixel}from'./gridCombat'
import type{Character}from'../types/character'
import type{BattleMap}from'../store/maps'
import type{GridCell}from'./gridCombat'
import{tokenCenterForAnchorCell}from'./gridCombat'
import{mapGeometryTerrainElevationAtPoint,type MapGeometryState}from'./mapGeometry'
import type{Dnd5eDamageReactionFlowOptions}from'../rulesets/dnd5e/damageReactionFlow'
import{dnd5ePluginFeatureDefinition,dnd5ePluginFeatureCurrentEnvelopeFullV1}from'../rulesets/dnd5e/pluginApi'
import{planDnd5eTempestuousSpellFlight}from'../rulesets/dnd5e/tempestuousSpellFlight'
interface ChoiceRequest{
 id:string;transactionId:string;mapId:string;actor:Pick<Character,'id'>;pluginId:string;featureId:string;featureName:string;
 prompt:string;audience:'actor';options:Array<{id:string;label:string}>;defaultOptionId:string;timeoutMs:number;
 context?:Record<string,unknown>;movementChoice?:{actorTokenId:string;originTokenId:string;rangeFeet:number;label:string;allowedCells?:readonly GridCell[]};onMovementCell?:(cell:GridCell)=>void
}
/** Owner presentation for a real native pending frame. This never establishes
 * a source, native occurrence, raw die, original parent or publication permit. */
export function createTempestuousAfterRoomChoiceDriver(input:{map:BattleMap;geometry?:MapGeometryState|null;characters:()=>readonly Character[];parentTransactionId:()=>string|null|undefined;authorityUnchanged:()=>boolean;verify?:typeof verifySharedTempestuousAfterOwnerDecision;choose:(request:ChoiceRequest)=>Promise<string|undefined>}):Pick<Dnd5eDamageReactionFlowOptions,'chooseTempestuousAfterSpell'>{
 return{chooseTempestuousAfterSpell:async({frame,state,originalOperation})=>{
  const facts=readDnd5eTempestuousAfterSpellOriginalOperation(originalOperation);if(JSON.stringify(frame)!==JSON.stringify(facts.frame)||JSON.stringify(state)!==JSON.stringify(facts.snapshot))throw Error('tempestuous-after-room:actual-native-operation-required')
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(state)))
  const prefixSignature='sha256:'+Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')
  const verify=async(expected:Awaited<ReturnType<typeof verifySharedTempestuousAfterOwnerDecision>>)=>{const actual=await(input.verify??verifySharedTempestuousAfterOwnerDecision)({parentId:frame.parentId,mapId:input.map.id,combatId:state.combatId,frameId:frame.id});if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('tempestuous-after-room:authenticated-owner-decision-required');current()}

  const map={...input.map,tokens:input.map.tokens.map(token=>{const actor=state.combatants[token.id];return actor?{...token,x:actor.position.x,y:actor.position.y,elevationFeet:actor.elevationFeet,groundElevationFeet:actor.groundElevationFeet,hp:actor.currentHp}:token})}
  const guard=()=>{readDnd5eTempestuousAfterSpellOriginalOperation(originalOperation);if(!input.authorityUnchanged()||input.parentTransactionId()!==frame.parentId)throw Error('tempestuous-after-room:stale-parent')};guard()
  const entries=frame.options.map(option=>({option,feature:dnd5ePluginFeatureDefinition(option.featureId)})),signature=JSON.stringify(entries)
  const current=()=>{guard();const next=frame.options.map(option=>({option,feature:dnd5ePluginFeatureDefinition(option.featureId)}));if(JSON.stringify(next)!==signature||next.some(row=>!row.feature||!dnd5ePluginFeatureCurrentEnvelopeFullV1(row.option.featureId)))throw Error('tempestuous-after-room:changed-source')};current()
  const actor=map.tokens.find(token=>token.id===frame.actorId),owner=input.characters().find(character=>character.id===actor?.characterId)
  if(!actor||!owner||!state.combatants[actor.id]||actor.x!==frame.origin.x||actor.y!==frame.origin.y)throw Error('tempestuous-after-room:canonical-owner-and-origin-required')
  let hash=2166136261;for(const char of frame.id)hash=Math.imul(hash^char.charCodeAt(0),16777619);const key='tempestuous-after:'+(hash>>>0).toString(36)
  for(const entry of entries){const feature=entry.feature!,common={transactionId:frame.parentId,mapId:map.id,actor:owner,pluginId:feature.ownerPluginId,featureId:feature.id,featureName:feature.name,audience:'actor' as const,defaultOptionId:'pending',timeoutMs:120_000,context:{combatId:state.combatId,tempestuousAfter:{frame:structuredClone(frame),prefixSignature,effectTimestamp:facts.effectTimestamp}}}
   const use=await input.choose({...common,id:key+':'+feature.id+':use',prompt:'是否在本次至少一环法术施放后，使用附赠动作飞行至多10尺？这段飞行不会触发借机攻击。',options:[{id:'pending',label:'稍后处理'},{id:'decline',label:'跳过施法后飞行'},{id:'use',label:'施法后飞行'}]});current();if(use==='decline')continue;if(use!=='use')throw Error('tempestuous-after-room:decision-pending')
   const originalActor=input.map.tokens.find(token=>token.id===actor.id),stagedOrigin=originalActor?.x!==actor.x||originalActor?.y!==actor.y
   let allowedCells:GridCell[]|undefined
   if(stagedOrigin){
    const feet=map.feetPerCell??5;if(!Number.isFinite(feet)||feet<=0)throw Error('tempestuous-after-room:actual-map-scale-required')
    const anchor=tokenAnchorCellFromPixel(actor.x,actor.y,actor,map),radius=Math.ceil(10/feet)+1,cells:GridCell[]=[]
    for(let row=anchor.row-radius;row<=anchor.row+radius;row++)for(let col=anchor.col-radius;col<=anchor.col+radius;col++){
     const next={col,row},to=tokenCenterForAnchorCell(next,actor,map),ground=mapGeometryTerrainElevationAtPoint(input.geometry??undefined,to)
     const heights=[...new Set([ground,frame.origin.elevationFeet,...[-10,-5,5,10].map(delta=>frame.origin.elevationFeet+delta)])]
     if(heights.some(elevationFeet=>planDnd5eTempestuousSpellFlight({map,actorToken:actor,geometry:input.geometry,intent:{timing:'after',featureId:feature.id,to,elevationFeet}}).ok))cells.push(next)
    }
    allowedCells=cells;if(!allowedCells.length)throw Error('tempestuous-after-room:no-legal-native-destination')
   }
   let cell:GridCell|undefined
   const selected=await input.choose({...common,id:key+':'+feature.id+':destination',prompt:'在自己的地图上选择本次飞行终点；随后选择合法高度。',options:[{id:'pending',label:'稍后处理'},{id:'decline',label:'取消本次飞行'},{id:'select-cell',label:'选择飞行终点'}],movementChoice:{actorTokenId:actor.id,originTokenId:actor.id,rangeFeet:10,label:feature.name+' · 施法后飞行',...(allowedCells?{allowedCells}:{})},onMovementCell:next=>{cell=next}});current();if(selected==='decline'){await verify({kind:'decline'});return undefined};if(selected!=='select-cell'||!cell)throw Error('tempestuous-after-room:destination-pending')
   const to=tokenCenterForAnchorCell(cell,actor,map),ground=mapGeometryTerrainElevationAtPoint(input.geometry??undefined,to),heights=[...new Set([ground,frame.origin.elevationFeet,...[-10,-5,5,10].map(delta=>frame.origin.elevationFeet+delta)])].sort((a,b)=>a-b).filter(elevationFeet=>planDnd5eTempestuousSpellFlight({map:map,actorToken:actor,geometry:input.geometry,intent:{timing:'after',featureId:feature.id,to,elevationFeet}}).ok)
   if(!heights.length)throw Error('tempestuous-after-room:no-legal-native-destination')
   let elevationFeet=heights[0]
   {const height=await input.choose({...common,id:key+':'+feature.id+':height',prompt:'选择本次飞行终点高度；飞行结束后仍会正常结算失去飞行速度和坠落。',options:[{id:'pending',label:'稍后处理'},{id:'decline',label:'取消本次飞行'},...heights.map(value=>({id:String(value),label:value===ground?'地面 · '+value+' 尺':'空间 · '+value+' 尺'}))]});current();if(height==='decline'){await verify({kind:'decline'});return undefined};if(height===undefined||height==='pending'||!heights.includes(Number(height)))throw Error('tempestuous-after-room:height-pending');elevationFeet=Number(height)}
   await verify({kind:'use',selection:{frameId:frame.id,featureId:feature.id,cell,elevationFeet}})
   return{frameId:frame.id,featureId:feature.id,to,elevationFeet}
  }
  await verify({kind:'decline'});return undefined
 }}
}
