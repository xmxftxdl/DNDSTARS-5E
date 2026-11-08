import {readSecondChancePostNativeFrame,readSecondChancePostNativeSettlement,type SecondChancePostNativeFrame,type SecondChancePostNativeSettlement} from './secondChancePostNativeBoundary'
import {readScBasePrefixConsumption,type ScBasePrefixConsumption} from './scBasePrefixRolls'
import {readSecondChancePostConcentrationClockGuard} from './secondChancePostConcentrationActivityFrame'
import {secondChanceSpecterSettlementUsesPostFrame} from './secondChanceSpecterFinalPlan'
import {sameActivityParentData} from './postNativeActivityParent'
import {readSecondChanceCompletedBaseTail} from './secondChanceCompletedBaseTail'

const publications=new WeakMap<SecondChancePostNativeSettlement,{frame:SecondChancePostNativeFrame;consumption:ScBasePrefixConsumption}>()

/** Attaches no caller-provided state. Both the final settlement and the fixed
 * authenticated prefix plan must already belong to this genuine native frame. */
export async function bindSecondChanceBasePrefixPublication(frame:SecondChancePostNativeFrame,settlement:SecondChancePostNativeSettlement,consumption:ScBasePrefixConsumption):Promise<SecondChancePostNativeSettlement>{
 await checked(frame,consumption,settlement)
 if(publications.has(settlement))throw Error('second-chance-prefix:already-bound')
 publications.set(settlement,{frame,consumption});return settlement
}

async function checked(frame:SecondChancePostNativeFrame,consumption:ScBasePrefixConsumption,settlement:SecondChancePostNativeSettlement){
 const final=readSecondChancePostNativeSettlement(frame,settlement)
 const native=readSecondChancePostNativeFrame(frame),plan=await readScBasePrefixConsumption(frame,consumption),names=['maps','characters','combat','map-geometry','campaign-time'] as const,originalRevisions={...native.revisions,...readSecondChancePostConcentrationClockGuard(frame)}
 if(native.phase!=='native-before-base'||plan.write.name!=='sc-base-prefix-rolls'||typeof plan.write.expectedRevision!=='number'||!Number.isSafeInteger(plan.write.expectedRevision)||plan.write.expectedRevision<0||Object.keys(plan.readRevisions).length!==names.length||names.some(name=>!Number.isSafeInteger(originalRevisions[name])||plan.readRevisions[name]!==originalRevisions[name]))throw Error('second-chance-prefix:original-fixed-plan-required')
 const actualTail=readSecondChanceCompletedBaseTail(frame,settlement)
 if(!await secondChanceSpecterSettlementUsesPostFrame(frame,settlement,plan.originalPostFrame)&&actualTail?.originalPostFrame!==plan.originalPostFrame){
  const prefix=readSecondChancePostNativeFrame(plan.originalPostFrame)
  if(!sameActivityParentData(final.result,prefix.result)||!sameActivityParentData(final.application,prefix.application))throw Error('second-chance-prefix:prefix-result-mismatch')
 }
 return plan
}

export async function readSecondChanceBasePrefixPublication(frame:SecondChancePostNativeFrame,settlement:SecondChancePostNativeSettlement){
 const entry=publications.get(settlement);if(!entry)return undefined
 if(entry.frame!==frame)throw Error('second-chance-prefix:original-frame-required')
 readSecondChancePostNativeSettlement(frame,settlement)
 return checked(frame,entry.consumption,settlement)
}
