import type{BountifulDamageZeroOriginalRawBook}from'./bountifulDamageZeroOriginalRaw'
export type BountifulDamageZeroOriginalPreparation=Omit<BountifulDamageZeroOriginalRawBook,'sourceKind'|'rows'>&{sourceKind:'damage-zero-preparation-v1'}
export type BountifulDamageZeroOriginalParent=BountifulDamageZeroOriginalPreparation|(BountifulDamageZeroOriginalRawBook&{labels:{original:string;bless?:string;bane?:string}})
export type BountifulDamageZeroOriginalParentLoader=(identity:{parentId:string;mapId:string;combatId:string})=>Promise<BountifulDamageZeroOriginalParent>
