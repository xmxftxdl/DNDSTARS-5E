import type {Token} from '../../store/maps'
import {normalizeDnd5eMapObjectStateV1} from './mapObjectState'
export function dnd5eAnimatedObjectSnapshot(token: Token | undefined, size: 'tiny'|'small'|'medium'|'large'|'huge', casterTokenId?: string): NonNullable<Token['dnd5eSummon']>['truePolymorphOriginalObject'] | undefined {
  if (!token || token.type !== 'obstacle' || token.dnd5eSpellEffect || token.dnd5eSummon) return
  const state=normalizeDnd5eMapObjectStateV1(token.dnd5eObjectState)
  if (!state?.animateObjects || state.animateObjects.size !== size || state.attached === true || (state.attached == null && state.animateObjects.mobility === 'fixed') || state.magical || (state.wornOrCarried && (!casterTokenId || state.carrierTokenId !== casterTokenId))) return
  return {schemaVersion:1,id:token.id,label:token.label,x:token.x,y:token.y,color:token.color,emoji:token.emoji,size:token.size,
    hp:token.hp,maxHp:token.maxHp,obstacleKind:token.obstacleKind,elevationFeet:token.elevationFeet,
    portraitImageId:token.portraitImageId,tokenPortraitImageId:token.tokenPortraitImageId,showHpOnToken:token.showHpOnToken,
    showDetailOnToken:token.showDetailOnToken,visibilityMode:token.visibilityMode,
    lightSource:token.lightSource?structuredClone(token.lightSource):undefined,dnd5eObjectState:{...structuredClone(state),wornOrCarried:false,carrierTokenId:undefined}}
}
