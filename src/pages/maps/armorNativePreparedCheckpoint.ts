import {captureSecondChancePreparedOriginal,readSecondChancePreparedOriginalAsync,resolveSecondChancePreparedInput,type SecondChancePreparedOriginal,type SecondChancePreparedInput} from './secondChancePreparedParent'
import {createDnd5ePreparedDamageCommitSession} from '../../rulesets/dnd5e/damageCommitSession'
import {incomingHitNegationOptions,type IncomingHitNegationChoice} from '../../rulesets/dnd5e/incomingHitNegationCheckpoint'
/** Mechanical prepared-facade checkpoint only. This brand is NOT room authority,
 * raw authentication, a player decision or permission to publish HP. */
export interface ArmorNativePreparedCheckpoint {readonly armorNativePreparedCheckpoint:unique symbol}
const sessions=new WeakMap<object,Awaited<ReturnType<typeof create>>>()
async function create(resolver:unknown,input:unknown){
 const original=captureSecondChancePreparedOriginal(resolver,input)
 if(!original)throw Error('armor-native:actual-prepared-facade-required')
 return createFromOriginal(original)
}
async function createFromOriginal(original:SecondChancePreparedOriginal){
 if(original.adapterId==='plugin-feature')throw Error('armor-native:async-material-facade-needs-own-boundary')
 const restored=await readSecondChancePreparedOriginalAsync(original)
 const baseline=restored.currentCombatState as SecondChancePreparedInput['prepared']['state']|undefined??restored.prepared.state
 const session=createDnd5ePreparedDamageCommitSession({...restored,prepared:{...restored.prepared,state:baseline}},value=>resolveSecondChancePreparedInput(original,value),()=>false)
 const pending=session.run(baseline)
 if(pending.status!=='pending-incoming-hit-negation'){
  session.cancel()
  // Earlier SC/critical or other checkpoint remains owned by its own driver.
  throw Error('armor-native:incoming-hit-checkpoint-required:'+pending.status)
 }
 const options=incomingHitNegationOptions(pending.snapshot,pending.facts.event)
 if(!options.length)throw Error('armor-native:actual-own-source-required')
 return{original,baseline,session,pending,options}
}
export async function captureArmorNativePreparedCheckpoint(resolver:unknown,input:unknown):Promise<ArmorNativePreparedCheckpoint>{
 const data=await create(resolver,input),frame=Object.freeze({}) as ArmorNativePreparedCheckpoint;sessions.set(frame,data);return frame
}
/** Restores only a mechanical facade checkpoint. Room journal/source/controller
 * authority remains the responsibility of the independent Host issuer. */
export async function restoreArmorNativePreparedCheckpoint(original:SecondChancePreparedOriginal):Promise<ArmorNativePreparedCheckpoint>{const data=await createFromOriginal(original),frame=Object.freeze({}) as ArmorNativePreparedCheckpoint;sessions.set(frame,data);return frame}
function read(frame:ArmorNativePreparedCheckpoint){const value=sessions.get(frame);if(!value)throw Error('armor-native:actual-checkpoint-brand-required');return value}
export function armorNativePreparedCheckpointView(frame:ArmorNativePreparedCheckpoint){const data=read(frame);return structuredClone({original:data.original,baseline:data.baseline,facts:data.pending.facts,occurrence:data.pending.occurrence,options:data.options})}
/** Final controller/confirmed D6 authority must be supplied by the future room
 * journal consumer. This function itself only continues the same native session. */
export function resumeArmorNativePreparedCheckpoint(frame:ArmorNativePreparedCheckpoint,choice?:IncomingHitNegationChoice){const data=read(frame);return data.session.resumeIncomingHitNegation(data.baseline,data.pending.occurrence,data.pending.facts,choice)}
export type ArmorNativePreparedOriginal=SecondChancePreparedOriginal
