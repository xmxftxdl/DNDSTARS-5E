import{captureSecondChancePostNativeSettlement,readSecondChancePostNativeFrame,type SecondChancePostNativeFrame,type SecondChancePostNativeSettlement}from'./secondChancePostNativeBoundary'
import{isSecondChancePostConcentrationChild}from'./secondChancePostConcentrationActivityFrame'
import{readSpecterScActivityReady,type SpecterScActivityReady}from'./postNativeActivityParent'
const plans=new WeakMap<object,{native:SecondChancePostNativeFrame;post:SecondChancePostNativeFrame;ready:SpecterScActivityReady}>()
/** A verified Base prefix may be paired only with the exact child used by
 * the actual Specter ready. No JSON state or matching parent id substitutes. */
export async function secondChanceSpecterSettlementUsesPostFrame(native:SecondChancePostNativeFrame,settlement:SecondChancePostNativeSettlement,post:SecondChancePostNativeFrame):Promise<boolean>{
 const entry=plans.get(settlement);if(!entry)return false
 if(entry.native!==native||entry.post!==post)throw Error('second-chance-specter:original-prefix-child-required')
 await readSecondChanceSpecterFinalPlan(native,settlement);return true
}
/** Only a true post-stage child and the adapter's opaque ready may add a journal write. */
export async function captureSecondChanceSpecterFinalSettlement(native:SecondChancePostNativeFrame,post:SecondChancePostNativeFrame,ready:SpecterScActivityReady):Promise<SecondChancePostNativeSettlement>{
 if(!isSecondChancePostConcentrationChild(native,post))throw Error('second-chance-specter:original-child-required')
 const value=await readSpecterScActivityReady(post,ready)
 const settlement=captureSecondChancePostNativeSettlement(native,value)
 plans.set(settlement,{native,post,ready});return settlement
}
export async function readSecondChanceSpecterFinalPlan(native:SecondChancePostNativeFrame,settlement:SecondChancePostNativeSettlement){
 const entry=plans.get(settlement);if(!entry)return undefined
 if(entry.native!==native||!isSecondChancePostConcentrationChild(native,entry.post))throw Error('second-chance-specter:original-child-required')
 const view=readSecondChancePostNativeFrame(entry.post),value=await readSpecterScActivityReady(entry.post,entry.ready)
 const names=['maps','characters','combat','map-geometry','campaign-time'] as const
 if(value.journalWrite.name!=='activity-death-parents'||!Number.isSafeInteger(value.journalWrite.expectedRevision)||value.journalWrite.expectedRevision!<0||Object.keys(value.readRevisions).length!==5||names.some(name=>!Number.isSafeInteger(view.revisions[name])||value.readRevisions[name]!==view.revisions[name]))throw Error('second-chance-specter:bound-journal-plan-required')
 return value
}
