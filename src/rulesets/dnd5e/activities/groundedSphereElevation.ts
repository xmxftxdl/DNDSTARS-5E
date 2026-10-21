import type { Dnd5eActivityTargetV1 } from './dnd5eActivityContracts'

/** Uses sphere center elevations externally and bottom clearance in the declaration. */
export function resolveGroundedSphereElevation(target:Dnd5eActivityTargetV1,ground:number,requested:number|undefined):number|undefined {
 if(target.kind!=='area'||target.maximumBottomHeightAboveGroundFeet===undefined)return requested??ground
 const radius=target.radiusFeet,maximum=target.maximumBottomHeightAboveGroundFeet
 if(target.shape!=='sphere'||target.origin!=='point'||!Number.isFinite(radius)||radius!<=0||!Number.isFinite(maximum)||maximum<0)return undefined
 const center=requested??ground+radius!
 const bottom=center-radius!
 return Number.isFinite(center)&&bottom>=ground-1e-7&&bottom<=ground+maximum+1e-7?center:undefined
}
