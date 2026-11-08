interface Principal{role:string;memberId:string}
interface Context{roomId:string}
interface AuthorityPorts{
 context(ctx:Context):Promise<unknown>;
 nativeParent(data:unknown,mapId:string,combatId:string,parentId:string):unknown;
 doc(ctx:Context,name:string):Promise<unknown>;
 controller(data:unknown,mapId:string,actorId:string,roomId:string):unknown;
 equal(a:unknown,b:unknown):boolean;
 load(ctx:Context,key:string):Promise<unknown>;
 save(ctx:Context,key:string,value:unknown):Promise<unknown>;
}
interface Reply{ok:boolean;status?:number;error?:string;[key:string]:unknown}
export function recordStormCastOriginalPreparation(ctx:Context,payload:unknown,principal:Principal,ports:AuthorityPorts):Promise<Reply>;
export function readStormCastOriginalPreparation(ctx:Context,identity:unknown,principal:Principal,ports:AuthorityPorts):Promise<Reply>;
export function probeStormCastOriginalPreparation(ctx:Context,identity:unknown,principal:Principal,ports:AuthorityPorts):Promise<Reply>;
