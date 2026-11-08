export interface PactWeaponState {
 schemaVersion:1;ownerId:string;revision:number;lastHostSecond?:number
 binding?:{inventoryInstanceId:string;weaponBaseId:string;origin:'summoned'|'ritually-bound-magic';status:'present'|'dismissed';awaySinceHostSecond?:number}
 ritual?:{kind:'binding'|'release';inventoryInstanceId:string;ritualId:string;startedHostSecond:number}
}
export interface PactWeaponHost {
 ownerId:string;worldSecond:number;transactionId?:string;hasFreeHand?:boolean;hasBladePact?:boolean;hasImprovedPactWeapon?:boolean;ownerDead?:boolean;ritualId?:string
 weaponCatalog?:{weaponBaseId:string;isWeapon:boolean;isMelee:boolean}[]
 inventory?:{inventoryInstanceId:string;weaponBaseId:string;isWeapon:boolean;isMagical?:boolean;isArtifact?:boolean;isSentient?:boolean;
  baselineMagicAttackBonus?:number;baselineMagicDamageBonus?:number;pactCreationOwnerId?:string;pactCreationTransactionId?:string;heldByActorId?:string;boundOwnerId?:string}[]
 stowedPactInstances?:{ownerId:string;inventoryInstanceId:string;weaponBaseId:string}[]
 ritualContinuity?:{ritualId:string;uninterrupted:boolean}[]
 bindingLocations?:{inventoryInstanceId:string;distanceFromOwnerFeet:number}[]
}
export type PactWeaponOperation={kind:'destroy-summoned-instance'|'release-magic-instance-at-owner-feet'|'remove-pact-bond'|'stow-bound-magic-instance'|'summon-bound-magic-instance-to-hand'|'place-new-pact-instance-in-hand';inventoryInstanceId:string;reason?:string}
export function emptyPactWeaponState(ownerId:string):PactWeaponState
export function normalizePactWeaponState(value:unknown):PactWeaponState|undefined
export function authorizePactWeaponCreation(host:PactWeaponHost,weaponBaseId:string):boolean
export function transitionPactWeapon(before:PactWeaponState,command:{ownerId:string;expectedRevision:number;kind:'summon'|'dismiss'|'advance'|'start-binding-ritual'|'start-release-ritual'|'complete-ritual';inventoryInstanceId?:string},host:PactWeaponHost):
 {ok:true;state:PactWeaponState;inventoryOperations:PactWeaponOperation[];ritualInterrupted?:boolean;lifecycleUnknown?:boolean}|{ok:false;reason:string;state:PactWeaponState;inventoryOperations:[]}
export function projectImprovedPactWeapon(state:PactWeaponState,host:PactWeaponHost,instanceId:string):{eligible:false;reason?:string}|{eligible:true;inventoryInstanceId:string;additionalAttackAndDamageBonus:number;sourceOwnerId:string}
export function pactWeaponMagicalResistanceProperty(state:PactWeaponState,host:PactWeaponHost,instanceId:string):boolean
export function pactWeaponWielderBenefits(state:PactWeaponState,host:PactWeaponHost,input:{inventoryInstanceId:string;wielderId:string;castingClassId?:string}):{proficientWithPactWeapon:boolean;warlockSpellcastingFocus:boolean}
export function pactWeaponBaseCombatQualification(state:PactWeaponState,host:PactWeaponHost,instanceId:string,wielderId:string):{proficientForOwner:boolean;countsAsMagicalAgainstResistanceAndImmunity:boolean}
