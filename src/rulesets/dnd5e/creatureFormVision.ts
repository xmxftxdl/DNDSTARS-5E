import {getDnd5eSrdMonster} from './monsters'

/** Numeric projection only; form identity and mechanics stay in Host data. */
export function dnd5eCreatureFormVision(state: {wildShapeFormId?: string; wildShapeMode?: string} | undefined) {
  const form=state?.wildShapeFormId ? getDnd5eSrdMonster(state.wildShapeFormId) : undefined
  if(!form)return {dnd5eFormDarkvisionRangeFeet:undefined,dnd5eFormRetainsDarkvision:undefined}
  const range=Math.max(0,...(form.senses??[]).filter(sense=>/darkvision|黑暗视觉/i.test(sense.name)).map(sense=>sense.distanceFeet??0))
  return {dnd5eFormDarkvisionRangeFeet:range,dnd5eFormRetainsDarkvision:state?.wildShapeMode==null||state.wildShapeMode==='wild-shape'||state.wildShapeMode==='shapechange'}
}
