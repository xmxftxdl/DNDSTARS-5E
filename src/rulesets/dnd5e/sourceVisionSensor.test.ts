import { expect, it } from 'vitest'
import { projectDnd5eSourceVisionSensor, compileDnd5eEffectiveVisionProfile, applyDnd5eEffectiveVisionProfile, resolveDnd5eVisionSensorSource } from '../../../shared/dnd5e-vision-profile.mjs'
import { mapViewportRelevantCharacterIds } from '../../presentation/maps/mapViewportCharacters'
import { normalizeCharacter } from '../../store/characters'
import { projectCharacterTokenPresentations, migrateMapsState, type Token } from '../../store/maps'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { validateDnd5eActivityDefinitionV1 } from './activities/dnd5eActivityValidation'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { projectMapsForPlayer } from '../../../scripts/shared-server-core.mjs'
import { resolvePlayerVisionSourceTokenIds } from '../../lib/playerVision'
import { mapGeometryCanSeeToken, mapGeometryVisibilityPolygon } from '../../lib/mapGeometry'

const source: Token = { id: 'source', characterId: 'owner', type: 'player', label: 'Owner', x: 25, y: 25, size: 1, emoji: '', color: '', visionRangeFeet: 90, blindsightRangeFeet: 10, truesightRangeFeet: 60 }
const sensor: Token = { id: 'sensor', type: 'obstacle', label: 'Sensor', x: 225, y: 225, size: 0.25, emoji: '', color: '',
  dnd5eSpellEffect: { schemaVersion: 1, spellId: 'eyes', sourceCharacterId: 'owner', sourceTokenId: 'source', createdRound: 1, expiresAfterRound: 101,
    shareVisionWithSource: true, visionFromSource: true, hiddenBody: true } }

it.each(['sight', 'both'] as const)('reveals invisible %s sensors only to observers who can actually see invisible things', (sense) => {
  const viewer = { ...source, id: 'observer', characterId: 'observer-character', truesightRangeFeet: 0, blindsightRangeFeet: 0 }
  const target = { ...sensor, x: 125, y: 25, dnd5eSpellEffect: { ...sensor.dnd5eSpellEffect!, sensorSense: sense === 'sight' ? 'sight' as const : undefined, hearingFromSource: true } }
  const area = { id: 'sensor-area', sourceTokenId: 'source', sourceCharacterId: 'owner', anchorMode: 'effect-token', anchorTokenId: 'sensor' }
  const see = createDnd5eMechanicalEffect({ id: 'seeing', definitionId: 'seeing', label: 'See invisible', targetId: 'observer-character', source: { kind: 'spell' }, modifiers: { seeInvisible: true } })
  const project = (effects: typeof see[], patch: Partial<Token> = {}, blinded = false) => projectMapsForPlayer({maps:[{
    id:'scene',width:500,height:500,gridSize:50,feetPerCell:5,tokens:[{...viewer,...patch},target],dnd5ePluginAreas:[area],
  }]},{maps:[{mapId:'scene',walls:[],doors:[],windows:[],obstacles:[],lights:[],vision:{enabled:true,ambientLight:'bright',defaultRangeFeet:60,sharePartyVision:false}}]},
  'observer-character',{characters:[{id:'observer-character',roomMemberId:'observer-member',conditions:blinded?['blinded']:[],dnd5eCombatState:{activeEffects:effects}}]},
  {memberId:'observer-member'}) as {maps:Array<{tokens:Token[];dnd5ePluginAreas:unknown[]}>}
  expect(project([]).maps[0].tokens.some(t=>t.id==='sensor')).toBe(false)
  expect(project([]).maps[0].dnd5ePluginAreas).toEqual([])
  const visible = project([see]).maps[0].tokens.find(t=>t.id==='sensor')!
  expect(visible).toMatchObject({dnd5eSensorVisible:true,dnd5eSpellEffect:{hiddenBody:true},viewerControlled:false})
  expect(migrateMapsState({maps:[{id:'scene',tokens:[visible]}]}).maps[0].tokens[0].dnd5eSensorVisible).toBe(true)
  expect(project([{...see,suspendedBy:['antimagic']}]).maps[0].tokens.some(t=>t.id==='sensor')).toBe(false)
  expect(project([see],{},true).maps[0].tokens.some(t=>t.id==='sensor')).toBe(false)
  expect(project([],{truesightRangeFeet:5}).maps[0].tokens.some(t=>t.id==='sensor')).toBe(false)
  expect(project([],{truesightRangeFeet:30}).maps[0].tokens.find(t=>t.id==='sensor')?.dnd5eSensorVisible).toBe(true)
  expect(project([],{blindsightRangeFeet:30}).maps[0].tokens.some(t=>t.id==='sensor')).toBe(false)
})

