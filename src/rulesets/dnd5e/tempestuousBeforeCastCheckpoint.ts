import type{Dnd5eHeadlessCombatState}from'./headlessCombatEngine'
export interface TempestuousBeforeSpellMovementFrame{
 id:string;parentId:string;actorId:string;featureId:string;spellId:string;slotLevel:number;
 from:{x:number;y:number;elevationFeet:number};actualPosition:{x:number;y:number;elevationFeet:number};
 movementCompleted:boolean;maximumFeet:10
}
type Listener=(frame:Readonly<TempestuousBeforeSpellMovementFrame>,actualOperation:object,state:Dnd5eHeadlessCombatState)=>void
type Scope={parentId:string;listener:Listener;interrupted?:boolean;error?:unknown};let active:Scope|undefined
/** This transports an observation only. The operation is issued privately by the
 * actual native movement consumer; neither this scope nor a frame creates it. */
export function withTempestuousBeforeCastCheckpoints<T>(parentId:string,listener:Listener,run:()=>T):T{
 if(!parentId||parentId.length>2000)throw Error('tempestuous-before:actual-parent-required')
 const previous=active,scope:Scope={parentId,listener};active=scope
 try{const result=run();if(scope.interrupted)throw scope.error;return result}finally{active=previous}
}
export function visitTempestuousBeforeCastCheckpoint(frame:TempestuousBeforeSpellMovementFrame,actualOperation:object,state:Dnd5eHeadlessCombatState){
 const scope=active;if(!scope)return
 if(scope.parentId!==frame.parentId)throw Error('tempestuous-before:actual-same-parent-required')
 try{scope.listener(Object.freeze(structuredClone(frame)),actualOperation,structuredClone(state))}catch(error){scope.interrupted=true;scope.error=error;throw error}
}
