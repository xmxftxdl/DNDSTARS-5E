import type{AttackResolution}from'../contracts'
import type{Dnd5eCombatEvent,Dnd5eHeadlessCombatState,Dnd5eSpellcastingSavingThrowRoll,Dnd5ePostD20AdjustmentUse,Dnd5eSpellForcedMovement}from'./headlessCombatEngine'
import{dnd5eCombatantClassLevel,dnd5eCombatantHasSubclass}from'./headlessCombatPrimitives'
import{dnd5ePluginFeatureDefinition,dnd5ePluginFeatureCurrentEnvelopeFullV1}from'./pluginApi'
import{dnd5eIsIncapacitated,dnd5eReactionsPrevented}from'./passiveDefenses'
import{dnd5eClassDefinition}from'./classes'
import{dnd5e2014Adapter as rules}from'./dnd5e2014Adapter'
type Hit=Extract<Dnd5eCombatEvent,{type:'attack-resolved'}>
export function stormFuryHitOptions(state:Dnd5eHeadlessCombatState,event:Hit){
 const owner=state.combatants[event.targetId],attacker=state.combatants[event.actorId]
 if(!event.hit||!(event.attackMode==='melee'||event.attackMode==='unarmed'||event.attackDelivery==='melee')||!owner||!attacker||owner.id===attacker.id||owner.currentHp<=0||owner.deathSaves.dead||!owner.turn.reactionAvailable||dnd5eIsIncapacitated(owner)||dnd5eReactionsPrevented(owner))return[]
 const level=dnd5eCombatantClassLevel(owner,'sorcerer'),ability=dnd5eClassDefinition('sorcerer')?.spellcasting?.ability;if(level<14||ability!=='cha')return[]
 return owner.pluginFeatureIds.flatMap(featureId=>{const feature=dnd5ePluginFeatureDefinition(featureId),declaration=feature?.declarativeAbility
  if(!feature||!dnd5ePluginFeatureCurrentEnvelopeFullV1(featureId)||feature.automation!=='full'||declaration?.automation!=='full'||declaration.mechanic?.kind!=='storm-fury'||declaration.level!==14||feature.sourceClassId!=='sorcerer'||!feature.sourceSubclassId||!dnd5eCombatantHasSubclass(owner,'sorcerer',feature.sourceSubclassId)||declaration.cost?.economy!=='reaction')return[]
  return[{featureId,ownerId:owner.id,attackerId:attacker.id,sorcererLevel:level,damage:level,damageType:'lightning' as const,saveAbility:'str' as const,saveDc:8+rules.proficiencyBonus(owner.level)+rules.abilityModifier(owner.abilities[ability]),maximumPushFeet:20 as const}]
 })
}
export interface StormFuryHitFrame{index:number;event:Hit;attack:AttackResolution;options:ReturnType<typeof stormFuryHitOptions>}
export type StormFurySavingThrow=Pick<Dnd5eSpellcastingSavingThrowRoll,'d20'|'d20Second'|'halflingLuckyD20'|'halflingLuckyD20Second'|'blessRoll'|'baneRoll'|'rerollResourceKey'|'rerollD20'|'rerollD20Second'|'bardicInspirationRoll'|'darkOnesOwnLuckRoll'|'optionalBonusDice'>&{legendaryResistance?:boolean;postD20Adjustment?:Dnd5ePostD20AdjustmentUse}
export interface StormFuryHitChoice{frameIndex:number;featureId:string;savingThrow?:StormFurySavingThrow;forcedMovement?:Dnd5eSpellForcedMovement}
type Listener=(frame:StormFuryHitFrame,snapshot:Dnd5eHeadlessCombatState)=>StormFuryHitChoice|undefined|void
let active:{listener:Listener;index:number;pending:{state:Dnd5eHeadlessCombatState;event:Hit;attack:AttackResolution}[];interrupted?:boolean;error?:unknown}|undefined
/** Native capture seam only. A frame/JSON is not Room or publication permission.
 * Reaction application and authenticated Session continuation remain separate. */
