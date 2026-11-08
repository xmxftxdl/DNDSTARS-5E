export interface BountifulOriginalPrompt {
 kind?:'equipment-reroll';promptId?:string;sourceOccurrence?:number;values?:readonly number[];candidates?:readonly {instanceId:string;effectId:string;resourceId:string;itemName:string;dieIndices:readonly number[]}[]
 round?:number;initiativeIndex?:number
 receiptId:string;parentId:string;occurrence:number;mapId:string;combatId:string
 phase:'owner-choice'|'roll'|'native-lucky-choice';ownerId?:string;featureId?:string;rollerTokenId:string
 rollerCharacterId?:string;originalRolls?:readonly number[];dieIndex?:number;rollRequestId?:string;count?:number;sides?:number
}
export function validateBountifulOriginalParents(value:unknown):boolean
export function validateBountifulLuckCommand(value:unknown):boolean
export function projectBountifulOriginalPrompts(parents:unknown,memberId:unknown):BountifulOriginalPrompt[]

export function bountifulNativeLuckyDeclined(row:unknown):boolean
export function bountifulOriginalRowReady(row:unknown):boolean
