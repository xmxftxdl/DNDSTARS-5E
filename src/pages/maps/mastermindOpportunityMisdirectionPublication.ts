import type{SharedPlayerActionState}from'../../lib/sharedCombatTypes'
import type{MastermindOpportunityMisdirectionDecision}from'./mastermindOpportunityMisdirectionParent'
import{readMastermindOpportunityMisdirectionCompletedSource,restoreMastermindOpportunityMisdirectionCompletedDecision}from'./mastermindOpportunityMisdirectionParent'
import{readBountifulOpportunitySequenceCompletion,readBountifulOpportunitySequenceCompletedCheckpoint,type BountifulOpportunitySequenceCompletion}from'../../rulesets/dnd5e/bountifulOpportunitySequenceCollector'
import{loadSharedResource}from"../../composition/browserSharedRoomResources"
import{resolveBountifulOpportunitySequenceCompletionForNormalAck,publishBountifulOpportunitySequenceAck}from'../../rulesets/dnd5e/bountifulOpportunitySequenceAck'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
type ResolveInput=Parameters<typeof resolveBountifulOpportunitySequenceCompletionForNormalAck>[0]
type Gateway=Parameters<typeof resolveBountifulOpportunitySequenceCompletionForNormalAck>[1]
const same=(a:unknown,b:unknown)=>JSON.stringify(encodeSecondChanceParentWire(a))===JSON.stringify(encodeSecondChanceParentWire(b))
const publications=new WeakMap<object,{decisions:readonly MastermindOpportunityMisdirectionDecision[];readRevisions:Record<string,number>}>()
async function guards(action:SharedPlayerActionState,completion:BountifulOpportunitySequenceCompletion,decisions:readonly MastermindOpportunityMisdirectionDecision[]){
 const actual=readBountifulOpportunitySequenceCompletion(action,completion),readRevisions:Record<string,number>={},seen=new Set<number>()
 if(!decisions.length)throw Error('opportunity-misdirection:actual-decisions-required')
 for(const decision of decisions){const proof=await readMastermindOpportunityMisdirectionCompletedSource(decision);if(!same(proof.action,action)||seen.has(proof.windowIndex)||!same(proof.source.prepared,actual.source.prepared)||Object.entries(proof.source.attacks??{}).some(([id,v])=>!same(v,actual.source.attacks[id])))throw Error('opportunity-misdirection:same-whole-completion-required');seen.add(proof.windowIndex);for(const[name,revision]of Object.entries(proof.readRevisions)){if(readRevisions[name]!==undefined&&readRevisions[name]!==revision)throw Error('opportunity-misdirection:inconsistent-original-versions');readRevisions[name]=revision}}
 return readRevisions
}
/** The existing whole-move native/Base resolver remains the only result issuer. */
export async function resolveMastermindOpportunityForNormalAck(input:ResolveInput&{decisions:readonly MastermindOpportunityMisdirectionDecision[]},gateway:Gateway){const readRevisions=await guards(input.action,input.completion,input.decisions),resolved=await resolveBountifulOpportunitySequenceCompletionForNormalAck(input,gateway);publications.set(input.action,{decisions:[...input.decisions],readRevisions});return resolved}
/** Add immutable source/journal reads to the existing sole five-write ACK. */
export async function publishMastermindOpportunityAck(action:SharedPlayerActionState,input:Parameters<typeof publishBountifulOpportunitySequenceAck>[1],gateway:Gateway){const proof=publications.get(action);if(!proof)throw Error('opportunity-misdirection:actual-whole-publication-required');for(const decision of proof.decisions){const current=await readMastermindOpportunityMisdirectionCompletedSource(decision);if(!same(current.readRevisions,proof.readRevisions))throw Error('opportunity-misdirection:publication-source-changed')}for(const[name,revision]of Object.entries(proof.readRevisions))if(input.expectedRevisions?.[name]!==undefined&&input.expectedRevisions[name]!==revision)throw Error('opportunity-misdirection:publication-version-conflict');await publishBountifulOpportunitySequenceAck(action,{...input,expectedRevisions:{...input.expectedRevisions,...proof.readRevisions}},gateway);publications.delete(action)}

export function hasMastermindOpportunityAck(action:SharedPlayerActionState){return publications.has(action)}
/** The private rows select which actual completed windows to re-observe. Rows
 * cannot themselves issue checkpoints, owner decisions or world results. */
export async function restoreMastermindOpportunityDecisionsForCompletion(action:SharedPlayerActionState,completion:BountifulOpportunitySequenceCompletion,g?:NonNullable<Parameters<typeof restoreMastermindOpportunityMisdirectionCompletedDecision>[1]>){
 readBountifulOpportunitySequenceCompletion(action,completion)
 type JournalSelection={parents:Record<string,{parentTransactionId:string;opportunityOriginal?:{family:string;windowIndex:number}}>}
 const load=g?.loadResource??loadSharedResource
 const journal=await load<JournalSelection>('mastermind-misdirections'),rows=Object.values(journal?.parents??{}).filter(row=>row.parentTransactionId===action.id&&row.opportunityOriginal?.family==='opportunity-sequence').sort((a,b)=>a.opportunityOriginal!.windowIndex-b.opportunityOriginal!.windowIndex),decisions:MastermindOpportunityMisdirectionDecision[]=[]
 for(const row of rows){const checkpoint=readBountifulOpportunitySequenceCompletedCheckpoint(action,completion,row.opportunityOriginal!.windowIndex);decisions.push(await restoreMastermindOpportunityMisdirectionCompletedDecision(checkpoint,g))}
 return decisions
}
