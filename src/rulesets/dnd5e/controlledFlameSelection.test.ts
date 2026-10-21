import { expect, it } from 'vitest'
import { createEmptyMapGeometry, type MapGeometryLight } from '../../lib/mapGeometry'
import type { BattleMap } from '../../store/maps'
import { controlledFlameSelectionOptions, requestControlledFlameSelection } from './controlledFlameSelection'

function fixture() {
  const light = (id: string, x: number, burning: boolean): MapGeometryLight => ({
    id, kind: 'light', label: id, points: [{ x, y: 50 }], enabled: true,
    brightRadiusFeet: 20, dimRadiusFeet: 20, color: '#ffaa00', elevationFeet: 0, createdAt: 1,
    controlledFlame: { id, magical: false, burning, extentFeet: 5, fuelAvailable: !burning,
      brightRadiusFeet: 20, dimRadiusFeet: 20, color: '#ffaa00', alterations: [] },
  })
  const map: BattleMap = { id: 'map', name: 'Map', width: 1000, height: 1000, gridSize: 50,
    feetPerCell: 5, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
    tokens: [{ id: 'caster', label: 'Caster', type: 'player', x: 0, y: 50, size: 1, color: '#fff', emoji: 'C' }] }
  return { map, geometries: [{ ...createEmptyMapGeometry('map', 1),
    lights: [light('fire', 50, true), light('fuel', 100, false), light('far-fuel', 300, false)],
    vision: { enabled: true, ambientLight: 'bright' as const, defaultRangeFeet: 120, sharePartyVision: true } }],
    actorTokenId: 'caster', casterId: 'character:caster', actionId: 'cast', worldMinute: 480 }
}
it('offers only valid spread pairs without modifying the room', () => {
  const scene = fixture(), before = structuredClone(scene)
  const options = controlledFlameSelectionOptions(scene, { kind: 'spread' })
  expect(options.map(option => option.selection)).toEqual([{ lightId: 'fire', destinationId: 'fuel' }])
  expect(scene).toEqual(before)
})
it('rejects a destination moved while the player chooses', async () => {
  const scene = fixture()
  const result = await requestControlledFlameSelection({ readScene: () => scene, intent: { kind: 'spread' },
    choose: async options => { scene.geometries[0].lights[1].points[0].x = 400; return options[0].id } })
  expect(result).toBeUndefined()
  expect(scene.geometries[0].lights[1].controlledFlame?.burning).toBe(false)
})
it.each([undefined, 'forged-choice'])('does not accept cancellation or a forged choice: %s', async value => {
  const scene = fixture()
  expect(await requestControlledFlameSelection({ readScene: () => scene, intent: { kind: 'extinguish' },
    choose: async () => value })).toBeUndefined()
})
it('returns a valid player selection without applying it', async () => {
  const scene = fixture()
  expect(await requestControlledFlameSelection({ readScene: () => scene, intent: { kind: 'spread' },
    choose: async options => options[0].id })).toEqual({ lightId: 'fire', destinationId: 'fuel' })
  expect(scene.geometries[0].lights[1].controlledFlame?.burning).toBe(false)
})
it('only lists owned, unexpired alterations for dismissal', () => {
  const scene = fixture()
  scene.geometries[0].lights[0].controlledFlame!.alterations = ['own', 'other', 'expired'].map(id => ({
    id, casterId: id === 'other' ? 'another-caster' : scene.casterId, kind: 'shape', shape: 'curl',
    appliedAtWorldMinute: id === 'expired' ? 420 : 480, expiresAtWorldMinute: id === 'expired' ? 480 : 540,
  }))
  expect(controlledFlameSelectionOptions(scene, { kind: 'dismiss' }).map(option => option.selection.effectId)).toEqual(['own'])
})

it('offers owned effects on another map and rejects a choice that expires during selection', async () => {
 const scene=fixture(), other={...structuredClone(scene.geometries[0]),mapId:'other-map'}
 other.lights[0].controlledFlame!.alterations=[{id:'remote-effect',casterId:scene.casterId,kind:'shape',shape:'curl',
  appliedAtWorldMinute:480,expiresAtWorldMinute:540}]
 scene.geometries.push(other)
 const options=controlledFlameSelectionOptions(scene,{kind:'dismiss'})
 expect(options.map(option=>option.selection)).toEqual([{mapId:'other-map',lightId:'fire',effectId:'remote-effect'}])
 expect(options[0].label).toContain('other-map')
 expect(controlledFlameSelectionOptions(scene,{kind:'extinguish'}).every(option=>!option.selection.mapId)).toBe(true)
 expect(await requestControlledFlameSelection({readScene:()=>scene,intent:{kind:'dismiss'},choose:async choices=>{
  scene.worldMinute=540;return choices[0].id
 }})).toBeUndefined()
})

it.each(['valid','moved','actor-moved','carried','cancelled'] as const)('touch ignition revalidates selected fuel: %s',async mode=>{
 const scene=fixture(),fuel=scene.geometries[0].lights[1]
 fuel.points[0].x=50;fuel.controlledFlame!.custody='unattended'
 const options=controlledFlameSelectionOptions(scene,{kind:'ignite-touch'})
 expect(options.map(o=>o.selection.lightId)).toEqual(['fuel'])
 const selection=await requestControlledFlameSelection({readScene:()=>scene,intent:{kind:'ignite-touch'},choose:async choices=>{
   if(mode==='moved')fuel.points[0].x=300
   if(mode==='actor-moved')scene.map.tokens[0].x=300
   if(mode==='carried')fuel.controlledFlame!.custody='carried'
   return mode==='cancelled'?undefined:choices[0].id
 }})
 expect(selection).toEqual(mode==='valid'?{lightId:'fuel'}:undefined)
 expect(fuel.controlledFlame!.burning).toBe(false)
})
