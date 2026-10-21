import { expect, it } from 'vitest'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'
import { planDnd5eMapObjectFlight, planDnd5eMapObjectLanding } from './mapObjectFlight'

const token = (id: string, x: number, patch: Partial<Token> = {}): Token => ({ id, label: id, x, y: 75, type: 'enemy', size: 1, color: '#fff', emoji: 'T', ...patch })
const object = () => token('stone', 25, { type: 'obstacle', hp: 10, dnd5eObjectState: { schemaVersion: 1, weightPounds: 5 } })
const map = (tokens: Token[] = []): BattleMap => ({ id: 'map', name: 'Map', width: 2000, height: 2000,
  gridSize: 50, feetPerCell: 5, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [object(), ...tokens] })
const limits = { minimumWeightPounds: 1, maximumWeightPounds: 5, additionalWeightPoundsPerSlot: 5, baseSlotLevel: 1, distanceFeet: 90 }
const run = (current: BattleMap, slotLevel = 1, geometry = createEmptyMapGeometry(current.id, 1), angleDegrees = 0) =>
  planDnd5eMapObjectFlight({ map: current, geometry, objectId: 'stone', limits, slotLevel, angleDegrees })

it.each([1,2,9])('enforces known weight and slot-scaled inclusive limits at slot%s', slot => {
  for (const [weight, allowed] of [[1,true],[slot*5,true],[0.5,false],[slot*5+0.1,false]] as const) {
    const current = map();current.tokens[0].dnd5eObjectState = { schemaVersion: 1, weightPounds: weight, magical: true }
    expect(run(current,slot).ok).toBe(allowed)
  }
})
it('rejects unknown weight and carried objects without guessing from size or name', () => {
  const current = map();current.tokens[0].dnd5eObjectState = { schemaVersion: 1 }
  expect(run(current)).toEqual({ ok:false,reason:'object-weight-unknown' })
  current.tokens[0].dnd5eObjectState = { schemaVersion: 1, weightPounds: 1, wornOrCarried: true }
  expect(run(current)).toEqual({ ok:false,reason:'object-worn-or-carried' })
})
it('orders intersections independently of token-array order, ignores off-path and elevated creatures', () => {
  const current = map([token('far',500),token('near',200),token('off',100,{y:150}),token('above',100,{elevationFeet:10})])
  const before = structuredClone(current), result = run(current)
  expect(result.ok).toBe(true)
  if(result.ok) {
    expect(result.plan.creatures.map(c=>c.tokenId)).toEqual(['near','far'])
    expect(result.plan.creatures.map(c=>c.point.x)).toEqual([175,475])
    expect(result.plan.to).toEqual({x:925,y:75})
  }
  expect(current).toEqual(before)
})
it('clips at the nearest solid object and excludes creatures beyond it in every array order', () => {
  const tokens=[token('behind',800),token('before',200),token('crate',500,{type:'obstacle',hp:10}),token('near-crate',350,{type:'obstacle',hp:10})]
  for (const ordered of [tokens,[...tokens].reverse()]) {
    const result=run(map(ordered));expect(result.ok).toBe(true)
    if(result.ok) { expect(result.plan.stop).toMatchObject({kind:'object',id:'near-crate'});expect(result.plan.to.x).toBe(325);expect(result.plan.creatures.map(c=>c.tokenId)).toEqual(['before']) }
  }
})
it('stops at a physical wall even when it does not block vision or spell line of effect', () => {
  const current=map([token('behind',800)]),geometry=createEmptyMapGeometry(current.id,1)
  geometry.walls=[{id:'wall',kind:'wall',label:'Wall',points:[{x:400,y:0},{x:400,y:150}],baseHeightFeet:0,heightFeet:10,
    blocksMovement:true,blocksVision:false,blocksLineOfEffect:false,createdAt:1}]
  const result=run(current,1,geometry);expect(result.ok).toBe(true)
  if(result.ok){expect(result.plan.to.x).toBe(400);expect(result.plan.stop).toMatchObject({kind:'geometry',id:'wall'});expect(result.plan.creatures).toEqual([])}
  geometry.walls[0].baseHeightFeet=10
  const above=run(current,1,geometry);expect(above.ok && above.plan.to.x).toBe(925)
})
it('uses campaign scale and direction and stops at map bounds without inventing a damageable surface', () => {
  const current=map();current.feetPerCell=10
  const south=run(current,1,undefined,90)
  expect(south.ok).toBe(true)
  if(south.ok){expect(south.plan.to.x).toBeCloseTo(25);expect(south.plan.to.y).toBe(525)}
  const west=run(current,1,undefined,180)
  expect(west.ok).toBe(true)
  if(west.ok){expect(west.plan.to.x).toBeCloseTo(0);expect(west.plan.stop?.kind).toBe('map-boundary')}
})
it.each([-1,10,1.5,NaN])('rejects invalid spell levels%s', slot => expect(run(map(),slot).ok).toBe(false))

