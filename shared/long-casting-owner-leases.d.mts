export interface LongCastingOwnerBinding {
  roomId:string;mapId:string;requestId:string;spellId:string;actorTokenId:string;actorCharacterId:string;
}
export interface LongCastingOwnerLeaseStore {
  restore(snapshot:unknown):void;
  snapshot():{schemaVersion:1;records:Array<{binding:LongCastingOwnerBinding;ownerId:string;proof:string;expiresAt:number}>};
  acquire(binding:LongCastingOwnerBinding,ownerId:string):{proof:string;expiresAt:number}|undefined;
  renew(binding:LongCastingOwnerBinding,ownerId:string,proof:string):{expiresAt:number}|undefined;
  release(binding:LongCastingOwnerBinding,ownerId:string,proof:string):boolean;
  isActive(binding:LongCastingOwnerBinding):boolean;
}
/** Callers authenticate DM authority and validate the current casting identity. */
export function createLongCastingOwnerLeases(options?:{now?:()=>number;createProof?:()=>string;ttlMs?:number}):LongCastingOwnerLeaseStore;
