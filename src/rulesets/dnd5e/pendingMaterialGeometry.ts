import {normalizeMapGeometry,type MapGeometryState} from '../../lib/mapGeometry'

export interface PendingMaterialGeometry {before:MapGeometryState;after:MapGeometryState}
/** A shared-state refresh during a dice prompt may restore the pre-cast snapshot.
 * Re-stage only that known snapshot or our own candidate; reject intervening edits. */
export function pendingMaterialGeometryCanCommit(pending:PendingMaterialGeometry,current:MapGeometryState|undefined):boolean{
 const canonical=(value:MapGeometryState|undefined)=>{
  const normalized=value&&normalizeMapGeometry(value)
  if(!normalized)return undefined
  const {updatedAt:_,...body}=normalized
  return JSON.stringify(body)
 }
 const actual=canonical(current),before=canonical(pending.before),after=canonical(pending.after)
 return actual!==undefined&&before!==undefined&&after!==undefined&&pending.before.mapId===pending.after.mapId&&(actual===before||actual===after)
}
