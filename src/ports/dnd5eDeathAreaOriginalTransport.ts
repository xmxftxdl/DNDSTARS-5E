import type{BountifulOriginalDieReceipt}from'../rulesets/dnd5e/bountifulLuckReceipt'
import type{SecondChanceParentWire}from'../lib/secondChanceParentWire'
export type BountifulDeathAreaOriginalIdentity={parentId:string;mapId:string;combatId:string}
export interface BountifulDeathAreaOriginalPool{actorId:string;characterId:string;memberId:string;count:number;sides:number;ability?:string;dc?:number;mode?:'normal';type?:string}
export interface BountifulDeathAreaOriginalBook extends BountifulDeathAreaOriginalIdentity{
 ok:true;present:true;schemaVersion:1;roomId:string;hostMemberId:string;effectTimestamp:number;requestId:string;
 originalSource:SecondChanceParentWire;originalRows:BountifulOriginalDieReceipt[];
 sourceSignature:string;revisions:Record<string,number>;area:unknown;trigger:unknown;target:unknown;round:number;turnKey:string;
 own?:BountifulDeathAreaOwnBook;
 saving:BountifulDeathAreaOriginalPool;damage:BountifulDeathAreaOriginalPool;
 pools:Partial<Record<'saving'|'damage',{announced?:{memberId:string;values:number[]};raw?:{memberId:string;values:number[]};confirmed?:{memberId:string;values:number[]}}>>
}

export interface BountifulDeathAreaOwnBook{ok:true;present:true;schemaVersion:1;sourceKind:'death-area-own-v1';roomId:string;hostMemberId:string;parentId:string;mapId:string;combatId:string;effectTimestamp:number;areaRequestId:string;sourceSignature:string;requestId:string;choiceId:string;attempt:number;spec:BountifulDeathAreaOriginalPool;decision?:{decision:'use'|'decline';memberId:string;choiceId:string;windowSignature:string};pool?:{raw?:{memberId:string;values:number[]};confirmed?:{memberId:string;values:number[]}}}
