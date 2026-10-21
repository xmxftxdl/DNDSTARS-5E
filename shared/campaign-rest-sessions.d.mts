export interface CampaignRestSession {
  id:string; kind:'short-rest'|'long-rest'; characterIds:string[]; status:'active'|'interrupted'|'completed';
  startedAtWorldMinute:number; startedByMemberId:string; createdAt:number;
  interruptedAtWorldMinute?:number; interruptionReason?:'host-interrupted'|'unverified-time-advance';
  completedAtWorldMinute?:number; completionAdvanceId?:string;
}
export type CampaignRestSessionMutation =
  | {operation:'start-rest-session';id:string;kind:'short-rest'|'long-rest';characterIds:string[];expectedWorldMinute:number}
  | {operation:'interrupt-rest-session';id:string;expectedWorldMinute:number}
export function validCampaignRestSessions(value:unknown,worldMinute:number,advances?:unknown):value is CampaignRestSession[]|undefined
export function interruptCampaignRestSessionsForTimeAdvance(rows:readonly CampaignRestSession[]|undefined,worldMinute:number):CampaignRestSession[]|undefined
export function mutateCampaignRestSession<T extends {worldMinute:number;restSessions?:readonly CampaignRestSession[];updatedAt:number}>(base:T,mutation:CampaignRestSessionMutation,now:number,memberId:string,characterIds?:readonly string[]):{ok:true;changed:boolean;next:T}|{ok:false;status:number;error:string}