it('preserves exclusive sensor senses through reload and hides remote creatures in hearing mode', () => {
  const hearing: Token = { ...sensor, dnd5eSpellEffect: { ...sensor.dnd5eSpellEffect!, hearingFromSource: true, sensorSense: 'hearing' } }
  const enemy: Token = { id:'nearby',type:'enemy',label:'Nearby',x:275,y:225,size:1,emoji:'',color:'' }
  const maps=migrateMapsState({maps:[{id:'home',width:500,height:500,gridSize:50,tokens:[source]},
    {id:'remote',width:500,height:500,gridSize:50,tokens:[hearing,enemy]}]}).maps
  expect(maps[1].tokens[0].dnd5eSpellEffect?.sensorSense).toBe('hearing')
  const projected=projectDnd5eSourceVisionSensor(maps[1].tokens[0],{sourceToken:source})
  expect(projected).toMatchObject({visionRangeFeet:0,dnd5eSourceSightDisabled:true})
  expect(projected.blindsightRangeFeet).toBeUndefined()
  expect(projected.truesightRangeFeet).toBeUndefined()
  expect(projected.dnd5eSourceHearingDisabled).toBeUndefined()
  const geometry={mapId:'remote',walls:[],doors:[],windows:[],obstacles:[],lights:[],vision:{enabled:true,ambientLight:'bright' as const,defaultRangeFeet:60,sharePartyVision:false},updatedAt:0}
  expect(mapGeometryCanSeeToken({map:maps[1],geometry,viewer:projected,target:enemy})).toBe(false)
  expect(mapGeometryVisibilityPolygon({map:maps[1],geometry,viewer:projected})).toEqual([])
  const character={id:'owner',roomMemberId:'member-owner'}
  const view=projectMapsForPlayer({maps},{maps:[geometry]},'owner',{characters:[character]},{memberId:'member-owner'}) as {maps:Array<{tokens:Token[]}>}
  expect(view.maps[1].tokens.some(t=>t.id===enemy.id)).toBe(false)
  const sight=projectDnd5eSourceVisionSensor({...projected,dnd5eSpellEffect:{...projected.dnd5eSpellEffect!,sensorSense:'sight'}},{sourceToken:source})
  expect(sight.visionRangeFeet).toBe(90)
  expect(sight.dnd5eSourceSightDisabled).toBeUndefined()
  expect(sight.dnd5eSourceHearingDisabled).toBe(true)
})

