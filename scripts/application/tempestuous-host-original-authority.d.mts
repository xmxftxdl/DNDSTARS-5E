interface HostIntentContext {roomId:string}
interface HostIntentPrincipal {role:string;memberId:string}
interface HostIntentPorts {
 context(ctx:HostIntentContext):Promise<unknown>
 doc(ctx:HostIntentContext,name:string):Promise<unknown>
 load(ctx:HostIntentContext,key:string):Promise<unknown>
 save(ctx:HostIntentContext,key:string,value:unknown):Promise<void>
}
interface HostIntentResponse {ok:boolean;status?:number;error?:string;[key:string]:unknown}
export function beginTempestuousHostOriginal(ctx:HostIntentContext,payload:unknown,principal:HostIntentPrincipal,ports:HostIntentPorts):Promise<HostIntentResponse>
export function readTempestuousHostOriginal(ctx:HostIntentContext,payload:unknown,principal:HostIntentPrincipal,ports:HostIntentPorts):Promise<HostIntentResponse>
export function cancelTempestuousHostOriginal(ctx:HostIntentContext,payload:unknown,principal:HostIntentPrincipal,ports:HostIntentPorts):Promise<HostIntentResponse>