export function withStormFuryHitCheckpoints<T>(listener:Listener,run:()=>T):T{const prior=active;active={listener,index:0,pending:[]};try{return run()}finally{active=prior}}
export function visitStormFuryHitCheckpoint(state:Dnd5eHeadlessCombatState,event:Hit,attack:AttackResolution){if(!active||!stormFuryHitOptions(state,event).length)return;active.pending.push({state,event,attack})}
/** Capture witnesses are filtered only after native hit consequences. No DTO grants authority. */
export interface StormFuryMaterialRequest{readonly kind:'saving-throw'|'push';readonly frame:StormFuryHitFrame;readonly featureId:string}
export interface StormFuryMaterialPorts{savingThrow:(request:Readonly<StormFuryMaterialRequest>,snapshot:Dnd5eHeadlessCombatState)=>StormFurySavingThrow;push?:(request:Readonly<StormFuryMaterialRequest>,snapshot:Dnd5eHeadlessCombatState)=>Dnd5eSpellForcedMovement|undefined}
let materialPorts:StormFuryMaterialPorts|undefined
const nativeEffectFrames=new WeakSet<StormFuryHitFrame>()
/** Native material callbacks carry no Room, raw-roll, or publication permission. */
export function withStormFuryMaterialPorts<T>(ports:StormFuryMaterialPorts,run:()=>T):T{const previous=materialPorts;materialPorts=ports;try{return run()}finally{materialPorts=previous}}
function nativeMaterial<T>(frame:StormFuryHitFrame,state:Dnd5eHeadlessCombatState,featureId:string,kind:StormFuryMaterialRequest['kind'],run:(request:Readonly<StormFuryMaterialRequest>,snapshot:Dnd5eHeadlessCombatState)=>T):T{
 if(!nativeEffectFrames.has(frame)||!active||!frame.options.some(option=>option.featureId===featureId))throw Error('storm-fury:actual-inflight-hit-required')
 const signature=JSON.stringify(state),source=JSON.stringify(dnd5ePluginFeatureDefinition(featureId)),request=freezeStormFuryDisplayFrame({kind,frame:structuredClone(frame),featureId}),reply=run(request,structuredClone(state))
 if(signature!==JSON.stringify(state)||source!==JSON.stringify(dnd5ePluginFeatureDefinition(featureId)))throw Error('storm-fury:unchanged-native-material-source-required')
 return reply===undefined?reply:structuredClone(reply)
}
export function readStormFurySavingMaterial(frame:StormFuryHitFrame,state:Dnd5eHeadlessCombatState,featureId:string,precollected?:StormFurySavingThrow):StormFurySavingThrow{
 if(!nativeEffectFrames.has(frame)||!active)throw Error('storm-fury:actual-inflight-hit-required');const roll=materialPorts?nativeMaterial(frame,state,featureId,'saving-throw',materialPorts.savingThrow):precollected
 if(!roll||typeof roll!=='object'||Object.keys(roll).some(key=>!['d20','d20Second','halflingLuckyD20','halflingLuckyD20Second','blessRoll','baneRoll','rerollResourceKey','rerollD20','rerollD20Second','bardicInspirationRoll','darkOnesOwnLuckRoll','optionalBonusDice','legendaryResistance','postD20Adjustment'].includes(key)))throw Error('storm-fury:actual-saving-material-required')
 return roll
}
export function readStormFuryPushMaterial(frame:StormFuryHitFrame,state:Dnd5eHeadlessCombatState,featureId:string,precollected?:Dnd5eSpellForcedMovement):Dnd5eSpellForcedMovement|undefined{if(!nativeEffectFrames.has(frame)||!active)throw Error('storm-fury:actual-inflight-hit-required');return materialPorts?.push?nativeMaterial(frame,state,featureId,'push',materialPorts.push):precollected}
function freezeStormFuryDisplayFrame<T>(value:T,seen=new WeakSet<object>()):T{if(value&&typeof value==='object'&&!seen.has(value)){seen.add(value);for(const key of Reflect.ownKeys(value)){const descriptor=Object.getOwnPropertyDescriptor(value,key);if(descriptor&&'value'in descriptor)freezeStormFuryDisplayFrame(descriptor.value,seen)}Object.freeze(value)}return value}
export function completeStormFuryHitCheckpoints(state:Dnd5eHeadlessCombatState,apply:(frame:StormFuryHitFrame,choice:StormFuryHitChoice)=>void){if(!active)return;const scope=active,rows=scope.pending.filter(row=>row.state===state);scope.pending=scope.pending.filter(row=>row.state!==state);for(const row of rows){const options=stormFuryHitOptions(state,row.event);if(!options.length)continue;const signature=JSON.stringify(state),sources=new Map(options.map(option=>[option.featureId,JSON.stringify(dnd5ePluginFeatureDefinition(option.featureId))]));try{const frame:StormFuryHitFrame={index:scope.index++,event:structuredClone(row.event),attack:structuredClone(row.attack),options:structuredClone(options)},choice=scope.listener(freezeStormFuryDisplayFrame(structuredClone(frame)),structuredClone(state));if(!choice)continue;if(active!==scope||JSON.stringify(state)!==signature||!choice||typeof choice!=='object'||Object.keys(choice).some(key=>!['frameIndex','featureId','savingThrow','forcedMovement'].includes(key))||choice.frameIndex!==frame.index||!options.some(option=>option.featureId===choice.featureId)||!choice.savingThrow&&!materialPorts||choice.savingThrow!==undefined&&(typeof choice.savingThrow!=='object'||Object.keys(choice.savingThrow).some(key=>!['d20','d20Second','halflingLuckyD20','halflingLuckyD20Second','blessRoll','baneRoll','rerollResourceKey','rerollD20','rerollD20Second','bardicInspirationRoll','darkOnesOwnLuckRoll','optionalBonusDice','legendaryResistance','postD20Adjustment'].includes(key))))throw Error('storm-fury:current-issued-choice-required');if(!stormFuryHitOptions(state,row.event).some(option=>option.featureId===choice.featureId)||JSON.stringify(dnd5ePluginFeatureDefinition(choice.featureId))!==sources.get(choice.featureId))throw Error('storm-fury:current-source-required');nativeEffectFrames.add(frame);try{apply(frame,structuredClone(choice))}finally{nativeEffectFrames.delete(frame)}}catch(error){scope.error=error;scope.interrupted=true;throw error}}}
export function rethrowStormFuryHitInterruption(){if(active?.interrupted)throw active.error}