it('projects explicitly granted hearing independently of blindness and clears stale deafness', () => {
  const hearing = { ...sensor, dnd5eSpellEffect: { ...sensor.dnd5eSpellEffect!, hearingFromSource: true as const } }
  const deafness = createDnd5eMechanicalEffect({ id: 'deaf', definitionId: 'deaf', label: 'Deaf', targetId: 'source', source: { kind: 'spell' }, legacyCondition: 'deafened' })
  const deaf = projectDnd5eSourceVisionSensor(hearing, { sourceToken: source, character: { dnd5eCombatState: { activeEffects: [deafness] } } })
  expect(deaf.dnd5eSourceHearingDisabled).toBe(true)
  expect(deaf.dnd5eSourceSightDisabled).toBeUndefined()
  const saved = migrateMapsState(JSON.parse(JSON.stringify({ maps: [{ id: 'hearing', width: 500, height: 500, gridSize: 50, tokens: [deaf] }] }))).maps[0].tokens[0]
  expect(saved.dnd5eSpellEffect?.hearingFromSource).toBe(true)
  expect(saved.dnd5eSourceHearingDisabled).toBe(true)
  expect(projectDnd5eSourceVisionSensor(saved, { sourceToken: source }).dnd5eSourceHearingDisabled).toBeUndefined()
  expect(projectDnd5eSourceVisionSensor(hearing, { sourceToken: source, character: { conditions: ['失明'] } }).dnd5eSourceHearingDisabled).toBeUndefined()
  expect(projectDnd5eSourceVisionSensor(hearing, { sourceToken: source, character: { dnd5eCombatState: { activeEffects: [{ ...deafness, suspendedBy: ['antimagic'] }] } } }).dnd5eSourceHearingDisabled).toBeUndefined()
  expect(projectDnd5eSourceVisionSensor(hearing, {}).dnd5eSourceHearingDisabled).toBe(true)
  expect(projectDnd5eSourceVisionSensor(sensor, { sourceToken: source, character: { conditions: ['耳聋'] } }).dnd5eSourceHearingDisabled).toBeUndefined()
})

it('inherits source blindness without retaining stale visual ranges, and restores sight when it ends', () => {
  const blindness = createDnd5eMechanicalEffect({ id: 'blind', definitionId: 'blind', label: 'Blind', targetId: 'source', source: { kind: 'spell' }, legacyCondition: 'blinded' })
  const project = (effects: typeof blindness[]) => projectDnd5eSourceVisionSensor(sensor, { sourceToken: source,
    character: { darkvisionRangeFeet: 90, dnd5eCombatState: { activeEffects: effects } } })
  const blind = project([blindness])
  expect(blind).toMatchObject({ dnd5eSourceSightDisabled: true, visionRangeFeet: 0, blindsightRangeFeet: 10 })
  expect(blind.darkvisionRangeFeet).toBeUndefined()
  expect(blind.truesightRangeFeet).toBeUndefined()
  const restored = migrateMapsState(JSON.parse(JSON.stringify({ maps: [{ id: 'blind-map', width: 500, height: 500, gridSize: 50, tokens: [blind] }] }))).maps[0].tokens[0]
  expect(restored.dnd5eSourceSightDisabled).toBe(true)
  expect(compileDnd5eEffectiveVisionProfile({ token: JSON.parse(JSON.stringify(blind)) }).darkvisionRangeFeet).toBe(0)
  const recovered = projectDnd5eSourceVisionSensor(blind, { sourceToken: source, character: { darkvisionRangeFeet: 90 } })
  expect(recovered.dnd5eSourceSightDisabled).toBeUndefined()
  expect(recovered).toMatchObject({ visionRangeFeet: 90, darkvisionRangeFeet: 90, truesightRangeFeet: 60 })
  expect(project([{ ...blindness, suspendedBy: ['antimagic'] }]).dnd5eSourceSightDisabled).toBeUndefined()
  expect(projectDnd5eSourceVisionSensor(sensor, { sourceToken: source, character: { conditions: ['失明'] } }).dnd5eSourceSightDisabled).toBe(true)
})