it('locates the first persistent wall crossing without inheriting creature movement padding', () => {
  const current=map([token('behind',500)])
  current.dnd5ePluginAreas=[{id:'wall',pluginId:'test.wall',featureId:'test.wall:barrier',sourceKind:'core-spell',coreSpellId:'wall-of-stone',
    label:'Wall',color:'#777',sourceCharacterId:'caster',sourceTokenId:'caster',cells:[{col:4,row:1}],anchorCell:{col:4,row:1},anchorMode:'fixed',
    createdRound:1,expiresAfterRound:100,vertical:{mode:'volume',baseElevationFeet:0,heightFeet:10},blocking:{movement:true,vision:true,lineOfEffect:true}}]
  const result=run(current);expect(result.ok).toBe(true)
  if(result.ok){expect(result.plan.stop).toMatchObject({kind:'geometry',id:'wall'});expect(result.plan.to.x).toBeCloseTo(200,3);expect(result.plan.creatures).toEqual([])}
})

it('uses actual 3D distance and body intersections when aimed upward', () => {
  const current=map([token('ground',200),token('high-far',400,{elevationFeet:35}),token('high-near',200,{elevationFeet:15})])
  const result=planDnd5eMapObjectFlight({map:current,objectId:'stone',limits,slotLevel:1,angleDegrees:0,pitchDegrees:45})
  expect(result.ok).toBe(true)
  if(result.ok){
    expect(result.plan.creatures.map(contact=>contact.tokenId)).toEqual(['high-near','high-far'])
    expect(result.plan.creatures[0].point.x).toBeCloseTo(175)
    expect(result.plan.creatures[0].elevationFeet).toBeCloseTo(15)
    const horizontalFeet=(result.plan.to.x-25)/10
    expect(Math.hypot(horizontalFeet,result.plan.destinationElevationFeet)).toBeCloseTo(90)
    expect(result.plan.destinationElevationFeet).toBeCloseTo(90/Math.sqrt(2))
  }
})

it('passes above a low wall but stops at a raised wall at the same XY crossing', () => {
  const current=map(),geometry=createEmptyMapGeometry(current.id,1)
  geometry.walls=[{id:'wall',kind:'wall',label:'Wall',points:[{x:400,y:0},{x:400,y:150}],baseHeightFeet:0,heightFeet:10,
    blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1}]
  const plan=()=>planDnd5eMapObjectFlight({map:current,geometry,objectId:'stone',limits,slotLevel:1,angleDegrees:0,pitchDegrees:45})
  const above=plan();expect(above.ok && above.plan.stop).toBeUndefined()
  geometry.walls[0].baseHeightFeet=35
  const hit=plan();expect(hit.ok).toBe(true)
  if(hit.ok){expect(hit.plan.stop?.id).toBe('wall');expect(hit.plan.to.x).toBeCloseTo(400);expect(hit.plan.destinationElevationFeet).toBeCloseTo(37.5)}
})

it('intersects a creature directly above the object even without horizontal displacement', () => {
  const current=map([token('above',25,{elevationFeet:20})])
  const result=planDnd5eMapObjectFlight({map:current,objectId:'stone',limits,slotLevel:1,angleDegrees:0,pitchDegrees:90})
  expect(result.ok).toBe(true)
  if(result.ok){expect(result.plan.creatures.map(c=>c.tokenId)).toEqual(['above']);expect(result.plan.creatures[0].elevationFeet).toBeCloseTo(19.9);expect(result.plan.to.x).toBeCloseTo(25)}
})

it('orders descending contacts by entry into their 3D bodies rather than their XY footprints', () => {
  const current=map([token('below',225,{elevationFeet:15}),token('ground',225)])
  current.tokens[0].elevationFeet=40
  const result=planDnd5eMapObjectFlight({map:current,objectId:'stone',limits,slotLevel:1,angleDegrees:0,pitchDegrees:-45})
  expect(result.ok).toBe(true)
  if(result.ok){expect(result.plan.creatures.map(c=>c.tokenId)).toEqual(['below']);expect(result.plan.creatures[0].point.x).toBeCloseTo(226,3)}
})

