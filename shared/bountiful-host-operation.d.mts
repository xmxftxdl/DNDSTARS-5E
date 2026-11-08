export interface BountifulHostOperation{
 kind:'native-host-operation';version:1;adapterId:'monster';parentId:string;mapId:string;combatId:string;hostMemberId:string;actorTokenId:string;targetTokenId:string;actionId:string;rawRollId:string;rawCursor:number
}
export function validBountifulHostOperation(value:unknown):value is BountifulHostOperation
export function bountifulMonsterDamageContinuationMatches(before:unknown,after:unknown):boolean
export function bountifulHostPreparedWireSignature(wire:unknown):string|null