it.each(['token','character'] as const)('inherits source sight limits from %s and clears them from a reused sensor', location => {
  const cap=createDnd5eMechanicalEffect({definitionId:'test:sight-cap',label:'Sight cap',targetId:'source',source:{kind:'feature',magical:true},modifiers:{sightRangeLimitFeet:5}})
  const owner={...source,blindsightRangeFeet:0}
  const project=(effects:typeof cap[],previous=sensor)=>projectDnd5eSourceVisionSensor(previous,{
    sourceToken:location==='token'?{...owner,dnd5eCombatState:{activeEffects:effects}}:owner,
    character:location==='character'?{dnd5eCombatState:{activeEffects:effects}}:undefined,
  })
  const limited=project([cap])
  expect(compileDnd5eEffectiveVisionProfile({token:limited}).sightRangeLimitFeet).toBe(5)
  const restored=migrateMapsState(JSON.parse(JSON.stringify({maps:[{id:'cap-map',width:500,height:500,gridSize:50,tokens:[limited]}]}))).maps[0].tokens[0]
  expect(compileDnd5eEffectiveVisionProfile({token:restored}).sightRangeLimitFeet).toBe(5)
  expect(compileDnd5eEffectiveVisionProfile({token:{...restored,dnd5eCombatState:{activeEffects:[]}}}).sightRangeLimitFeet).toBe(5)
  const map={id:'cap-map',name:'Map',width:500,height:500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[restored]}
  expect(mapGeometryCanSeeToken({map,viewer:restored,target:{...restored,id:'far',x:425}})).toBe(false)
  const far:Token={id:'far-enemy',type:'enemy',label:'Far',x:425,y:225,size:1,color:'',emoji:''}
  const ownerToken=location==='token'?{...owner,dnd5eCombatState:{activeEffects:[cap]}}:owner
  const room=projectMapsForPlayer({maps:[{...map,tokens:[ownerToken,sensor,far]}]},
    {maps:[{mapId:map.id,walls:[],doors:[],windows:[],obstacles:[],lights:[],vision:{enabled:true,ambientLight:'bright',defaultRangeFeet:120,sharePartyVision:false}}]},
    'owner',{characters:[{id:'owner',roomMemberId:'member',...(location==='character'?{dnd5eCombatState:{activeEffects:[cap]}}:{})}]},
    {memberId:'member'}) as {maps:{tokens:Token[]}[]}
  expect(room.maps[0].tokens.map(token=>token.id)).not.toContain(far.id)
  expect(compileDnd5eEffectiveVisionProfile({token:project([],restored)}).sightRangeLimitFeet).toBeUndefined()
  expect(compileDnd5eEffectiveVisionProfile({token:project([{...cap,suspendedBy:['antimagic']}],restored)}).sightRangeLimitFeet).toBeUndefined()
})

it('does not reveal distant bright targets through a blind sensor on either server or client', () => {
  const enemy: Token = { id: 'distant', type: 'enemy', label: 'Distant', x: 425, y: 225, size: 1, color: '', emoji: '' }
  const maps = migrateMapsState({ maps: [
    { id: 'home', width: 500, height: 500, gridSize: 50, tokens: [source] },
    { id: 'remote', width: 500, height: 500, gridSize: 50, tokens: [sensor, enemy] },
  ] }).maps
  const geometry = { mapId: 'remote', walls: [], doors: [], windows: [], obstacles: [], lights: [],
    vision: { enabled: true, ambientLight: 'bright' as const, defaultRangeFeet: 60, sharePartyVision: false }, updatedAt: 0 }
  const character = { id: 'owner', roomMemberId: 'member-owner', conditions: ['blinded'], darkvisionRangeFeet: 90 }
  const projected = projectMapsForPlayer({ maps }, { maps: [geometry] }, 'owner', { characters: [character] }, { memberId: 'member-owner' }) as {maps: Array<{tokens: Token[]}>}
  expect(projected.maps[1].tokens.some(token => token.id === 'distant')).toBe(false)
  const blind = projectDnd5eSourceVisionSensor(sensor, { sourceToken: source, character })
  expect(mapGeometryCanSeeToken({ map: maps[1], geometry, viewer: blind, target: enemy })).toBe(false)
  const polygon = mapGeometryVisibilityPolygon({ map: maps[1], geometry, viewer: blind })
  expect(polygon.length).toBeGreaterThan(0)
  expect(polygon.every(point => Math.hypot(point.x - blind.x, point.y - blind.y) <= 100.001)).toBe(true)
  expect(mapGeometryVisibilityPolygon({ map: maps[1], geometry, viewer: { ...blind, blindsightRangeFeet: 0 } })).toEqual([])
  const recovered = projectMapsForPlayer({ maps }, { maps: [geometry] }, 'owner', { characters: [{...character,conditions:[]}] }, { memberId: 'member-owner' }) as typeof projected
  expect(recovered.maps[1].tokens.some(token => token.id === 'distant')).toBe(true)
})

