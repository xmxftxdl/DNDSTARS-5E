import type{Dnd5eHeadlessCombatState}from'./headlessCombatEngine'
export interface TempestuousBeforeSpellOfferFrame{
 id:string;parentId:string;ordinal:number;actorId:string;spellId:string;slotLevel:number;
 timing:'before';origin:{x:number;y:number;elevationFeet:number};maximumFeet:10;
 options:readonly{featureId:string}[]
}
export interface TempestuousBeforeSpellOfferChoice{frameId:string;featureId:string;to:{x:number;y:number};elevationFeet?:number}
type Listener=(frame:Readonly<TempestuousBeforeSpellOfferFrame>,state:Dnd5eHeadlessCombatState)=>TempestuousBeforeSpellOfferChoice|undefined
type Scope={parentId:string;ordinal:number;listener:Listener;interrupted?:boolean;error?:unknown};let active:Scope|undefined
export function tempestuousBeforeSpellOfferActive(parentId:string){return active?.parentId===parentId}
/** Observation and choice transport only. Native HCE independently establishes
 * the real source, spell, actor, turn and bonus-action budget before visiting. */
export function withTempestuousBeforeSpellOffers<T>(parentId:string,listener:Listener,run:()=>T):T{
 if(!parentId||parentId.length>2000)throw Error('tempestuous-offer:original-parent-required')
 const previous=active,scope:Scope={parentId,ordinal:0,listener};active=scope
 try{const result=run();if(scope.interrupted)throw scope.error;return result}finally{active=previous}
}
export function isTempestuousBeforeSpellOfferChoice(frame:Readonly<TempestuousBeforeSpellOfferFrame>,value:TempestuousBeforeSpellOfferChoice){
 return!!value&&Object.keys(value).every(k=>['frameId','featureId','to','elevationFeet'].includes(k))&&value.frameId===frame.id&&frame.options.some(o=>o.featureId===value.featureId)&&!!value.to&&Object.keys(value.to).every(k=>['x','y'].includes(k))&&Number.isFinite(value.to.x)&&Number.isFinite(value.to.y)&&(value.elevationFeet===undefined||Number.isFinite(value.elevationFeet))
}
export function visitTempestuousBeforeSpellFlightOffer(parentId:string,facts:Omit<TempestuousBeforeSpellOfferFrame,'id'|'parentId'|'ordinal'|'timing'>,state:Dnd5eHeadlessCombatState){
 const scope=active;if(!scope||!facts.options.length)return
 if(scope.parentId!==parentId)throw Error('tempestuous-offer:actual-same-parent-required')
 const ordinal=scope.ordinal++,frame:TempestuousBeforeSpellOfferFrame=Object.freeze({...structuredClone(facts),parentId,ordinal,timing:'before',id:JSON.stringify(['tempestuous-before-offer',parentId,ordinal,facts.actorId,facts.spellId,facts.slotLevel]),options:Object.freeze(facts.options.map(o=>Object.freeze({...o})))})
 try{const choice=scope.listener(frame,structuredClone(state));if(!choice)return;if(active!==scope||!isTempestuousBeforeSpellOfferChoice(frame,choice))throw Error('tempestuous-offer:actual-current-choice-required');return structuredClone(choice)}catch(error){scope.interrupted=true;scope.error=error;throw error}
}
