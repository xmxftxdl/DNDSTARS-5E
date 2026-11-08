import type{SharedCombatState}from'./sharedCombatTypes'
import type{IncomingAttackReceipt,SecondChanceCommit}from'./secondChanceIncomingAttack'
import type{Dnd5eAction,Dnd5eHeadlessCombatState,Dnd5eActionResult}from'../rulesets/dnd5e/headlessCombatEngine'
export interface PersistedSecondChanceAttack {
  postNativeClockAuthority?:import('../pages/maps/secondChanceOriginalClockAuthority').SecondChanceOriginalClockAuthority
  sceneScope?:import('../pages/maps/secondChanceParentScope').SecondChanceSceneScope
  incomingOccurrence?:number
  attack: IncomingAttackReceipt
  featureId: string
  hostControllerMemberId?:string
  originalRoomAction?:import('../lib/sharedCombatTypes').SharedPlayerActionState
  featureDefinitionSignature?:string
  parentDefinitionSignature?:string
  characterRevision: number
  mapRevision: number
  geometryRevision?:number
  pendingCriticalDiceRequests?:Record<string,import('../rulesets/dnd5e/incomingAttackRerollCheckpoint').IncomingCriticalDiceRequest>
  criticalDice?:Record<string,readonly number[]>
  criticalDiceConfirmations?:Record<string,{authenticatedMemberId:string;rawValues:readonly number[];values:readonly number[]}>
  turnKey: string
  canSeeRoller: boolean
  canUseReaction: boolean
  reactionReserved: boolean
  reactionDecision?: { authenticatedMemberId: string; decision: 'use' | 'decline' }
  rollerSelection?: { authenticatedMemberId: string; dieIndex: number }
  rollRequestId?:string
  processedRequestIds?:readonly string[]
  /** Written by the Host dice transport after it authenticates the original roller. */
  rollerD20?: { authenticatedMemberId: string; dieIndex: number; value: number }
  rollerConfirmation?:{authenticatedMemberId:string;rollRequestId:string;rawValue:number;value:number}
  committed?: SecondChanceCommit
  parentContinuation?: { transactionId: string; phase: 'ready' | 'consumed'; characterRevision?:number; combatRevision?:number; result?:Dnd5eActionResult }
  parentInput?:{state:Dnd5eHeadlessCombatState;nativeContext?:import('../rulesets/dnd5e/damageReactionFlow').Dnd5eDamageReactionMapContext;action?:Dnd5eAction;prepared?:import('../pages/maps/secondChancePreparedParent').SecondChancePreparedOriginal;options?:Parameters<typeof import('../rulesets/dnd5e/headlessCombatEngine').resolveDnd5eHeadlessAction>[2];characterIdByCombatantId:Readonly<Record<string,string>>}
}
export type SecondChanceCombat = SharedCombatState & { secondChanceAttacks?: Record<string, PersistedSecondChanceAttack> }

export interface SecondChancePrompt{attackReceiptId:string;mapId:string;combatId:string;targetTokenId:string;targetCharacterId:string;rollerTokenId:string;rollerCharacterId?:string;phase:'reaction'|'declined'|'select-die'|'roll'|'critical-roll'|'settle';canRespondAsDefender:boolean;canRespondAsRoller:boolean;dice?:readonly number[];mode?:'normal'|'advantage'|'disadvantage';rollRequestId?:string;count?:number;sides?:number;supplementRequestId?:string}