it('selects only the owner live concentration viewpoint and restores normal scene when it ends', () => {
  const concentrationId = 'activity:eyes'
  const character = normalizeCharacter({ id: 'owner', roomMemberId: 'member-owner',
    dnd5eCombatState: { concentrationSpellId: concentrationId } })
  const remoteSensor = { ...sensor, dnd5eSpellEffect: { ...sensor.dnd5eSpellEffect!, concentrationId } }
  const area = { anchorMode: 'effect-token', anchorTokenId: 'sensor', sourceCharacterId: 'owner', sourceTokenId: 'source', concentrationId, expiresAtWorldMinute: 110 }
  const maps: Array<{ id: string; width: number; height: number; gridSize: number; feetPerCell: number; tokens: Token[]; dnd5ePluginAreas?: typeof area[] }> = [{ id: 'home', width: 500, height: 500, gridSize: 50, feetPerCell: 5, tokens: [source] },
    { id: 'remote', width: 500, height: 500, gridSize: 50, feetPerCell: 5, tokens: [remoteSensor], dnd5ePluginAreas: [area] }]
  const project = (entries = maps, owner = character, memberId = 'member-owner', minute: number | null = 100) =>
    projectMapsForPlayer({ maps: entries, selectedId: 'home' }, { maps: [] }, 'owner', { characters: [owner] }, { memberId }, null, minute) as { selectedId: string; maps: Array<{dnd5ePluginAreas?: typeof area[]}> }
  expect(project().selectedId).toBe('remote')
  expect(project().maps[1].dnd5ePluginAreas).toEqual([area])
  expect(project(maps, character, 'other-member').maps[1].dnd5ePluginAreas).toEqual([])
  expect(project(maps, character, 'other-member').selectedId).toBe('home')
  expect(project(maps, { ...character, dnd5eCombatState: {} }).selectedId).toBe('home')
  expect(project(maps, character, 'member-owner', 110).selectedId).toBe('home')
  expect(project(maps, character, 'member-owner', null).selectedId).toBe('home')
  expect(project([maps[0], { ...maps[1], dnd5ePluginAreas: [] }]).selectedId).toBe('home')
  expect(project([...maps, { ...maps[1], id: 'ambiguous' }]).selectedId).toBe('home')
  expect(project(JSON.parse(JSON.stringify(maps))).selectedId).toBe('remote')
})

it('keeps remote source senses through server projection, client presentation and a source token relocation', () => {
  const character = normalizeCharacter({ id: 'owner', name: 'Owner', roomMemberId: 'member-owner' })
  const remoteSource = { ...source, id: 'relocated-source', visionRangeFeet: 75, truesightRangeFeet: 30 }
  const maps = [{ id: 'home', name: 'Home', width: 500, height: 500, gridSize: 50, feetPerCell: 5, tokens: [remoteSource] },
    { id: 'destination', name: 'Destination', width: 500, height: 500, gridSize: 50, feetPerCell: 5, tokens: [sensor] }]
  const projected = projectMapsForPlayer({ maps }, { maps: [] }, 'owner', { characters: [character] }, { memberId: 'member-owner' }) as { maps: { tokens: Token[] }[] }
  const result = projected.maps[1].tokens.find(token => token.id === sensor.id)!
  expect(result).toMatchObject({ x: 225, y: 225, visionRangeFeet: 75, truesightRangeFeet: 30, blindsightRangeFeet: 10, viewerControlled: true })
  expect(mapViewportRelevantCharacterIds([character], [sensor])).toEqual(['owner'])
  const reloaded = JSON.parse(JSON.stringify(projected)) as typeof projected
  expect(projectCharacterTokenPresentations(reloaded.maps[1].tokens, [character], reloaded.maps.flatMap(map => map.tokens))[0])
    .toMatchObject({ visionRangeFeet: 75, truesightRangeFeet: 30, blindsightRangeFeet: 10 })
  expect(resolveDnd5eVisionSensorSource(sensor, maps.flatMap(map => map.tokens))).toBe(remoteSource)
})

