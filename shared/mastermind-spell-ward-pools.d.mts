/** Validated input evidence only; none of these functions issues Native/World authority. */
export interface SpellWardSnapshotIdentity{roomId:string;hostMemberId:string;memberId?:string;role?:string}
export type SpellWardHash=(value:string)=>string
export type SpellWardFailure={ok:false;status:number;error:string}
export interface SpellWardCompiledSaving{effectId:string;d20:number;d20Second?:number}
export interface SpellWardInputContext{
 target:Record<string,unknown>;actor:Record<string,unknown>;character:Record<string,unknown>;
 effects:Record<string,unknown>[];sourceSignature:string
}
export function validMastermindSpellWardRequests(parent:unknown,window:unknown):boolean
export function currentMastermindSpellWardRequest(parent:unknown,window:unknown,row:unknown,snapshot:unknown,identity:SpellWardSnapshotIdentity,hash:SpellWardHash):SpellWardInputContext|undefined
export function mastermindSpellWardInputs(parent:unknown,window:unknown,snapshot:unknown,identity:SpellWardSnapshotIdentity,hash:SpellWardHash):SpellWardFailure|{ok:true;saves:SpellWardCompiledSaving[]}
export function mutateMastermindSpellWardWindow(parent:unknown,window:unknown,snapshot:unknown,identity:SpellWardSnapshotIdentity,operation:string,input:unknown,now:number,hash:SpellWardHash):SpellWardFailure|{ok:true;changed:boolean;window:unknown;requestId:string;choice?:unknown}