it.each([-91,91,NaN,Infinity])('rejects invalid pitch %s',pitchDegrees=>{
  expect(planDnd5eMapObjectFlight({map:map(),objectId:'stone',limits,slotLevel:1,angleDegrees:0,pitchDegrees})).toEqual({ok:false,reason:'invalid-flight-parameters'})
})

it.each([90,45])('hits a thin overhead slab through its bottom face at pitch %s',pitchDegrees=>{
  const current=map(),geometry=createEmptyMapGeometry(current.id,1)
  geometry.obstacles=[{id:'roof',kind:'obstacle',label:'Roof',points:[{x:0,y:0},{x:1000,y:0},{x:1000,y:150},{x:0,y:150}],
    baseHeightFeet:20,heightFeet:.1,blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,cover:'total',createdAt:1}]
  const result=planDnd5eMapObjectFlight({map:current,geometry,objectId:'stone',limits,slotLevel:1,angleDegrees:0,pitchDegrees})
  expect(result.ok).toBe(true)
  if(result.ok){expect(result.plan.stop?.id).toBe('roof');expect(result.plan.destinationElevationFeet).toBeCloseTo(19.9)}
})

it('stops descending flight at ground and removes all later creature contacts',()=>{
  const current=map([token('behind-ground',700,{elevationFeet:-30})]);current.tokens[0].elevationFeet=40
  const result=planDnd5eMapObjectFlight({map:current,objectId:'stone',limits,slotLevel:1,angleDegrees:0,pitchDegrees:-45})
  expect(result.ok).toBe(true)
  if(result.ok){expect(result.plan.stop?.kind).toBe('ground');expect(result.plan.to.x).toBeCloseTo(426);expect(result.plan.destinationElevationFeet).toBe(0);expect(result.plan.creatures).toEqual([])}
})

it('plans a fall to ground without preserving an airborne object elevation',()=>{
  expect(planDnd5eMapObjectLanding({map:map(),objectId:'stone',point:{x:925,y:75},elevationFeet:40})).toEqual({elevationFeet:0,fallDistanceFeet:40,support:{kind:'ground',id:'map'}})
})

it('lands on the highest solid platform below the object, but not on a ceiling above it',()=>{
  const current=map(),geometry=createEmptyMapGeometry(current.id,1)
  const slab=(id:string,base:number)=>({id,kind:'obstacle' as const,label:id,points:[{x:0,y:0},{x:500,y:0},{x:500,y:150},{x:0,y:150}],
    baseHeightFeet:base,heightFeet:1,blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,cover:'total' as const,createdAt:1})
  geometry.obstacles=[slab('lower',5),slab('ceiling',50),slab('upper',20)]
  const result=planDnd5eMapObjectLanding({map:current,geometry,objectId:'stone',point:{x:200,y:75},elevationFeet:40})
  expect(result?.support).toEqual({kind:'geometry',id:'upper'})
  expect(result?.elevationFeet).toBeCloseTo(21)
  expect(result?.fallDistanceFeet).toBeCloseTo(19)
})

it('lands on an intact mapped object but ignores destroyed objects and the launched object itself',()=>{
  const current=map([token('crate',200,{type:'obstacle',hp:10,elevationFeet:10}),token('broken',200,{type:'obstacle',hp:0,elevationFeet:30})])
  const result=planDnd5eMapObjectLanding({map:current,objectId:'stone',point:{x:200,y:75},elevationFeet:40})
  expect(result).toEqual({elevationFeet:15,fallDistanceFeet:25,support:{kind:'object',id:'crate'}})
})

it('does not treat a map marker as a launchable object, projectile blocker or landing platform',()=>{
  const current=map([token('marker',200,{type:'obstacle',obstacleKind:'marker',hp:10,elevationFeet:0})])
  const flight=run(current)
  expect(flight.ok && flight.plan.stop).toBeUndefined()
  expect(planDnd5eMapObjectLanding({map:current,objectId:'stone',point:{x:200,y:75},elevationFeet:40})?.support.kind).toBe('ground')
  current.tokens[0].obstacleKind='marker'
  expect(run(current)).toEqual({ok:false,reason:'invalid-flight-object'})
})