it('does not select an ambiguous or mismatched remote source identity', () => {
  expect(resolveDnd5eVisionSensorSource(sensor, [source, { ...source }])).toBeUndefined()
  expect(resolveDnd5eVisionSensorSource(sensor, [{ ...source, characterId: 'someone-else' }])).toBeUndefined()
  expect(resolveDnd5eVisionSensorSource(sensor, [{ ...source, id: 'a' }, { ...source, id: 'b' }])).toBeUndefined()
  expect(resolveDnd5eVisionSensorSource(sensor, [sensor])).toBeUndefined()
})

it('inherits live see-invisibility and withdraws it on suppression, removal or source blindness', () => {
  const seeing = createDnd5eMechanicalEffect({ id: 'see', definitionId: 'see', label: 'See Invisible', targetId: 'source',
    source: { kind: 'spell' }, modifiers: { seeInvisible: true } })
  const plainSource = { ...source, blindsightRangeFeet: 0, truesightRangeFeet: 0 }
  const target = { id: 'invisible-target', type: 'enemy', label: 'Secret enemy', x: 425, y: 225, size: 1,
    dnd5eCombatState: { conditions: ['invisible'] } }
  const maps = [{ id: 'home', width: 500, height: 500, gridSize: 50, feetPerCell: 5, tokens: [plainSource] },
    { id: 'remote', width: 500, height: 500, gridSize: 50, feetPerCell: 5, tokens: [sensor, target] }]
  const project = (effects: typeof seeing[], conditions: string[] = []) => projectMapsForPlayer({ maps },
    { maps: [{mapId:'remote', walls:[], doors:[], windows:[], obstacles:[], lights:[], vision:{enabled:true,ambientLight:'bright',defaultRangeFeet:60,sharePartyVision:false}}] }, 'owner',
    { characters: [{ id: 'owner', roomMemberId: 'member-owner', conditions, dnd5eCombatState: { activeEffects: effects } }] },
    { memberId: 'member-owner' }) as { maps: Array<{tokens: Token[]}> }
  const visible = project([seeing]).maps[1].tokens
  expect(visible.find(token => token.id === target.id)?.label).toBe('Secret enemy')
  const observed = visible.find(token => token.id === sensor.id)!
  expect(observed.dnd5eSourceSeeInvisible).toBe(true)
  const restored = migrateMapsState(JSON.parse(JSON.stringify({ maps: [{ ...maps[1], tokens: [observed] }] }))).maps[0].tokens[0]
  expect(restored.dnd5eSourceSeeInvisible).toBe(true)
  expect(projectDnd5eSourceVisionSensor(restored, { sourceToken: plainSource, character: { dnd5eCombatState: { activeEffects: [] } } }).dnd5eSourceSeeInvisible).toBeUndefined()
  for (const effects of [[], [{ ...seeing, suspendedBy: ['antimagic'] }]]) {
    expect(project(effects).maps[1].tokens.find(token => token.id === target.id)?.label).toBe('未见生物')
    expect(project(effects).maps[1].tokens.find(token => token.id === sensor.id)?.dnd5eSourceSeeInvisible).toBeUndefined()
  }
  expect(project([seeing], ['blinded']).maps[1].tokens.find(token => token.id === target.id)).toBeUndefined()
})

