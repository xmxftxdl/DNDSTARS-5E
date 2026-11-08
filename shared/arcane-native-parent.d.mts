export interface ArcaneNativeJournal {schemaVersion:1;parents:Record<string,unknown>;_sync?:{revision:number}}
export interface ArcaneNativeIdentity {roomId:string;memberId:string;role:string}
export type ArcaneNativeChoiceResult={ok:true;changed:boolean;next:ArcaneNativeJournal}|{ok:false;status:number;error:string}
export function validArcaneNativeJournal(value:unknown):value is ArcaneNativeJournal
export function arcaneNativeTransitionAllowed(before:unknown,after:unknown,allowConsumed?:boolean):boolean
export function acceptArcaneNativeChoice(journal:unknown,snapshot:unknown,identity:ArcaneNativeIdentity,payload:unknown,now:number):ArcaneNativeChoiceResult
export function arcaneNativeConsumptionPaired(before:unknown,after:unknown,writes:unknown,transactionId:unknown,world:unknown):boolean
export interface ArcaneNativeOwnerRequest {parentId:string;checkpointId?:string;phase:'arcane'|'shroud';mapId:string;characterId:string;actorTokenId:string;featureId:string;maximumTargets?:3;rangeFeet?:60;requiresVisibleTargets?:true}
export function projectArcaneNativeRequests(journal:unknown,snapshot:unknown,identity:ArcaneNativeIdentity):ArcaneNativeOwnerRequest[]
