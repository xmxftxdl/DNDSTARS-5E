/** Host-authored water selections; a blue map region is not proof of water. */
export interface Dnd5eControlledWater {
  id: string
  sourceWaterId?: string
  positionFeet: { x: number; y: number; z: number }
  dimensionsFeet: { x: number; y: number; z: number }
  color: string
  opacity: number
  alterations: Dnd5eWaterAlteration[]
  appliedActionIds: string[]
}

export type Dnd5eWaterAppearance =
  | { kind: 'shape'; description: string; drawing?: import('./surfaceDrawing').SurfaceDrawing }
  | { kind: 'appearance'; color: string; opacity: number }
  | { kind: 'freeze' }
export type Dnd5eWaterAlteration = Dnd5eWaterAppearance & {
  id: string; casterId: string; appliedAtWorldMinute: number; expiresAtWorldMinute: number
  durationMinutes?: number
  limitGroup?: string
  drawingFrameFeet?: {x:number;y:number;width:number;height:number}
}
export type Dnd5eWaterIntent = (Dnd5eWaterChange | { kind: 'dismiss' }) & {promptForChange?: boolean}
export type Dnd5eWaterChange = Dnd5eWaterAppearance |
  { kind: 'move'; displacementFeet: { x: number; y: number; z: number } }
export interface Dnd5eWaterRules {
  rangeFromBody?: true
  rangeFeet: number
  durationMinutes: number
  maximumActiveEffects: number | null
  limitGroup: string
}
type WaterResult = { ok: true; waters: Dnd5eControlledWater[] } | { ok: false; reason: string }
const validClock=(value:number)=>Number.isFinite(value)&&value>=0
const active=(water:Dnd5eControlledWater,minute:number)=>water.alterations.filter(effect=>effect.expiresAtWorldMinute>minute)

/** Base properties remain intact, so expiry cannot bake a previous spell into water. */
export function projectDnd5eControlledWater(water:Dnd5eControlledWater,worldMinute:number) {
  if(!validClock(worldMinute))throw new Error('invalid-water-clock')
  const effects=active(water,worldMinute)
  const appearance=effects.findLast(effect=>effect.kind==='appearance')
  const shape=effects.findLast(effect=>effect.kind==='shape')
  return {color:appearance?.kind==='appearance'?appearance.color:water.color,
    opacity:appearance?.kind==='appearance'?appearance.opacity:water.opacity,
    shape:shape?.kind==='shape'?shape.description:undefined,
    drawing:shape?.kind==='shape'?shape.drawing:undefined,
    drawingFrameFeet:shape?.drawingFrameFeet,
    frozen:effects.some(effect=>effect.kind==='freeze')}
}

/** The scene adapter supplies geometry, visibility and occupancy facts from Host state. */
export function changeDnd5eControlledWater(input:{
  waters:readonly Dnd5eControlledWater[]; waterId:string; casterId:string; actionId:string;
  worldMinute:number; distanceFeet:number; visible:boolean; change:Dnd5eWaterChange;
  movementPathClear?:boolean; containsCreatures?:boolean; rules?: Dnd5eWaterRules;
}):WaterResult {
  const fail=(reason:string):WaterResult=>({ok:false,reason})
  const rules=input.rules??{rangeFeet:30,durationMinutes:60,maximumActiveEffects:2,limitGroup:'shape-water'}
  if(!Number.isFinite(rules.rangeFeet)||rules.rangeFeet<0||rules.rangeFeet>10000||!Number.isInteger(rules.durationMinutes)||rules.durationMinutes<1||rules.durationMinutes>1440||
    (rules.maximumActiveEffects!==null&&(!Number.isInteger(rules.maximumActiveEffects)||rules.maximumActiveEffects<1||rules.maximumActiveEffects>256))||
    typeof rules.limitGroup!=='string'||!/^[a-z0-9][a-z0-9:._-]{0,199}$/.test(rules.limitGroup))return fail('invalid-water-rules')
  if(!input.casterId||!input.actionId||!validClock(input.worldMinute))return fail('invalid-water-declaration')
  const matches=input.waters.filter(water=>water.id===input.waterId),water=matches[0]
  if(matches.length!==1||!Object.values(water.dimensionsFeet).every(n=>Number.isFinite(n)&&n>0&&n<=5)||
    !Object.values(water.positionFeet).every(Number.isFinite))return fail('invalid-water-volume')
  if(!input.visible||!Number.isFinite(input.distanceFeet)||input.distanceFeet<0||input.distanceFeet>rules.rangeFeet)return fail('water-out-of-range-or-unseen')
  if(input.waters.some(w=>w.appliedActionIds.includes(input.actionId)))return fail('water-action-already-applied')
  if(projectDnd5eControlledWater(water,input.worldMinute).frozen)return fail('water-is-frozen')
  const waters=input.waters.map(w=>({...w,alterations:active(w,input.worldMinute)}))
  const changed=waters.find(w=>w.id===water.id)!
  if(input.change.kind==='move'){
    const delta=input.change.displacementFeet
    if(![delta.x,delta.y,delta.z].every(Number.isFinite)||Math.hypot(delta.x,delta.y,delta.z)>5+1e-7||
      Math.hypot(delta.x,delta.y,delta.z)<=0||input.movementPathClear!==true)return fail('invalid-water-movement')
    changed.positionFeet={x:water.positionFeet.x+delta.x,y:water.positionFeet.y+delta.y,z:water.positionFeet.z+delta.z}
  }else{
    if(rules.maximumActiveEffects!==null&&new Set(waters.flatMap(w=>w.alterations).filter(e=>e.casterId===input.casterId&&(e.limitGroup??'shape-water')===rules.limitGroup).map(e=>e.id)).size>=rules.maximumActiveEffects)return fail('water-effect-limit')
    const change=input.change
    if(change.kind==='freeze'&&input.containsCreatures!==false)return fail('water-freezing-occupied-or-unknown')
    if(change.kind==='shape'&&(!change.description.trim()||change.description.length>500))return fail('invalid-water-shape')
    if(change.kind==='appearance'&&(!/^#[\da-f]{6}$/i.test(change.color)||!Number.isFinite(change.opacity)||change.opacity<0||change.opacity>1))return fail('invalid-water-appearance')
    changed.alterations=[...changed.alterations,{...change,id:input.actionId,casterId:input.casterId,
      appliedAtWorldMinute:input.worldMinute,expiresAtWorldMinute:input.worldMinute+rules.durationMinutes,
      ...(input.rules?{durationMinutes:rules.durationMinutes,limitGroup:rules.limitGroup}:{})}]
  }
  changed.appliedActionIds=[...changed.appliedActionIds,input.actionId]
  return {ok:true,waters}
}

/** Cost is committed by the Activity caller; dismissal selects exactly one owned effect. */
export function dismissDnd5eWaterAlteration(waters:readonly Dnd5eControlledWater[],casterId:string,effectId:string,worldMinute:number):WaterResult {
  if(!validClock(worldMinute))return {ok:false,reason:'invalid-water-clock'}
  const matches=waters.flatMap(w=>active(w,worldMinute)).filter(effect=>effect.id===effectId)
  if(!matches.length||matches.some(effect=>effect.casterId!==casterId))return {ok:false,reason:'water-effect-not-owned'}
  return {ok:true,waters:waters.map(w=>({...w,alterations:active(w,worldMinute).filter(effect=>effect.id!==effectId)}))}
}