it('reveals a linked invisible projection only to eligible sighted observers and retains its area anchor', () => {
  const ghost = { ...sensor, id: 'ghost', type: 'obstacle', x: 225, y: 225,
    dnd5eSpellEffect: { ...sensor.dnd5eSpellEffect, linkedTargetProjection: { name: 'Captive', presentation: { emoji: 'V', color: '#ffffff', size: 1 } } } }
  const viewer = { id: 'viewer', characterId: 'observer', type: 'player', x: 125, y: 225, size: 1, visionRangeFeet: 60 }
  const seeing = createDnd5eMechanicalEffect({ id: 'seeing', definitionId: 'seeing', label: 'See invisible', targetId: viewer.id,
    source: { kind: 'spell' }, modifiers: { seeInvisible: true } })
  const area = { id: 'ghost-area', sourceTokenId: ghost.dnd5eSpellEffect.sourceTokenId, anchorMode: 'effect-token', anchorTokenId: ghost.id }
  const project = (effects: typeof seeing[], conditions: string[] = [], truesightRangeFeet = 0) => projectMapsForPlayer({ maps: [
    { id: 'remote', width: 500, height: 500, gridSize: 50, feetPerCell: 5, tokens: [{ ...viewer, truesightRangeFeet }, ghost], dnd5ePluginAreas: [area] },
  ] }, { maps: [{mapId:'remote',walls:[],doors:[],windows:[],obstacles:[],lights:[],vision:{enabled:true,ambientLight:'bright',defaultRangeFeet:60,sharePartyVision:false}}] }, 'observer',
  { characters: [{ id:'observer',roomMemberId:'member',conditions,dnd5eCombatState:{activeEffects:effects} }] }, {memberId:'member'}) as { maps: Array<{tokens: Token[]; dnd5ePluginAreas:unknown[]}> }
  expect(project([]).maps[0].tokens.some(token => token.id === ghost.id)).toBe(false)
  const visible = project([seeing]).maps[0]
  expect(visible.tokens.find(token => token.id === ghost.id)?.dnd5eLinkedProjectionVisible).toBe(true)
  expect(visible.dnd5ePluginAreas).toHaveLength(1)
  expect(project([{...seeing,suspendedBy:['antimagic']}]).maps[0].tokens.some(token => token.id === ghost.id)).toBe(false)
  expect(project([seeing],['blinded']).maps[0].tokens.some(token => token.id === ghost.id)).toBe(false)
  expect(project([],[],30).maps[0].tokens.find(token => token.id === ghost.id)?.dnd5eLinkedProjectionVisible).toBe(true)
})

it('projects source senses at the sensor position and refreshes decreases without retaining old ranges', () => {
  const character = { id: 'owner', name: 'Owner', avatar: '', darkvisionRangeFeet: 60,
    dnd5eCombatState: { activeEffects: [createDnd5eMechanicalEffect({ id: 'senses', definitionId: 'senses', label: 'Senses', targetId: 'source',
      source: { kind: 'spell' }, modifiers: { darkvisionExistingBonusFeet: 30 } })] } }
  const before = structuredClone([source, sensor, character])
  const projected = projectCharacterTokenPresentations([source, sensor], [character])[1]
  expect(projected).toMatchObject({ id: 'sensor', x: 225, y: 225, visionRangeFeet: 90, darkvisionRangeFeet: 90, blindsightRangeFeet: 10, truesightRangeFeet: 60 })
  const serverProjected = projectDnd5eSourceVisionSensor(sensor, { sourceToken: source, character })
  expect(serverProjected).toEqual(projected)
  const recompiled = applyDnd5eEffectiveVisionProfile(projected, compileDnd5eEffectiveVisionProfile({ token: projected }))
  expect(recompiled.darkvisionRangeFeet).toBe(90)
  const decreased = projectDnd5eSourceVisionSensor(JSON.parse(JSON.stringify(projected)), {
    sourceToken: { ...source, visionRangeFeet: 30, blindsightRangeFeet: 0, truesightRangeFeet: 0 }, character: { ...character, darkvisionRangeFeet: 0, dnd5eCombatState: { activeEffects: [] } },
  })
  expect(decreased.visionRangeFeet).toBe(30)
  expect(decreased.darkvisionRangeFeet).toBeUndefined()
  expect(decreased.truesightRangeFeet).toBeUndefined()
  expect(decreased.blindsightRangeFeet).toBeUndefined()
  expect([source, sensor, character]).toEqual(before)
})

it('does not grant stale senses when the source is unknown or modify ordinary sensors', () => {
  const projected = projectDnd5eSourceVisionSensor({ ...sensor, darkvisionRangeFeet: 120 }, {})
  expect(projected.visionRangeFeet).toBe(0)
  expect(projected.darkvisionRangeFeet).toBeUndefined()
  const ordinary = { ...sensor, dnd5eSpellEffect: { ...sensor.dnd5eSpellEffect!, visionFromSource: undefined } }
  expect(projectDnd5eSourceVisionSensor(ordinary, { sourceToken: source })).toBe(ordinary)
})

