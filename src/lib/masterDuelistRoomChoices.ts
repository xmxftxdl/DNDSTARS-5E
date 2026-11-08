import type { Character } from '../types/character'
import type { BattleMap } from '../store/maps'
import type { Dnd5eDamageReactionFlowOptions } from '../rulesets/dnd5e/damageReactionFlow'
import { dnd5ePluginFeatureDefinition } from '../rulesets/dnd5e/pluginApi'
interface ChoiceRequest { id:string;transactionId:string;mapId:string;actor:Pick<Character,'id'>;pluginId:string;featureId:string;featureName:string;prompt:string;audience:'actor';options:Array<{id:string;label:string}>;defaultOptionId:string;timeoutMs:number }
interface PoolOwner { durableRollRequestId:string;rollerTokenId:string;rollerCharacterId?:string;skipChoiceReroll:true;d20RollKind?:'attack';d20RollMode?:'normal'|'advantage'|'disadvantage';rollKind:'attack'|'damage' }
type Ports=Pick<Dnd5eDamageReactionFlowOptions,'chooseMasterDuelist'|'rollMasterDuelistDamage'|'chooseMasterDuelistDefense'>
/** Only the actual suspended native parent supplies a frame. This adapter asks
 * its canonical owner and rolls a new complete pool; it never changes the world. */
export function createMasterDuelistRoomChoiceDriver(input:{
 map:BattleMap;characters:()=>readonly Character[];parentTransactionId:()=>string|null|undefined;
 choose:(request:ChoiceRequest)=>Promise<string|undefined>;
 rollDice:(count:number,sides:number,label:string,targetName:string,owner:PoolOwner)=>Promise<readonly number[]>;
 shield:(input:Parameters<NonNullable<Dnd5eDamageReactionFlowOptions['chooseMasterDuelistDefense']>>[0])=>Promise<Awaited<ReturnType<NonNullable<Dnd5eDamageReactionFlowOptions['chooseMasterDuelistDefense']>>>>;
 authorityUnchanged:()=>boolean;
}):Ports{
 const guard=(parentId?:string)=>{if(!input.authorityUnchanged()||!input.parentTransactionId()||(parentId&&input.parentTransactionId()!==parentId))throw Error('master-duelist-room:stale-parent')}
 const characterFor=(id:string)=>{const token=input.map.tokens.find(row=>row.id===id);return input.characters().find(row=>row.id===token?.characterId)}
 const identity=(id:string)=>{let a=2166136261,b=2246822519;for(let i=0;i<id.length;i++){a=Math.imul(a^id.charCodeAt(i),16777619);b=Math.imul(b^id.charCodeAt(i),3266489917)}return 'master-duelist:'+ (a>>>0).toString(36)+(b>>>0).toString(36)}
 const validate=(values:readonly number[],count:number,sides:number)=>{if(values.length!==count||values.some(v=>!Number.isInteger(v)||v<1||v>sides))throw Error('master-duelist-room:invalid-whole-pool');return [...values]}
 return {
  chooseMasterDuelist:async ({frame,state})=>{
   guard(frame.parentId);const actor=characterFor(frame.actorId);if(!actor)throw Error('master-duelist-room:canonical-actor-required');
   const definitions=frame.options.map(option=>({option,feature:dnd5ePluginFeatureDefinition(option.featureId)}));
   if(!definitions.length||definitions.some(row=>!row.feature))throw Error('master-duelist-room:current-source-required');
   const key=identity(frame.id),first=definitions[0].feature!;
   const selected=await input.choose({id:key+':choice',transactionId:frame.parentId,mapId:input.map.id,actor,pluginId:first.ownerPluginId,featureId:first.id,featureName:first.name,prompt:'本次攻击未命中。是否使用剑术大师，重新掷整组攻击骰并获得优势？必须采用新结果；短休或长休后恢复。',audience:'actor',options:[{id:'pending',label:'稍后处理'},{id:'decline',label:'保留剑术大师'},...definitions.map(({feature})=>({id:feature!.id,label:'使用'+feature!.name}))],defaultOptionId:'pending',timeoutMs:60_000});
   guard(frame.parentId);if(selected==='decline')return undefined;
   const chosen=definitions.find(row=>row.option.featureId===selected);if(!chosen)throw Error('master-duelist-room:decision-pending');
   const count=frame.rerollMode.mode==='normal'?1:2;
   const values=await input.rollDice(count,20,'剑术大师·重掷攻击',state.combatants[frame.actorId]?.name??actor.name,{durableRollRequestId:key+':whole-pool',rollerTokenId:frame.actorId,rollerCharacterId:actor.id,skipChoiceReroll:true,d20RollKind:'attack',d20RollMode:frame.rerollMode.mode,rollKind:'attack'});
   guard(frame.parentId);return {frameId:frame.id,featureId:chosen.option.featureId,rolls:validate(values,count,20)};
  },
  rollMasterDuelistDamage:async request=>{
   guard();const parent=input.parentTransactionId()!,actor=characterFor(request.actorId);
   const values=await input.rollDice(request.count,request.sides,'剑术大师·新增伤害',actor?.name??request.actorId,{durableRollRequestId:identity(request.id)+':damage',rollerTokenId:request.actorId,rollerCharacterId:actor?.id,skipChoiceReroll:true,rollKind:'damage'});
   guard(parent);return validate(values,request.count,request.sides);
  },
  chooseMasterDuelistDefense:async selection=>{
   guard();const parent=input.parentTransactionId()!;if(!selection.request.shieldAvailable)return {};
   const choice=await input.shield(selection);guard(parent);return choice;
  },
 }
}
