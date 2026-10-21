import {expect,it} from 'vitest'
import {createEmptyMapGeometry,normalizeMapGeometry,mapGeometryIlluminationAtPoint,mapGeometrySpellLightingSources,mapGeometrySunlightAtPoint} from '../../lib/mapGeometry'
import {persistentAreaGroundLightPolygons} from '../../components/map/persistentAreaLightPresentation'
import {prepareDnd5eTempleStructure} from './templeStructure'
import type {BattleMap} from '../../store/maps'

it.each(['none','dim','bright'] as const)('projects persisted %s temple light inside the rotated volume only',lighting=>{
 const map:BattleMap={id:'temple',name:'Temple',width:2000,height:2000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[]}
 const geometry=createEmptyMapGeometry(map.id)
 geometry.vision.ambientLight='darkness'
 const built=prepareDnd5eTempleStructure({map,geometry,origin:{x:500,y:500},widthFeet:30,depthFeet:20,heightFeet:15,elevationFeet:0,rotationDegrees:30,
 structureId:'temple:light',casterId:'caster',authorizedCreatureIds:[],worldMinute:0,createdAt:1,hostileCreatureTypes:['fiend'],lighting,sourceSaveDc:18,sourceWisdomModifier:5})
 if(!built.ok)throw Error(built.reason)
 const saved=normalizeMapGeometry(JSON.parse(JSON.stringify(built.geometry)))!
 const points=saved.structureLifetimes![0].objectBoundary!.points
 const center={x:points.reduce((s,p)=>s+p.x/4,0),y:points.reduce((s,p)=>s+p.y/4,0)}
 const at=(point=center,elevationFeet=5)=>mapGeometryIlluminationAtPoint({map,geometry:saved,point,elevationFeet})
 expect(at()).toBe(lighting==='none'?'darkness':lighting)
 expect(at({x:500,y:750})).toBe('darkness')
 expect(at(center,15)).toBe('darkness')
 expect(at(center,-1)).toBe('darkness')
 const sources=mapGeometrySpellLightingSources(map,saved)
 expect(sources).toHaveLength(lighting==='none'?0:1)
 if(sources[0])expect(persistentAreaGroundLightPolygons({map,geometry:saved,source:sources[0]})).toEqual([points])
 expect(mapGeometrySunlightAtPoint({map,geometry:saved,point:center,elevationFeet:5})).toBe(false)
 map.dnd5ePluginAreas=[{id:'antimagic',pluginId:'test',featureId:'antimagic',sourceCharacterId:'caster',sourceTokenId:'caster',label:'Antimagic',color:'',
 cells:Array.from({length:8},(_,row)=>Array.from({length:8},(_,col)=>({col:col+8,row:row+8}))).flat(),createdRound:1,expiresAfterRound:100,includeSelf:true,relation:'any',occupantModifiers:{suppressesMagic:true}}]
 expect(at()).toBe(lighting==='none'?'darkness':lighting)
 expect(mapGeometrySpellLightingSources(map,saved)).toHaveLength(lighting==='none'?0:1)
 map.dnd5ePluginAreas=[{id:'dark',pluginId:'test',featureId:'dark',sourceCharacterId:'caster',sourceTokenId:'caster',label:'Dark',color:'#000',cells:[{col:12,row:13}],anchorCell:{col:12,row:13},anchorMode:'fixed',createdRound:1,expiresAfterRound:100,
 lighting:{kind:'magical-darkness',radiusFeet:60,spellLevel:8,suppressesMagicalLightThroughLevel:8,lightSuppressionScope:'within-area'}}]
 expect(at()).toBe('magical-darkness')
 // A higher-level temple light remains dim when piercing a weaker local darkness.
 map.dnd5ePluginAreas[0].lighting={kind:'magical-darkness',radiusFeet:60,spellLevel:2,suppressesMagicalLightThroughLevel:2,lightSuppressionScope:'within-area'}
 expect(at()).toBe(lighting==='none'?'magical-darkness':lighting)
 map.dnd5ePluginAreas=[]
 saved.vision.ambientLight='bright'
 expect(at()).toBe('bright')
 saved.vision.ambientLight='darkness'
 saved.structureLifetimes=[]
 expect(at()).toBe('darkness')
})
