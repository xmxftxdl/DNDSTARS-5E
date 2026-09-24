import { expect, it } from 'vitest'
import { dnd5eWallOfFireCells } from '../../rulesets/dnd5e/wallOfFireGeometry'
import { fireWallVisualClip } from './fireWallVisualClip'

const map = {width:1000,height:1000,gridSize:50,gridOffsetX:13,gridOffsetY:7}
const anchor = {col:9,row:9}
function rectangles(clip: ReturnType<typeof fireWallVisualClip>) {
  const result: number[][] = []
  clip({beginPath() {}, closePath() {}, rect: (...values) => {result.push(values)}})
  return result
}
it.each([0,45,70,90,180,295])('keeps a %i degree flame continuous across grid corners',angleDegrees => {
  const geometry = {shape:'line' as const,angleDegrees,damagingSide:'left' as const,lengthFeet:60}
  const cells = dnd5eWallOfFireCells({anchor,...geometry,map})
  expect(rectangles(fireWallVisualClip({anchor,geometry,cells,map}))).toEqual([[0,0,1000,1000]])
})
it('preserves a genuinely removed middle cell with reverse winding and grid offsets',() => {
  const geometry = {shape:'line' as const,angleDegrees:70,damagingSide:'left' as const,lengthFeet:60}
  const nominal = dnd5eWallOfFireCells({anchor,...geometry,map})
  const missing = nominal[Math.floor(nominal.length/2)]
  const cells = nominal.filter(c => c !== missing)
  expect(rectangles(fireWallVisualClip({anchor,geometry,cells,map}))).toEqual([
    [0,0,1000,1000],[(missing.col+1)*50+13,missing.row*50+7,-50,50],
  ])
  expect(rectangles(fireWallVisualClip({anchor,geometry,cells:[],map}))).toEqual([])
})
