import{expect}from'vitest'
import source from'../MapsWorkspacePage.tsx?raw'
import{collectMastermindOpportunityMisdirectionOriginal}from'./mastermindOpportunityMisdirectionParent'
import{bindBountifulOpportunitySequenceMisdirection,type BountifulOpportunitySequenceCollectorHandle}from'../../rulesets/dnd5e/bountifulOpportunitySequenceCollector'
import type{readCapturedDnd5eOpportunitySequenceCollectorCheckpoint}from'../../rulesets/dnd5e/opportunityMoveSequence'
/** Execute the exact current Page producer, with the same real HTTP ports. */
export async function actualPageOpportunityPreview(handle:BountifulOpportunitySequenceCollectorHandle,checkpoint:object,attack:ReturnType<typeof readCapturedDnd5eOpportunitySequenceCollectorCheckpoint>['attack'],gateway:NonNullable<Parameters<typeof collectMastermindOpportunityMisdirectionOriginal>[1]>){
 const start=source.indexOf('            if(sequenceMisdirection){const ownerDecision='),end=source.indexOf('\n            await publishSingleTargetAttackPresentation',start)
 if(start<0||end<0)throw Error('Actual Page pre-dice Misdirection producer missing')
 expect(source.lastIndexOf('if(!accepted){await recordBountifulOpportunitySequenceDeclinedReaction',start)).toBeGreaterThan(source.lastIndexOf('const collected=await prepareBountifulOpportunitySequenceCollector',start))
 expect(source.indexOf('await collectDnd5ePreparedOpportunityRolls',end)).toBeGreaterThan(end)
 const run=new Function('collectMastermindOpportunityMisdirectionOriginal','bindBountifulOpportunitySequenceMisdirection','return async function(sequenceMisdirection,next,collected,attack){'+source.slice(start,end)+';return attack}')((cp:object)=>collectMastermindOpportunityMisdirectionOriginal(cp,gateway),bindBountifulOpportunitySequenceMisdirection)
 return run(true,{checkpoint},{handle},attack)as Promise<typeof attack>
}
