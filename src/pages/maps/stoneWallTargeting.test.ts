import { describe, expect, it } from 'vitest'
import { stoneWallPanels, stoneWallNextAngle, validStoneWallLayout } from '../../rulesets/dnd5e/stoneWall'
import { stoneWallPanelPlacement } from '../../components/map/stoneWallPlacement'
import { stoneWallTargetingPanels, wallOfFireTargetingPreview } from './wallOfFireTargeting'
import type { Dnd5eSpellTargetingSession } from '../../presentation/maps/useCombatInteraction'
import type { BattleMap } from '../../store/maps'
const map: BattleMap = { id: 'map', name: 'Map', width: 2000, height: 2000, gridSize: 50, gridOffsetX: 13, gridOffsetY: 27, feetPerCell: 5, showGrid: true, tokens: [] }
function session(selected = false) { return { spellId: 'wall-of-stone', area: { shape: 'rect', origin: 'point', widthFeet: 100, heightFeet: 5, placeRangeFeet: 120 }, areaTargetCell: { col: 3, row: 4 }, areaTargetSelected: selected, stoneWall: { mode: 'thick', start: { col: 3, row: 4 }, angles: [0, 45, 90] } } as Dnd5eSpellTargetingSession }
describe('stone wall placement preview', () => {
  it.each(['thick', 'thin'] as const)('keeps %s wall material endpoints aligned at all angles with grid offsets', mode => {
    const panels = stoneWallPanels({ mode, start: { col: 3, row: 4 }, angles: [0, 45, 90, 180, 270] }, map)
    for (const panel of panels) {
      const p = stoneWallPanelPlacement(panel, map)
      const angle = p.angle * Math.PI / 180
      expect(p.length).toBeCloseTo(mode === 'thick' ? 100 : 200)
      expect(p.x - Math.cos(angle) * p.length / 2).toBeCloseTo(13 + (panel.start.col + .5) * 50)
      expect(p.y - Math.sin(angle) * p.length / 2).toBeCloseTo(27 + (panel.start.row + .5) * 50)
      expect(p.x + Math.cos(angle) * p.length / 2).toBeCloseTo(p.end.x)
      expect(p.y + Math.sin(angle) * p.length / 2).toBeCloseTo(p.end.y)
    }
  })
  it('preserves every committed panel on completion and identifies only the temporary panel', () => {
    const anchor = { col: 10, row: 10 }
    const input = { targeting: session(), anchor, caster: { col: 3, row: 3 }, map }
    const preview = wallOfFireTargetingPreview(input)!
    const committed = stoneWallPanels(session().stoneWall!, map)
    expect(preview.stoneWallPanels?.slice(0, -1)).toEqual(committed)
    expect(preview.stoneWallDraftPanelId).toBe('panel-4')
    expect(preview.cells).toEqual([])
    expect(stoneWallTargetingPanels(session(true), anchor, map)).toEqual(committed)
    expect(wallOfFireTargetingPreview({ ...input, targeting: session(true) })?.stoneWallDraftPanelId).toBeUndefined()
  })
  it('rejects an out of range initial anchor before there are panels', () => {
    const targeting = { ...session(), stoneWall: undefined, areaTargetCell: undefined }
    expect(wallOfFireTargetingPreview({ targeting, anchor: { col: 35, row: 35 }, caster: { col: 0, row: 0 }, map })?.valid).toBe(false)
  })
})

it('previews connected force panels and caps drafting at ten',()=>{
 const targeting={...session(),spellId:'wall-of-force',wallOfForceShape:'plane' as const}
 const preview=wallOfFireTargetingPreview({targeting,anchor:{col:9,row:9},caster:{col:3,row:4},map})!
 expect(preview.forceWallPreview).toBe(true)
 expect(preview.stoneWallPanels).toHaveLength(4)
 targeting.stoneWall={...targeting.stoneWall!,angles:Array(10).fill(0)}
 expect(stoneWallTargetingPanels(targeting,{col:9,row:9},map)).toHaveLength(10)
})

it('previews ice panels with the same connected endpoints as the committed layout',()=>{
 const targeting={...session(true),spellId:'wall-of-ice'}
 const preview=wallOfFireTargetingPreview({targeting,anchor:{col:9,row:9},caster:{col:3,row:4},map})!
 expect(preview.iceWallPreview).toBe(true)
 expect(preview.forceWallPreview).toBe(false)
 expect(preview.stoneWallPanels).toEqual(stoneWallPanels(targeting.stoneWall!,map))
})

it.each(['wall-of-stone','wall-of-force','wall-of-ice'])('%s shares freely rotating connected panels, including crossed layouts',spellId=>{
 const targeting={...session(),spellId,stoneWall:{mode:'thick' as const,start:{col:3,row:4},angles:[0]}}
 const angle=stoneWallNextAngle(targeting.stoneWall,{col:8,row:6},map)
 expect(angle).toBeCloseTo(Math.atan2(2,3)*180/Math.PI)
 expect(angle%45).not.toBe(0)
 const preview=wallOfFireTargetingPreview({targeting,anchor:{col:8,row:6},caster:{col:3,row:4},map})!
 const committed=stoneWallPanels({...targeting.stoneWall,angles:[0,angle]},map)
 expect(preview.stoneWallPanels).toEqual(committed)
 expect(committed[1].start).toEqual(committed[0].end)
 expect(Math.hypot(committed[1].end.col-committed[1].start.col,committed[1].end.row-committed[1].start.row)).toBeCloseTo(2)
 expect(validStoneWallLayout({...targeting.stoneWall,angles:[0,135,0,-135]})).toBe(true)
 expect(stoneWallNextAngle({...targeting.stoneWall,angles:[90]}, {col:3,row:6},map)).toBe(90)
})
