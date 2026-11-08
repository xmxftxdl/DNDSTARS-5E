import type{IncomingAttackRollFacts}from'../../rulesets/dnd5e/incomingAttackRerollCheckpoint'
import type{Dnd5eHeadlessCombatState}from'../../rulesets/dnd5e/headlessCombatEngine'
const issued=new WeakSet<object>()
/** Issued only while a genuine original Session/official Flow is paused at its
 * next actual eligible attack. A deserialized player object cannot represent it. */
export class SecondChanceAdditionalIncoming extends Error{
 readonly transactionId:string
 readonly occurrence:number
 readonly facts:IncomingAttackRollFacts
 readonly snapshot:Dnd5eHeadlessCombatState
 constructor(transactionId:string,occurrence:number,facts:IncomingAttackRollFacts,snapshot:Dnd5eHeadlessCombatState){super('second-chance-parent:additional-incoming-required');this.transactionId=transactionId;this.occurrence=occurrence;this.facts=structuredClone(facts);this.snapshot=structuredClone(snapshot);issued.add(this)}
}
export function isSecondChanceAdditionalIncoming(value:unknown):value is SecondChanceAdditionalIncoming{return value instanceof SecondChanceAdditionalIncoming&&issued.has(value)}
