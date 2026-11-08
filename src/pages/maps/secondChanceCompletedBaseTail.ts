import{captureSecondChancePostNativeSettlement,readSecondChancePostNativeSettlement,type SecondChancePostNativeFrame,type SecondChancePostNativeSettlement}from'./secondChancePostNativeBoundary'
import{isSecondChancePostConcentrationChild,readSecondChancePostConcentrationActivityStage}from'./secondChancePostConcentrationActivityFrame'
import{readPostNativeActivitySettlementForStage,sameActivityParentData,type PostNativeActivitySettlement}from'./postNativeActivityParent'

const completed=new WeakMap<SecondChancePostNativeSettlement,{native:SecondChancePostNativeFrame;post:SecondChancePostNativeFrame;actual:PostNativeActivitySettlement}>()
/** Only the real Base tail emits this completed object and its original stage
 * association. It does not authorize an arbitrary final graph. */
export function captureSecondChanceCompletedBaseTail(native:SecondChancePostNativeFrame,post:SecondChancePostNativeFrame,actual:PostNativeActivitySettlement){
 if(!isSecondChancePostConcentrationChild(native,post))throw Error('second-chance-base-tail:original-child-required')
 const stage=readSecondChancePostConcentrationActivityStage(post)
 readPostNativeActivitySettlementForStage(stage,actual)
 const settlement=captureSecondChancePostNativeSettlement(native,actual)
 completed.set(settlement,{native,post,actual});return settlement
}
export function readSecondChanceCompletedBaseTail(native:SecondChancePostNativeFrame,settlement:SecondChancePostNativeSettlement){
 const value=completed.get(settlement);if(!value)return undefined
 if(value.native!==native||!isSecondChancePostConcentrationChild(native,value.post))throw Error('second-chance-base-tail:original-native-required')
 const issued=readPostNativeActivitySettlementForStage(readSecondChancePostConcentrationActivityStage(value.post),value.actual),final=readSecondChancePostNativeSettlement(native,settlement)
 if(!sameActivityParentData(final.result,issued.settlement.result)||!sameActivityParentData(final.application,issued.settlement.application))throw Error('second-chance-base-tail:changed-completion')
 return{originalPostFrame:value.post,actualCompletion:value.actual,prefix:issued.prefix,final:issued.settlement}
}
