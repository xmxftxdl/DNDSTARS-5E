export interface StormFuryAuthorityResult{ok:boolean;status?:number;error?:string;[key:string]:unknown}
export interface StormFuryAuthorityPrincipal{role:string;memberId?:string}
export interface StormFuryAuthorityContext{roomId:string;stateRoot:string}
export interface StormFuryAuthorityPorts{equal:(a:unknown,b:unknown)=>boolean;context:(ctx:StormFuryAuthorityContext)=>Promise<any>;doc:(ctx:StormFuryAuthorityContext,name:string)=>Promise<any>;load:(ctx:StormFuryAuthorityContext,key:string)=>Promise<any>;save:(ctx:StormFuryAuthorityContext,key:string,value:unknown)=>Promise<unknown>;controller:(data:any,mapId:string,tokenId:string,roomId:string)=>any}
export function recordStormFuryOriginal(ctx:StormFuryAuthorityContext,p:unknown,principal:StormFuryAuthorityPrincipal,api:StormFuryAuthorityPorts):Promise<StormFuryAuthorityResult>
export function readStormFuryOwnerWindow(ctx:StormFuryAuthorityContext,p:unknown,principal:StormFuryAuthorityPrincipal,api:StormFuryAuthorityPorts):Promise<StormFuryAuthorityResult>
export function recordStormFuryOwnerAnswer(ctx:StormFuryAuthorityContext,p:unknown,principal:StormFuryAuthorityPrincipal,api:StormFuryAuthorityPorts):Promise<StormFuryAuthorityResult>
export function readStormFuryOwnerDecision(ctx:StormFuryAuthorityContext,p:unknown,principal:StormFuryAuthorityPrincipal,api:StormFuryAuthorityPorts):Promise<StormFuryAuthorityResult>
