import type{SharedPlayerActionState}from'../src/lib/sharedCombatTypes'
export interface MastermindMagicTruthSource{kind:'spell'|'feature';id:string;packageId:string;activityId:string;operationId:string;signature:string;ownerFeatureId:string}
export interface MastermindMagicTruthRow{origin?:undefined;id:string;roomId:string;hostMemberId:string;parentTransactionId:string;mapId:string;actorId:string;ownerId:string;actorCharacterId:string;ownerCharacterId:string;ownerMemberId:string;source:MastermindMagicTruthSource;versions:Record<string,number>;queueRevision:number;originalAction:SharedPlayerActionState;issuedAt:number;revision:number;phase:'waiting'|'answered'|'consumed';answer?:{truthfulAppearance:boolean;memberId:string;at:number};consumedAt?:number}
export interface MastermindMagicTruthJournal{schemaVersion:1;parents:Record<string,MastermindMagicTruthRow|MastermindNativeMagicTruthRow>;_sync?:{revision?:number};updatedAt?:number}
export function validMastermindMagicTruth(value:unknown):value is MastermindMagicTruthJournal
export function mutateMastermindMagicTruth(current:unknown,snapshot:unknown,identity:unknown,operation:string,input:unknown,now:number):unknown
export function projectMastermindMagicTruth(current:unknown,snapshot:unknown,identity:unknown,parentId:unknown):unknown
export function mastermindMagicTruthPublicationAllowed(current:unknown,next:unknown,snapshot:unknown,writes:unknown,transactionId:unknown,identity:unknown):boolean

export type MastermindNativeMagicTruthDescriptor={kind:'spell';combatId?:string;round:number;initiativeIndex:number;spell:{spellId:string;castingClassId:string;slotLevel:number};feature?:never}|{kind:'feature';combatId?:string;round:number;initiativeIndex:number;feature:{featureId:string;selectedActivityId?:string};spell?:never}
export interface MastermindNativeMagicTruthRow extends Omit<MastermindMagicTruthRow,'origin'|'queueRevision'|'originalAction'>{origin:'native';originalCombat?:Record<string,unknown>;nativeOriginal:MastermindNativeMagicTruthDescriptor;queueRevision?:never;originalAction?:never;nativePublication?:{transactionId:string;authorityRevisions:Record<string,number>}}
export function mastermindNativeMagicTruthTransactionId(row:{id:string}):string

export function mastermindNativeMagicTruthAuthorizedVersions(row:MastermindNativeMagicTruthRow,snapshot:Record<string,unknown>):Record<string,number>|undefined
