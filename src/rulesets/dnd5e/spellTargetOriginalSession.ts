import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone'
import{createDnd5eAllyOriginalCollectionSession}from'./damageCommitSession'
import{resolvePreparedDnd5eSpellCast}from'./spellAction'
import{observeMissingSpellTargetOriginal,type MissingSpellTargetOriginal}from'./missingSpellTargetOriginal'
type Source=Parameters<typeof resolvePreparedDnd5eSpellCast>[0]
const issued=new WeakMap<object,{source:Source;signature:string;effectTimestamp:number;current:()=>boolean}>()
/** Mechanical lineage from the exact canonical Spell worker only. It grants
 * no owner consent, room family, physical pool or publication permission. */
export function createDnd5eNextSpellTargetOriginalSession(source:Source){const frozen=cloneDnd5eHostTransactionInput(source),session=createDnd5eAllyOriginalCollectionSession(frozen,resolvePreparedDnd5eSpellCast);let ended=false;const record=(result:ReturnType<typeof session.run>|MissingSpellTargetOriginal)=>{if(result.status==='missing-spell-target-original')issued.set(result,{source:frozen,signature:JSON.stringify(result),effectTimestamp:session.originalEffectTimestamp(),current:()=>!ended});return result};return{run:()=>{if(ended)throw Error('spell-target-original:ended-session');return record(observeMissingSpellTargetOriginal(()=>session.run(frozen.prepared.state)))},cancel(){ended=true;session.cancel()}}}
export function readDnd5eActualMissingSpellTargetOriginal(result:object){const row=issued.get(result);if(!row||!row.current()||row.signature!==JSON.stringify(result))throw Error('spell-target-original:actual-current-missing-boundary-required');return{source:cloneDnd5eHostTransactionInput(row.source),resolve:resolvePreparedDnd5eSpellCast,effectTimestamp:row.effectTimestamp}}
