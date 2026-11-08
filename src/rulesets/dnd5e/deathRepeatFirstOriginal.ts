import{readDnd5eDeathRepeatSavingOriginal,type Dnd5eDeathRepeatSavingOriginalOperation}from'./deathRepeatSavingOriginal'
import{createDnd5eOriginalD20Session,readDnd5eActualOriginalReadyBoundary}from'./damageCommitSession'
import{resolvePreparedDnd5eDeathSavingTurn}from'./deathSaveTurnAction'
import{originalD20ReplaySourceKey}from'./allyNaturalOneCheckpoint'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone'

declare const firstReady:unique symbol
export type Dnd5eDeathRepeatFirstOriginal={readonly[firstReady]:true}
const signature=(v:unknown)=>JSON.stringify(encodeSecondChanceParentWire(v))
const issued=new WeakMap<object,{operation:Dnd5eDeathRepeatSavingOriginalOperation;ready:object;readyInputSignature:string;cancel:()=>void;clock:number}>()
/** Only an actual current whole Death Native missing-end operation can identify
 * this first non-natural-one prefix. No B receipt, raw, result or world grant is minted. */
export function captureDnd5eDeathRepeatFirstOriginal(operation:Dnd5eDeathRepeatSavingOriginalOperation):Dnd5eDeathRepeatFirstOriginal{
 const actual=readDnd5eDeathRepeatSavingOriginal(operation),source=actual.originalSource,p=source.prepared,clock=actual.effectTimestamp,prepared={...cloneDnd5eHostTransactionInput(source),hostOriginalD20Replay:{parentId:p.action.id,sourceKey:originalD20ReplaySourceKey(p.action.id,p.state,p.action,clock),effectTimestamp:clock,facts:[]}},first=createDnd5eOriginalD20Session(prepared,resolvePreparedDnd5eDeathSavingTurn,p.actorToken.id,'saving-throw');try{const ready=first.run(p.state);if(ready.status!=='original-d20-ready'||first.originalEffectTimestamp()!==clock)throw Error('death-repeat-first:actual-first-ready-required');const proof=Object.freeze({})as Dnd5eDeathRepeatFirstOriginal;issued.set(proof,{operation,ready,readyInputSignature:signature(prepared),cancel:()=>first.cancel(),clock});readDnd5eDeathRepeatFirstOriginal(proof);return proof}catch(error){first.cancel();throw error}
}
export function readDnd5eDeathRepeatFirstOriginal(proof:Dnd5eDeathRepeatFirstOriginal){
 const row=issued.get(proof);if(!row)throw Error('death-repeat-first:actual-private-preparation-required');const operation=row.operation
 let actual:ReturnType<typeof readDnd5eDeathRepeatSavingOriginal>;try{actual=readDnd5eDeathRepeatSavingOriginal(operation)}catch(error){issued.delete(proof);row.cancel();throw error}
 const native=readDnd5eActualOriginalReadyBoundary(row.ready);if(native.resolve!==resolvePreparedDnd5eDeathSavingTurn||signature(native.input)!==row.readyInputSignature||actual.effectTimestamp!==row.clock)throw Error('death-repeat-first:actual-unchanged-first-ready-required')
 const source=actual.originalSource,p=source.prepared,command=source.command,actor=p.state.combatants[p.actorToken.id],frame=actual.frame,slot=p.activeEffectSavingThrows.find(row=>row.effect.id===frame.effect.id)
 if(!Number.isInteger(command.d20)||command.d20<=1||command.d20>=20||command.d20Second!==undefined||command.halflingLuckyD20!==undefined||command.halflingLuckyD20Second!==undefined||command.blessRoll!==undefined||command.baneRoll!==undefined||![actor.deathSaves.successes,actor.deathSaves.failures].every(value=>Number.isInteger(value)&&value>=0&&value<=2)||frame.actorId!==p.actorToken.id||frame.mode!==(actor.racialRules?.halflingLucky===true?'advantage':'normal')||frame.count!==(actor.racialRules?.halflingLucky===true?2:1)||!slot||slot.blessed||slot.baned||frame.timing!=='target-turn-end'||frame.effect.repeatSave?.ability!=='wis'||!String(frame.effect.source?.rulesId??'').endsWith('cause-fear'))throw Error('death-repeat-first:actual-normal-non1-cause-fear-required')
 if(native.request.actorId!==p.actorToken.id||native.request.kind!=='saving-throw'||JSON.stringify(native.request.originalRolls)!==JSON.stringify([command.d20]))throw Error('death-repeat-first:actual-first-ready-pool-required')
 return{source:cloneDnd5eHostTransactionInput(source),effectTimestamp:actual.effectTimestamp,frame:cloneDnd5eHostTransactionInput(frame),operation}
}

export function disposeDnd5eDeathRepeatFirstOriginal(proof:Dnd5eDeathRepeatFirstOriginal){const row=issued.get(proof);if(!row)return;issued.delete(proof);row.cancel()}
