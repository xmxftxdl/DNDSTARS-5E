import{resolvePreparedDnd5eClassFeature}from'../../rulesets/dnd5e/classFeatureAction'
import{resolvePreparedDnd5eSpellCast}from'../../rulesets/dnd5e/spellAction'
import{createDnd5eParentEffectClock}from'../../rulesets/dnd5e/activeEffects'
import{resolvePreparedDnd5eEquipmentAttack}from'../../rulesets/dnd5e/equipmentAttackAction'
import{resolvePreparedDnd5eMonsterAttack}from'../../rulesets/dnd5e/monsterAttackAction'
import{createDnd5ePreparedDamageCommitSession}from'../../rulesets/dnd5e/damageCommitSession'
import{dnd5eIncomingAttackArmorClassOptions}from"../../application/combat/dnd5eCombatRules"
import type{IncomingAttackArmorClassChoice}from'../../rulesets/dnd5e/incomingAttackArmorClassCheckpoint'
import type{PostD20FeatureUseChoice}from'../../rulesets/dnd5e/postD20FeatureUseCheckpoint'
import{captureSecondChancePreparedOriginal,type SecondChancePreparedInput,type SecondChancePreparedResult}from'./secondChancePreparedParent'
export interface ArcanePreparedCheckpoint{readonly arcanePreparedCheckpoint:unique symbol}
export type ArcaneEquipmentInput=Parameters<typeof resolvePreparedDnd5eEquipmentAttack>[0]
export type ArcaneSpellAttackInput=Parameters<typeof resolvePreparedDnd5eSpellCast>[0]
export type ArcaneMonsterInput=Parameters<typeof resolvePreparedDnd5eMonsterAttack>[0]
function create(input:SecondChancePreparedInput,actualResolver:unknown,resolve:(input:SecondChancePreparedInput)=>SecondChancePreparedResult,parentId:string,execution?:Readonly<{now:number}>){
 const original=captureSecondChancePreparedOriginal(actualResolver,input);if(!original)throw Error('arcane-native:actual-prepared-codec-required')
 const baseline=input.prepared.state,clock=execution?createDnd5eParentEffectClock({parentId,sourceKey:'arcane-native:'+parentId,timestamp:execution.now}):undefined,session=createDnd5ePreparedDamageCommitSession(input,value=>clock?clock.run(()=>resolve(value)):resolve(value),()=>false),pending=session.run(baseline)
 if(pending.status!=='pending-incoming-armor-class'){session.cancel();throw Error('arcane-native:genuine-incoming-hit-required:'+pending.status)}
 const options=dnd5eIncomingAttackArmorClassOptions(pending.snapshot,pending.facts.event);if(!options.length){session.cancel();throw Error('arcane-native:current-own-source-required')}
 return{input,original,baseline,session,pending,options}
}
const frames=new WeakMap<object,ReturnType<typeof create>>()
export function captureArcaneEquipmentCheckpoint(input:ArcaneEquipmentInput,execution?:Readonly<{now:number}>):ArcanePreparedCheckpoint{const value=create(input as unknown as SecondChancePreparedInput,resolvePreparedDnd5eEquipmentAttack,v=>resolvePreparedDnd5eEquipmentAttack(v as unknown as ArcaneEquipmentInput,execution),input.prepared.action.id,execution),frame=Object.freeze({})as ArcanePreparedCheckpoint;frames.set(frame,value);return frame}
/** Separate concrete native facade factory, never an arbitrary resolver payload. */
export function captureArcaneMonsterCheckpoint(input:ArcaneMonsterInput,execution:Readonly<{now:number}>):ArcanePreparedCheckpoint{if(!input.transactionId)throw Error('arcane-native:original-monster-parent-required');const value=create(input as unknown as SecondChancePreparedInput,resolvePreparedDnd5eMonsterAttack,v=>resolvePreparedDnd5eMonsterAttack(v as unknown as ArcaneMonsterInput,execution),input.transactionId,execution),frame=Object.freeze({})as ArcanePreparedCheckpoint;frames.set(frame,value);return frame}
function read(frame:ArcanePreparedCheckpoint){const value=frames.get(frame);if(!value)throw Error('arcane-native:actual-checkpoint-brand-required');return value}
export function readArcaneEquipmentCheckpoint(frame:ArcanePreparedCheckpoint){const value=read(frame);return structuredClone({original:value.original,context:{map:value.input.prepared.map,characters:value.input.prepared.characters,characterIdByCombatantId:value.input.prepared.characterIdByCombatantId},baseline:value.baseline,facts:value.pending.facts,occurrence:value.pending.occurrence,options:value.options})}
export function resumeArcaneEquipmentCheckpoint(frame:ArcanePreparedCheckpoint,choice?:IncomingAttackArmorClassChoice){const value=read(frame);return remember(value,value.session.resumeIncomingArmorClass(value.baseline,value.pending.occurrence,value.pending.facts,choice))}
export function resumeArcaneEquipmentShroud(frame:ArcanePreparedCheckpoint,pending:Extract<ReturnType<ReturnType<typeof create>['session']['run']>,{status:'pending-post-d20-feature-use'}>,choice?:PostD20FeatureUseChoice){const value=read(frame);return remember(value,value.session.resumePostD20FeatureUse(value.baseline,pending.occurrence,pending.request,choice))}

/** Real spell-attack facade; the original spell remains the sole parent. */
export function captureArcaneSpellAttackCheckpoint(input:ArcaneSpellAttackInput,execution:Readonly<{now:number}>):ArcanePreparedCheckpoint{
 if(!Number.isSafeInteger(execution.now)||execution.now<=0)throw Error('arcane-native:original-host-clock-required')
 const value=create(input as unknown as SecondChancePreparedInput,resolvePreparedDnd5eSpellCast,v=>resolvePreparedDnd5eSpellCast(v as unknown as ArcaneSpellAttackInput,{transactionId:input.prepared.action.id,now:execution.now}),input.prepared.action.id,execution),frame=Object.freeze({})as ArcanePreparedCheckpoint;frames.set(frame,value);return frame
}

export type ArcaneClassAttackInput=Parameters<typeof resolvePreparedDnd5eClassFeature>[0]
export function captureArcaneClassAttackCheckpoint(input:ArcaneClassAttackInput,execution:Readonly<{now:number}>):ArcanePreparedCheckpoint{if(!Number.isSafeInteger(execution.now)||execution.now<=0)throw Error('arcane-native:original-host-clock-required');const value=create(input as unknown as SecondChancePreparedInput,resolvePreparedDnd5eClassFeature,v=>resolvePreparedDnd5eClassFeature(v as unknown as ArcaneClassAttackInput,execution),input.prepared.action.id,execution),frame=Object.freeze({})as ArcanePreparedCheckpoint;frames.set(frame,value);return frame}

/** Advance only from an actual result returned by this private original session. */
function remember(value:ReturnType<typeof create>,next:ReturnType<ReturnType<typeof create>['session']['run']>){if(next.status==='pending-incoming-armor-class'){value.pending=next;value.options=dnd5eIncomingAttackArmorClassOptions(next.snapshot,next.facts.event)}return next}
