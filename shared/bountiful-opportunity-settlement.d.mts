export function canonicalBountifulOpportunitySettlement(value:unknown):unknown
export function validBountifulOpportunitySettlementSpec(value:unknown):boolean
export function validBountifulOpportunitySettlementRolls(value:unknown,parent:unknown):boolean
export function bountifulOpportunitySettlementSource(wire:unknown,phase:'attack-late'|'post-native'|'movement-hazards',actorId?:string):Record<string,unknown>|null

export const bountifulOpportunitySequenceLateFields:readonly string[]
export function bountifulOpportunitySequenceOriginalAttack(attack:unknown):Record<string,unknown>|null

export function bountifulOpportunityCollectorSettlementSource(wire:unknown,actorId:string):Record<string,unknown>|null

export function bountifulOpportunityPostNativeSettlementSource(wire:unknown,actorId:string,windowIndex:number):Record<string,unknown>|null

export function bountifulOpportunityMovementSegmentSettlementSource(wire:unknown,segmentIndex:number):Record<string,unknown>|null
