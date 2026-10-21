import type {StructureLifetime} from './structure-lifetime.mjs'
export interface StructureCastingHistory {
 casterId:string;replacementGroup:string;siteKey:string;firstWorldMinute:number;lastWorldMinute:number;lastCastId:string;
}
export function normalizeStructureCastingHistory(value:unknown):StructureCastingHistory[]|undefined;
export function recordStructureCasting(history:readonly StructureCastingHistory[]|undefined,record:StructureLifetime,worldMinute:number,intervalMinutes:number,requiredMinutes:number):{history:StructureCastingHistory[];permanent:boolean};
export function recordDailyStructureCasting(history:readonly StructureCastingHistory[]|undefined,record:StructureLifetime,worldMinute:number,requiredDays?:number):{history:StructureCastingHistory[];permanent:boolean};
