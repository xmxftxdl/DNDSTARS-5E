import {prepareBountifulDeferredExtraD20} from './bountifulLuckDeferredD20'
import {d20RollConfirmationSettlementSelection} from '../../lib/rollConfirmation'
import {durableD20RollId} from '../../lib/rollConfirmation'
import type {CombatInterruptByKind} from '../../lib/combatInterruptProtocol'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
type Options={durableRollRequestId?:string;freeRoll?:boolean;forcePublic?:boolean;skipChoiceReroll?:boolean;rollerCharacterId?:string}
export function actualMapsMint(count:number,sides:number,options:Options,cursor:Map<string,number>,parentId:string){
 const activeInterruptTransactionIdRef={current:parentId},d20RollSequenceByTransactionRef={current:cursor},activeMap={id:'map'},mode='dm' as const,safeCount=count,safeSides=sides
 let rollRequestId='ephemeral'
     const transactionId = activeInterruptTransactionIdRef.current
    if (!options.durableRollRequestId && !options.freeRoll && transactionId && activeMap) {
      const occurrenceIndex = d20RollSequenceByTransactionRef.current.get(transactionId) ?? 0
      d20RollSequenceByTransactionRef.current.set(transactionId, occurrenceIndex + 1)
      rollRequestId = `${durableD20RollId({ mapId: activeMap.id, sourceMode: mode ?? 'local', transactionId, occurrenceIndex })}:pool:${safeCount}d${safeSides}`
    }
    if(options.durableRollRequestId)rollRequestId=options.durableRollRequestId

 return rollRequestId
}
export async function actualMapsExtra(prompt:CombatInterruptByKind<'roll-confirmation'>,contributionId:string,gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>,rollDiceBoxValues:(count:number,sides:number,label:string,target:string,options:Options)=>Promise<number[]>){
 const selected=d20RollConfirmationSettlementSelection(prompt,contributionId),accepted=selected.contribution,acceptedChoiceEligible=selected.choiceReroll
 if(!acceptedChoiceEligible)throw Error('actual generic choice required')
 const loadSharedResource=gateway.loadResource,saveSharedResourcesAtomically=gateway.saveResourcesAtomically
 let choiceRerollValue:number[]|undefined
         let boundExtra:Awaited<ReturnType<typeof prepareBountifulDeferredExtraD20>>|undefined
        if(prompt.payload.bountifulParent){
          if(!prompt.mapId||!accepted||accepted.kind!=='choice-reroll')throw Error('bountiful-followup:actual-choice-required')
          boundExtra=await prepareBountifulDeferredExtraD20({mapId:prompt.mapId,interruptId:prompt.id,acceptedContributionId:accepted.id,expectedContribution:accepted},{loadResource:loadSharedResource,saveResourcesAtomically:saveSharedResourcesAtomically})
        }
        choiceRerollValue = await rollDiceBoxValues(
          boundExtra?.count??acceptedChoiceEligible.additionalDice??1, 20,
          `${accepted?.featureLabel ?? prompt.payload.label}·额外 d20`,
          accepted?.characterName ?? prompt.payload.targetName,
          { forcePublic: true, rollerCharacterId: boundExtra?.rollerCharacterId??accepted?.characterId,
            ...(boundExtra?{durableRollRequestId:boundExtra.rollRequestId,skipChoiceReroll:true}:{}),
          },
        )

 return choiceRerollValue
}
