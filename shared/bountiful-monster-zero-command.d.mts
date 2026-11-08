export interface BountifulMonsterZeroCommand{kind:'monster-damage-zero-original';version:1;parentId:string;mapId:string;combatId:string;actorTokenId:string;targetTokenId:string;actionId:string;frameId:string}
export function validBountifulMonsterZeroCommand(value:unknown):value is BountifulMonsterZeroCommand
export function bountifulMonsterZeroReplaySourceMatches(wire:unknown,command:unknown,effectTimestamp:unknown):boolean
