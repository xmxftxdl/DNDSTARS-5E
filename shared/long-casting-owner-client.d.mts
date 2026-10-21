export interface BrowserLongCastingOwnerBinding {
  mapId:string;requestId:string;spellId:string;actorTokenId:string;actorCharacterId:string;
}
export interface BrowserLongCastingOwnerClient {
  readonly phase:'new'|'acquiring'|'active'|'lost'|'closed';
  start():Promise<boolean>;
  assertOwned():Promise<boolean>;
  close():Promise<void>;
}
export function createLongCastingOwnerClient(options:{
  binding:BrowserLongCastingOwnerBinding;instanceId:string;
  send:(command:{operation:string;binding:BrowserLongCastingOwnerBinding;instanceId:string;proof?:string},signal:AbortSignal)=>Promise<{status:number;body:Record<string,unknown>}>;
  onLost:(error:unknown)=>void|Promise<void>;onError?:(error:unknown)=>void;
  setTimer?:(callback:()=>void,ms:number)=>ReturnType<typeof setTimeout>;
  clearTimer?:(timer:ReturnType<typeof setTimeout>)=>void;
  heartbeatMs?:number;requestTimeoutMs?:number;
}):BrowserLongCastingOwnerClient;
