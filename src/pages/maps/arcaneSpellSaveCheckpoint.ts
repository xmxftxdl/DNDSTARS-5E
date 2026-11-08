import{resolvePreparedDnd5eClassFeature}from'../../rulesets/dnd5e/classFeatureAction'
import{resolvePreparedDnd5eSpellCast}from'../../rulesets/dnd5e/spellAction'
import{createDnd5ePreparedDamageCommitSession}from'../../rulesets/dnd5e/damageCommitSession'
import{createDnd5eParentEffectClock}from'../../rulesets/dnd5e/activeEffects'
import{captureSecondChancePreparedOriginal}from'./secondChancePreparedParent'
import type{FailedSavingThrowChoice}from'../../rulesets/dnd5e/failedSavingThrowCheckpoint'
import type{PostD20FeatureUseChoice}from'../../rulesets/dnd5e/postD20FeatureUseCheckpoint'
export type ArcaneSpellSaveInput=Parameters<typeof resolvePreparedDnd5eSpellCast>[0]
export interface ArcaneSpellSaveCheckpoint{readonly arcaneSpellSaveCheckpoint:unique symbol}
export type ArcaneClassSaveInput=Parameters<typeof resolvePreparedDnd5eClassFeature>[0]
function create(input:ArcaneSpellSaveInput|ArcaneClassSaveInput,execution:Readonly<{now:number}>,classSave=false){
 if(!Number.isSafeInteger(execution.now)||execution.now<=0)throw Error('arcane-native:original-host-clock-required')
 // Decisions must come from this Host checkpoint, never an already modified player spell input.
 if((input as ArcaneSpellSaveInput).savingThrowPostD20Adjustment||(input as ArcaneSpellSaveInput).targetSavingThrows?.some(row=>row.postD20Adjustment)||(input as ArcaneClassSaveInput).turnUndeadSavingThrows?.some(row=>row.postD20Adjustment))throw Error('arcane-native:unmodified-original-save-required')
 const original=captureSecondChancePreparedOriginal(classSave?resolvePreparedDnd5eClassFeature:resolvePreparedDnd5eSpellCast,input);if(!original)throw Error('arcane-native:actual-spell-codec-required')
 const baseline=input.prepared.state,parentId=input.prepared.action.id,clock=createDnd5eParentEffectClock({parentId,sourceKey:'arcane-native:'+parentId,timestamp:execution.now}),session=createDnd5ePreparedDamageCommitSession(input,value=>clock.run(()=>classSave?resolvePreparedDnd5eClassFeature(value as ArcaneClassSaveInput,execution):resolvePreparedDnd5eSpellCast(value as ArcaneSpellSaveInput,{transactionId:parentId,now:execution.now})),()=>false),pending=session.run(baseline)
 if(pending.status!=='pending-failed-saving-throw'){session.cancel();throw Error('arcane-native:genuine-failed-save-required:'+pending.status)}
 if(!pending.facts.sourceActorId||pending.facts.sourceActorId!==input.prepared.action.actorTokenId)throw Error('arcane-native:original-spell-save-source-required')
 return{input,original,baseline,session,pending}
}
const frames=new WeakMap<object,ReturnType<typeof create>>()
export function captureArcaneSpellSaveCheckpoint(input:ArcaneSpellSaveInput,execution:Readonly<{now:number}>):ArcaneSpellSaveCheckpoint{const frame=Object.freeze({})as ArcaneSpellSaveCheckpoint;frames.set(frame,create(input,execution));return frame}
function read(frame:ArcaneSpellSaveCheckpoint){const value=frames.get(frame);if(!value)throw Error('arcane-native:actual-spell-save-brand-required');return value}
export function readArcaneSpellSaveCheckpoint(frame:ArcaneSpellSaveCheckpoint){const value=read(frame);return structuredClone({original:value.original,context:{map:value.input.prepared.map,characters:value.input.prepared.characters,characterIdByCombatantId:value.input.prepared.characterIdByCombatantId},baseline:value.baseline,facts:value.pending.facts,occurrence:value.pending.occurrence,options:value.pending.facts.options})}
export function resumeArcaneSpellSaveCheckpoint(frame:ArcaneSpellSaveCheckpoint,choice?:FailedSavingThrowChoice){const v=read(frame);return v.session.resumeFailedSavingThrow(v.baseline,v.pending.occurrence,v.pending.facts,choice)}
export function resumeArcaneSpellSaveShroud(frame:ArcaneSpellSaveCheckpoint,pending:Extract<ReturnType<ReturnType<typeof create>['session']['run']>,{status:'pending-post-d20-feature-use'}>,choice?:PostD20FeatureUseChoice){const v=read(frame);return v.session.resumePostD20FeatureUse(v.baseline,pending.occurrence,pending.request,choice)}

/** A real core class save uses the same failed-save facts, never a fake spell. */
export function captureArcaneClassSaveCheckpoint(input:ArcaneClassSaveInput,execution:Readonly<{now:number}>):ArcaneSpellSaveCheckpoint{const frame=Object.freeze({})as ArcaneSpellSaveCheckpoint;frames.set(frame,create(input,execution,true));return frame}