it('retains the sensor contract through map JSON reload and rejects an invalid inheritance flag', () => {
  const restore = (entry: Token) => migrateMapsState(JSON.parse(JSON.stringify({ maps: [{ id: 'sensor-map', name: 'Map', width: 500, height: 500, tokens: [source, entry] }] }))).maps[0].tokens.find(token => token.id === 'sensor')!
  expect(restore(sensor).dnd5eSpellEffect?.visionFromSource).toBe(true)
  const malformed = { ...sensor, dnd5eSpellEffect: { ...sensor.dnd5eSpellEffect!, shareVisionWithSource: undefined } }
  expect(restore(malformed).dnd5eSpellEffect).toBeUndefined()
})

it('requires shared source vision and rejects mixing inherited with fixed ranges', () => {
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'eyes', name: 'Eyes', activation: { kind: 'action' },
    automation: automationCapabilityFromLegacyStatus('full'), target: { kind: 'area', relation: 'any', origin: 'point', shape: 'circle', radiusFeet: 5, placeRangeFeet: 30 },
    outcomes: [{ id: 'eyes', when: { kind: 'always' }, operations: [{ id: 'sensor', kind: 'create-persistent-area', label: 'Sensor', durationRounds: 100, concentration: true,
      effectToken: { label: 'Sensor', hiddenBody: true, shareVisionWithSource: true, visionFromSource: true } }] }] }
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  const operation = activity.outcomes[0].operations[0]
  if (operation.kind !== 'create-persistent-area') throw Error('unexpected operation')
  operation.effectToken!.darkvisionRangeFeet = 60
  expect(validateDnd5eActivityDefinitionV1(activity).some(issue => issue.includes('effectToken'))).toBe(true)
  delete operation.effectToken!.darkvisionRangeFeet
  operation.effectToken!.shareVisionWithSource = false
  expect(validateDnd5eActivityDefinitionV1(activity).some(issue => issue.includes('effectToken'))).toBe(true)
})

it('projects current sensor ranges through the player authority and does not grant another member its vision', () => {
  const map = { id: 'sensor-map', name: 'Map', width: 500, height: 500, gridSize: 50, feetPerCell: 5, tokens: [source, sensor] }
  const project = (range: number, memberId: string) => projectMapsForPlayer({ maps: [map] }, { maps: [] }, 'owner', {
    characters: [{ id: 'owner', roomMemberId: 'member-owner', darkvisionRangeFeet: range }],
  }, { memberId }) as { maps: { tokens: Token[] }[] }
  const own = project(90, 'member-owner').maps[0].tokens.find(token => token.id === 'sensor')!
  expect(own).toMatchObject({ viewerControlled: true, darkvisionRangeFeet: 90, visionRangeFeet: 90, x: 225, y: 225 })
  expect(project(0, 'member-owner').maps[0].tokens.find(token => token.id === 'sensor')?.darkvisionRangeFeet).toBeUndefined()
  const other = project(90, 'other-member').maps[0].tokens
  expect(other.find(token => token.id === 'sensor')?.viewerControlled).not.toBe(true)
  expect(resolvePlayerVisionSourceTokenIds({ tokens: other, controlledCharacterIds: ['other'], sharePartyVision: false })).not.toContain('sensor')
})
import { isDnd5eInvisibleVisionSensor } from '../../../shared/dnd5e-vision-profile.mjs'
it('does not classify unrelated hidden entities or linked projections as invisible sensors',()=>{
 expect(isDnd5eInvisibleVisionSensor({dnd5eSpellEffect:{hiddenBody:true}})).toBe(false)
 expect(isDnd5eInvisibleVisionSensor({...sensor,dnd5eSpellEffect:{...sensor.dnd5eSpellEffect!,hearingFromSource:true,linkedTargetProjection:{tokenId:'other'}}})).toBe(false)
 expect(isDnd5eInvisibleVisionSensor({...sensor,dnd5eSpellEffect:{...sensor.dnd5eSpellEffect!,hearingFromSource:true}})).toBe(true)
})
