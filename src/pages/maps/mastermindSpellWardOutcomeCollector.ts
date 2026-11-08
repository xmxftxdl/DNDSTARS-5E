import{continueMastermindSecondSpellWardProposedTarget,readMastermindSecondSpellWardFailureOriginal,completeMastermindSecondSpellWardWaste}from'./mastermindSpellWindowParent'
import{readMastermindSpellWindowWardFailureOriginal,completeMastermindSpellWindowWardWaste,continueMastermindSpellWindowWardOriginalTarget,continueMastermindSpellWindowWardProposedTarget,type MastermindSpellWindowWardOriginal}from'./mastermindSpellWindowParent'
import type{collectMastermindSpellWardPage}from'./mastermindSpellWardPageDriver'
export type MastermindSpellWardCollectedOutcome=Awaited<ReturnType<typeof collectMastermindSpellWardPage>>
/** The callback cannot substitute a JSON waste row. Its true failure handle is
 * revalidated against this collector's parent/window before any completion. */
export async function completeMastermindSpellWardCollectedOutcome(parentId:string,index:number,outcome:MastermindSpellWardCollectedOutcome){
 if(outcome.status==='allowed')return
 if(outcome.status==='second-failed'){const fact=await readMastermindSecondSpellWardFailureOriginal(outcome.failure);if(fact.current.parent.id!==parentId||fact.index!==index)throw Error('spell-ward-collector:same-second-failed-window-required');if(fact.row.outcome?.choice==='retarget'){await continueMastermindSecondSpellWardProposedTarget(outcome.failure);return}return completeMastermindSecondSpellWardWaste(outcome.failure)}
 const fact=await readMastermindSpellWindowWardFailureOriginal(outcome.failure)
 if(fact.current.parent.id!==parentId||fact.index!==index)throw Error('spell-ward-collector:same-original-failed-window-required')
 if(fact.row.outcome?.choice==='retarget'){await continueMastermindSpellWindowWardProposedTarget(outcome.failure);return}
 if(fact.row.outcome?.choice==='retarget-original'){await continueMastermindSpellWindowWardOriginalTarget(outcome.failure);return}return completeMastermindSpellWindowWardWaste(outcome.failure)
}
export type MastermindSpellWardPageCallback=(original:MastermindSpellWindowWardOriginal)=>Promise<MastermindSpellWardCollectedOutcome>
