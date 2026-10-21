import { expect, it, vi } from 'vitest'
import type { ReactElement, ReactNode } from 'react'
vi.mock('react-konva', () => ({ Circle: 'Circle', Group: 'Group', Line: 'Line', Rect: 'Rect', Text: 'Text' }))
vi.mock('konva', () => ({ default: {} }))
import { createEmptyMapGeometry, type MapGeometryLight } from '../../lib/mapGeometry'
import type { BattleMap } from '../../store/maps'
import { MapGeometryLayer } from './MapGeometryLayers'
import { LightingLayer } from './MapVisibilityLayers'
import { projectControlledFlameLight } from '../../../shared/controlled-flame-state.mjs'
import { controlledFlameSceneMarkers, ControlledFlameSceneLayer } from './ControlledFlameSceneLayer'

const map: BattleMap = { id: 'map', name: 'map', width: 2000, height: 2000, gridSize: 50, feetPerCell: 5,
  gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [] }
function scene() {
  const light: MapGeometryLight = { id: 'fire', kind: 'light', label: 'fire', enabled: true, points: [{ x: 1000, y: 1000 }],
    brightRadiusFeet: 20, dimRadiusFeet: 20, color: '#ffaa00', elevationFeet: 0, createdAt: 1,
    controlledFlame: { id: 'fire', burning: true, magical: false, extentFeet: 5, brightRadiusFeet: 20, dimRadiusFeet: 20,
      color: '#ffaa00', alterations: [{ id: 'effect', casterId: 'caster', kind: 'illumination', multiplier: 2, color: '#4488ff',
        appliedAtWorldMinute: 480, expiresAtWorldMinute: 540 }] } }
  return { ...createEmptyMapGeometry('map', 1), lights: [light],
    vision: { enabled: true, ambientLight: 'darkness' as const, defaultRangeFeet: 120, sharePartyVision: true } }
}
function elements(node: ReactNode): ReactElement<Record<string, any>>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!node || typeof node !== 'object' || !('props' in node)) return []
  const element = node as ReactElement<Record<string, any>>
  return [element, ...elements(element.props.children)]
}
it('DM geometry radius/color display follows temporary light and restores base at expiry', () => {
  for (const [worldMinute, radius, color] of [[539, 400, '#4488ff'], [540, 200, '#ffaa00']] as const) {
    const nodes = elements(MapGeometryLayer({ map, geometry: scene(), draft: null, editMode: true,
      tool: 'light', selectedEntityId: 'fire', inv: 1, worldMinute }))
    expect(nodes.filter(node => node.type === 'Circle' as any).some(node => node.props.radius === radius && node.props.stroke === color)).toBe(true)
    expect(nodes.some(node => node.props.radius === 6 && node.props.fill === color)).toBe(true)
  }
})
it.each([true, false])('lighting polygons use the same projected radii for DM=%s and never double server projection', isDM => {
  const geometry = scene()
  const render = (worldMinute: number, projected: boolean) => elements(LightingLayer({ map,
    geometry: projected ? { ...geometry, lights: geometry.lights.map(light => projectControlledFlameLight(light, worldMinute)) } : geometry,
    worldMinute, isDM, visionSourceTokenIds: [] }))
  const bright = (nodes: ReactElement<Record<string, any>>[]) => nodes.find(node => node.key === 'light-bright:scene:fire')?.props.points
  expect(bright(render(539, false))).toEqual(bright(render(539, true)))
  expect(bright(render(539, false))).toBeDefined()
  expect(bright(render(539, false))).not.toEqual(bright(render(540, false)))
  geometry.lights[0].controlledFlame!.burning = false
  expect(bright(render(539, false))).toBeUndefined()
})

it('shows literal image description only while the flame effect is active', () => {
  const geometry=scene()
  geometry.lights[0].controlledFlame!.alterations=[{id:'image',casterId:'caster',kind:'shape',shape:'<script>银龙</script>',appliedAtWorldMinute:480,expiresAtWorldMinute:540}]
  const input={map,geometry,worldMinute:539,isDM:true,visionSourceTokenIds:[],inv:1}
  expect(controlledFlameSceneMarkers(input)[0]?.description).toBe('<script>银龙</script>')
  const nodes=elements(ControlledFlameSceneLayer(input))
  expect(nodes.find(node=>node.props.name==='controlled-flame-image-description')?.props.text).toBe('火焰影像：<script>银龙</script>')
  expect(controlledFlameSceneMarkers({...input,worldMinute:540})).toEqual([])
  geometry.lights[0].controlledFlame!.burning=false
  expect(controlledFlameSceneMarkers(input)).toEqual([])
})

it('does not expose image descriptions beyond player sight; DM can inspect them', () => {
  const geometry=scene()
  geometry.lights[0].controlledFlame!.alterations=[{id:'image',casterId:'caster',kind:'shape',shape:'银龙',appliedAtWorldMinute:480,expiresAtWorldMinute:540}]
  const input={map:{...map,tokens:[{id:'viewer',type:'player' as const,label:'Viewer',emoji:'V',color:'#fff',x:900,y:1000,size:1}]},
    geometry,worldMinute:539,isDM:false,visionSourceTokenIds:['viewer']}
  expect(controlledFlameSceneMarkers(input)).toHaveLength(1)
  geometry.walls.push({id:'wall',kind:'wall',label:'Wall',points:[{x:950,y:0},{x:950,y:2000}],blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,baseHeightFeet:0,heightFeet:20,createdAt:1})
  expect(controlledFlameSceneMarkers(input)).toEqual([])
  expect(controlledFlameSceneMarkers({...input,isDM:true})).toHaveLength(1)
})
