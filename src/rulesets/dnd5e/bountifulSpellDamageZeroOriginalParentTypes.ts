import type{BountifulSpellDamageZeroOriginalRawBook}from'./bountifulSpellDamageZeroOriginalRaw'
export type BountifulSpellDamageZeroOriginalPreparation=Omit<BountifulSpellDamageZeroOriginalRawBook,'sourceKind'|'rows'>&{sourceKind:'spell-damage-zero-preparation-v1'}
export type BountifulSpellDamageZeroOriginalParent=BountifulSpellDamageZeroOriginalPreparation|(BountifulSpellDamageZeroOriginalRawBook&{labels:{original:string;bless?:string;bane?:string}})
export type BountifulSpellDamageZeroOriginalParentLoader=(identity:{parentId:string;mapId:string;combatId:string})=>Promise<BountifulSpellDamageZeroOriginalParent>
