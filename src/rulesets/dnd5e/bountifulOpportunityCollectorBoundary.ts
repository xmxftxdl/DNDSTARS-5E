import type{createBountifulOpportunityMoveRawBoundary}from'./bountifulOpportunityMoveOriginalFlow'
import type{createBountifulOpportunityAttackLateDice}from'./bountifulOpportunitySettlementDice'
import type{BountifulOpportunitySequenceRawRoute}from'./bountifulOpportunitySequenceSource'
import type{resolvePreparedDnd5eOpportunityAttack}from'./opportunityAttackAction'
type Single=ReturnType<typeof createBountifulOpportunityMoveRawBoundary>
type AttackInput=Parameters<typeof resolvePreparedDnd5eOpportunityAttack>[0]
/** A collector port, never an authority token. Every implementation keeps its
 * actual issued parent, raw/choice receipts and guarded publication private.
 * Existing single-window boundaries satisfy this interface unchanged. */
export interface BountifulOpportunityCollectorBoundary {
 getDiceRoute:Single['getDiceRoute']
 hasPreparedOriginal?:()=>boolean; hasCapturedOriginal:Single['hasCapturedOriginal']
 beforeOriginalRequest:Single['beforeOriginalRequest']
 afterOriginalConfirmed:Single['afterOriginalConfirmed']
 readRetained():readonly[number,number|undefined]
 readPreview:Single['readPreview']
 readOriginal():{prepared:{rawMode?:'normal'|'advantage'|'disadvantage';originalChoices?:Pick<AttackInput,'tranquilitySave'|'areaAttackAdvantageReaction'|'disadvantageNegationChoice'>}}
 getSequenceDiceRoute?():BountifulOpportunitySequenceRawRoute|undefined
 createLateJournal?():ReturnType<typeof createBountifulOpportunityAttackLateDice>
}
