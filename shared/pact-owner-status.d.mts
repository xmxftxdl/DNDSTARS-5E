export interface PactWeaponOwnerStatus { revision: number; status: 'unbound' | 'present' | 'dismissed'; origin?: 'summoned' | 'ritually-bound-magic'; summonedWeaponSlots?: ('mainWeapon' | 'offHand')[]; ritual?: { kind: string; startedSecond: number }; reviewedMagicInstances?: string[] }
export function projectPactWeaponOwnerStatus(character: unknown): PactWeaponOwnerStatus | undefined;
