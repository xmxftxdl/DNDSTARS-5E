import type{Character}from'../types/character'
import type{BattleMap}from'../store/maps'
import type{GridCell}from'./gridCombat'
import{tokenAnchorCellFromPixel,tokenCenterForAnchorCell,tokenOccupiedCellsAt,mapCellExtent}from'./gridCombat'
import{mapGeometryMovementBlocked,mapGeometryTerrainElevationAtPoint,mapGeometryTokenElevation,type MapGeometryState}from'./mapGeometry'
import{requestSharedStormFuryOwner,requestSharedStormFuryPush}from'./sharedApi'
import{readDnd5eStormFuryOriginalOperation,type Dnd5eStormFuryOriginalOperation}from'../rulesets/dnd5e/damageCommitSession'
import type{Dnd5eDamageReactionFlowOptions}from'../rulesets/dnd5e/damageReactionFlow'
import{captureStormFuryOriginalPreparation}from'../rulesets/dnd5e/stormFuryOriginalPreparation'
import{captureStormFurySavingOriginalPreparation}from'../rulesets/dnd5e/stormFurySavingOriginalPreparation'
import{captureStormFuryPushOriginalPreparation}from'../rulesets/dnd5e/stormFuryPushOriginalPreparation'
import{createStormFurySavingDiceRoutes,readStormFurySavingDiceRoute,type StormFurySavingDiceRoute}from'../rulesets/dnd5e/stormFurySavingDiceRoute'
import{dnd5ePluginFeatureDefinition,dnd5ePluginFeatureCurrentEnvelopeFullV1}from'../rulesets/dnd5e/pluginApi'
import{dnd5eMonsterForcedMovementPayloadIsValid}from'../rulesets/dnd5e/monsterForcedMovement'
import{dnd5eCombatantCanRemainAirborne,type Dnd5eHeadlessCombatState,type Dnd5eSpellForcedMovement}from'../rulesets/dnd5e/headlessCombatEngine'
import{dnd5eFallingDamageDice}from'../rulesets/dnd5e/traversal'
interface ChoiceRequest{id:string;transactionId:string;mapId:string;actor:Pick<Character,'id'>;pluginId:string;featureId:string;featureName:string;prompt:string;audience:'actor';options:Array<{id:string;label:string}>;defaultOptionId:string;timeoutMs:number;phase:'before-condition'|'after-save';context:Record<string,unknown>;movementChoice?:{actorTokenId:string;originTokenId:string;rangeFeet:number;label:string;allowedCells:readonly GridCell[]};onMovementCell?:(cell:GridCell)=>void}
interface PoolOwner{durableRollRequestId:string;rollerTokenId:string;rollerCharacterId?:string;stormFurySavingDice?:StormFurySavingDiceRoute;skipChoiceReroll:true;d20RollKind?:'saving-throw';d20RollMode?:'normal'|'advantage'|'disadvantage';rollKind:'saving-throw'|'damage'}
type Ports=Pick<Dnd5eDamageReactionFlowOptions,'enableStormFuryHit'|'chooseStormFuryOwner'|'rollStormFurySaving'|'chooseStormFuryPush'>
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
export function createStormFuryRoomChoiceDriver(input:{map:BattleMap;geometry?:MapGeometryState|null;characters:()=>readonly Character[];parentTransactionId:()=>string|null|undefined;authorityUnchanged:()=>boolean;choose:(request:ChoiceRequest)=>Promise<string|undefined>;rollDice:(count:number,sides:number,label:string,targetName:string,owner:PoolOwner)=>Promise<readonly number[]>;ownerRpc?:typeof requestSharedStormFuryOwner;pushRpc?:typeof requestSharedStormFuryPush;savingRpc?:Parameters<typeof createStormFurySavingDiceRoutes>[1];collectLateSaving?:(selection:{operation:Dnd5eStormFuryOriginalOperation;request:NonNullable<Parameters<NonNullable<Dnd5eDamageReactionFlowOptions['rollStormFurySaving']>>[0]>['request'];state:Dnd5eHeadlessCombatState;initial:Awaited<ReturnType<Awaited<ReturnType<typeof createStormFurySavingDiceRoutes>>['read']>>})=>Promise<Awaited<ReturnType<Awaited<ReturnType<typeof createStormFurySavingDiceRoutes>>['read']>>>}):Ports{
 const current=(operation:Dnd5eStormFuryOriginalOperation)=>{const native=readDnd5eStormFuryOriginalOperation(operation);if(!input.authorityUnchanged()||input.parentTransactionId()!==native.result.parentId)throw Error('storm-fury-room:stale-parent');return native}
 const id=(p:{parentId:string;mapId:string;combatId:string;frameIndex:number})=>({parentId:p.parentId,mapId:p.mapId,combatId:p.combatId,frameIndex:p.frameIndex})
 const owner=(tokenId:string)=>{const token=input.map.tokens.find(t=>t.id===tokenId),character=input.characters().find(c=>c.id===token?.characterId);if(!token||!character)throw Error('storm-fury-room:canonical-owner-required');return character}
 const feature=(featureId:string)=>{const value=dnd5ePluginFeatureDefinition(featureId);if(!value||!dnd5ePluginFeatureCurrentEnvelopeFullV1(featureId))throw Error('storm-fury-room:current-full-source-required');return value}
 return{enableStormFuryHit:true,
  chooseStormFuryOwner:async selection=>{
   const native=current(selection.originalOperation);if(native.result.status!=='pending-storm-fury-owner'||!equal(selection.frame,native.result.frame)||!equal(selection.state,native.result.snapshot))throw Error('storm-fury-room:actual-owner-phase-required')
   const source=captureStormFuryOriginalPreparation(selection.originalOperation),identity=id(source),rpc=input.ownerRpc??requestSharedStormFuryOwner,prepared=await rpc('prepare',source);current(selection.originalOperation)
   const windowId='storm-fury-owner:'+JSON.stringify([source.parentId,source.frameIndex]);if(prepared.ok!==true||prepared.windowId!==windowId)throw Error('storm-fury-room:actual-owner-window-required')
   const actor=owner(source.frame.event.targetId),entries=source.frame.options.map(o=>({option:o,definition:feature(o.featureId)})),first=entries[0].definition
   const selected=await input.choose({id:windowId,transactionId:source.parentId,mapId:source.mapId,actor,pluginId:first.ownerPluginId,featureId:first.id,featureName:first.name,prompt:'本次近战命中已完成。是否使用反应，让攻击者受到等于术士等级的闪电伤害，并进行力量豁免？',audience:'actor',options:[{id:'pending',label:'稍后处理'},{id:'decline',label:'保留反应'},...entries.map(e=>({id:e.option.featureId,label:'使用'+e.definition.name}))],defaultOptionId:'pending',timeoutMs:120_000,phase:'before-condition',context:{stormFuryOwner:identity}});current(selection.originalOperation)
   const decision=selected==='decline'?{kind:'decline'}:entries.some(e=>e.option.featureId===selected)?{kind:'use',featureId:selected}:undefined;if(!decision)throw Error('storm-fury-room:owner-decision-pending')
   const actual=await rpc('decision',identity);current(selection.originalOperation);if(actual.ok!==true||actual.frameIndex!==source.frameIndex||!equal(actual.decision,decision))throw Error('storm-fury-room:authenticated-owner-decision-required')
   return decision.kind==='decline'?undefined:{frameIndex:source.frameIndex,featureId:decision.featureId!}
  },
  rollStormFurySaving:async selection=>{
   const native=current(selection.originalOperation);if(native.result.status!=='pending-storm-fury-saving'||!equal(selection.request,native.result.request)||!equal(selection.state,native.result.snapshot))throw Error('storm-fury-room:actual-saving-phase-required')
   const source=captureStormFurySavingOriginalPreparation(selection.originalOperation),handle=await createStormFurySavingDiceRoutes(selection.originalOperation,input.savingRpc)
   for(const route of handle.routes){const spec=await readStormFurySavingDiceRoute(route);current(selection.originalOperation);const values=await input.rollDice(spec.count,spec.sides,spec.key==='original'?'风暴之怒：力量豁免':spec.key==='bless'?'风暴之怒：祝福术':'风暴之怒：灾祸术',selection.state.combatants[spec.rollerTokenId]?.name??spec.rollerTokenId,{durableRollRequestId:spec.requestId,rollerTokenId:spec.rollerTokenId,rollerCharacterId:spec.characterId??undefined,stormFurySavingDice:route,skipChoiceReroll:true,rollKind:'saving-throw',...(spec.key==='original'?{d20RollKind:'saving-throw' as const,d20RollMode:source.mode}:{})});current(selection.originalOperation);const stored=await readStormFurySavingDiceRoute(route);if(!stored.values||!equal(stored.values,values))throw Error('storm-fury-room:actual-private-adopted-pool-required')}
   const initial=await handle.read();current(selection.originalOperation);if(!input.collectLateSaving)return initial
   const result=await input.collectLateSaving({operation:selection.originalOperation,request:selection.request,state:selection.state,initial});current(selection.originalOperation);return result
  },
  chooseStormFuryPush:async selection=>{
   const native=current(selection.originalOperation);if(native.result.status!=='pending-storm-fury-push'||!equal(selection.request,native.result.request)||!equal(selection.state,native.result.snapshot))throw Error('storm-fury-room:actual-failed-push-phase-required')
   const source=captureStormFuryPushOriginalPreparation(selection.originalOperation),identity=id(source),rpc=input.pushRpc??requestSharedStormFuryPush,prepared=await rpc('prepare',source);current(selection.originalOperation)
   const windowId='storm-fury-push:'+JSON.stringify([source.parentId,source.frameIndex]);if(prepared.ok!==true||prepared.windowId!==windowId)throw Error('storm-fury-room:actual-push-window-required')
   const map={...input.map,tokens:input.map.tokens.map(token=>{const c=selection.state.combatants[token.id];return c?{...token,x:c.position.x,y:c.position.y,hp:c.currentHp,elevationFeet:c.elevationFeet,groundElevationFeet:c.groundElevationFeet}:token})},frame=source.request.frame,actor=selection.state.combatants[frame.event.targetId],target=selection.state.combatants[frame.event.actorId],token=map.tokens.find(t=>t.id===target.id)!,grid=selection.state.gridDistance,feet=grid?.feetPerCell??map.feetPerCell??5,cellUnits=grid?.cellUnits??map.gridSize
   if(!token||!actor||!target||!Number.isFinite(feet)||feet<=0||!Number.isFinite(cellUnits)||cellUnits<=0)throw Error('storm-fury-room:actual-push-geometry-required')
   const anchor=tokenAnchorCellFromPixel(token.x,token.y,token,map),radius=Math.ceil(20/feet)+1,extent=mapCellExtent(map),allowed:GridCell[]=[],moves=new Map<string,{movement:Dnd5eSpellForcedMovement;fallDice:number}>(),height=target.elevationFeet??target.groundElevationFeet??0
   for(let row=anchor.row-radius;row<=anchor.row+radius;row++)for(let col=anchor.col-radius;col<=anchor.col+radius;col++){
    const cell={col,row},to=tokenCenterForAnchorCell(cell,token,map),distanceFeet=Math.max(Math.abs(to.x-target.position.x),Math.abs(to.y-target.position.y))/cellUnits*feet;if(distanceFeet<=0)continue
    const base={targetId:target.id,to,distanceFeet};if(!dnd5eMonsterForcedMovementPayloadIsValid({source:actor.position,target:target.position,movement:base,direction:'away-from-source',maximumDistanceFeet:20,resisted:false,gridDistance:grid?{cellUnits:grid.cellUnits,feetPerCell:grid.feetPerCell,sourceFootprintCells:grid.footprintCellsByCombatantId?.[actor.id],targetFootprintCells:grid.footprintCellsByCombatantId?.[target.id]}:undefined,coordinateUnitsPerFoot:selection.state.coordinateUnitsPerFoot}))continue
    const cells=tokenOccupiedCellsAt(token,map,to);if(cells.some(c=>c.col<0||c.row<0||c.col>=extent.cols||c.row>=extent.rows))continue
    const ground=mapGeometryTerrainElevationAtPoint(input.geometry??undefined,to);if(ground>height+1e-4||mapGeometryMovementBlocked({map,geometry:input.geometry??undefined,token,to,fromElevationFeet:height,toElevationFeet:height}).blocked)continue
    const overlaps=map.tokens.some(other=>{if(other.id===token.id||other.dnd5eSpellEffect)return false;const bottom=mapGeometryTokenElevation(input.geometry??undefined,other);if(height>=bottom+Math.max(5,Math.max(1,other.size)*5)||bottom>=height+Math.max(5,Math.max(1,token.size)*5))return false;return tokenOccupiedCellsAt(other,map,other).some(p=>cells.some(c=>c.col===p.col&&c.row===p.row))});if(overlaps)continue
    const airborne=dnd5eCombatantCanRemainAirborne(target),movement:Dnd5eSpellForcedMovement={...base,toGroundElevationFeet:ground,...(!airborne?{toElevationFeet:ground}:{})},fallDice=airborne?0:dnd5eFallingDamageDice(Math.max(0,height-ground))
    allowed.push(cell);moves.set(JSON.stringify(cell),{movement,fallDice})
   }
   if(!allowed.length)return undefined
   const definition=feature(source.request.featureId),actorOwner=owner(frame.event.targetId);let chosen:GridCell|undefined
   const selected=await input.choose({id:windowId,transactionId:source.parentId,mapId:source.mapId,actor:actorOwner,pluginId:definition.ownerPluginId,featureId:definition.id,featureName:definition.name,prompt:'攻击者力量豁免失败。可将其沿远离你的直线推开至多20尺；也可不推离。',audience:'actor',options:[{id:'pending',label:'稍后处理'},{id:'decline',label:'不推离'},{id:'select-cell',label:'选择推离终点'}],defaultOptionId:'pending',timeoutMs:120_000,phase:'after-save',context:{stormFuryPush:identity},movementChoice:{actorTokenId:target.id,originTokenId:target.id,rangeFeet:20,label:definition.name+' · 推离',allowedCells:allowed},onMovementCell:cell=>{chosen=cell}});current(selection.originalOperation)
   const expected=selected==='decline'?{kind:'decline'}:selected==='select-cell'&&chosen?{kind:'push',cell:chosen}:undefined;if(!expected)throw Error('storm-fury-room:push-decision-pending')
   const answer=await rpc('decision',identity);current(selection.originalOperation);if(answer.ok!==true||!equal(answer.decision,expected))throw Error('storm-fury-room:authenticated-push-decision-required');if(expected.kind==='decline')return undefined
   const plan=moves.get(JSON.stringify(chosen));if(!plan)throw Error('storm-fury-room:actual-legal-push-cell-required')
   if(plan.fallDice){const rolls=await input.rollDice(plan.fallDice,6,'风暴之怒：推离后坠落',target.name,{durableRollRequestId:windowId+':fall',rollerTokenId:target.id,rollerCharacterId:token.characterId,skipChoiceReroll:true,rollKind:'damage'});current(selection.originalOperation);if(rolls.length!==plan.fallDice||rolls.some(n=>!Number.isInteger(n)||n<1||n>6))throw Error('storm-fury-room:actual-falling-dice-required');plan.movement.fallingDamageRolls=[...rolls]}
   return plan.movement
  },
 }
}
