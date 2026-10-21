import {it,expect} from 'vitest'
import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import {prepareDnd5eTempleStructure} from '../../rulesets/dnd5e/templeStructure'
import {templeVisualParts} from './templeVisualGeometry'
it('renders the rotated physical shell with its door gap; roof, lifetime and ownership remain authoritative',()=>{
 const map={id:'temple',name:'Temple',width:2000,height:2000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[]}
 const built=prepareDnd5eTempleStructure({map,geometry:createEmptyMapGeometry(map.id),origin:{x:300,y:300},widthFeet:30,depthFeet:20,heightFeet:15,elevationFeet:0,
  rotationDegrees:31,structureId:'temple:test',casterId:'builder',authorizedCreatureIds:[],worldMinute:100,createdAt:1,hostileCreatureTypes:['fiend'],lighting:'bright',sourceSaveDc:18,sourceWisdomModifier:5})
 expect(built.ok).toBe(true);if(!built.ok)throw Error(built.reason)
 const geometry=built.geometry,ground=templeVisualParts(geometry,0,100)
 expect(ground.filter(p=>p.kind==='wall')).toHaveLength(5)
 expect(ground.filter(p=>p.kind==='floor')).toHaveLength(1)
 expect(ground.some(p=>p.entity.id.endsWith(':lintel')||p.kind==='roof')).toBe(false)
 for(const part of ground)expect(part.entity).toBe(geometry.obstacles.find(entity=>entity.id===part.entity.id))
 const roof=templeVisualParts(geometry,15,100)
 expect(roof.map(p=>p.kind)).toEqual(['roof'])
 expect(roof[0].entity.id).toBe('temple:test:roof')
 geometry.obstacles.push({...ground[0].entity,id:'private-dm-guide'})
 expect(templeVisualParts(geometry,0,100).some(p=>p.entity.id==='private-dm-guide')).toBe(false)
 expect(templeVisualParts(geometry,0,99)).toEqual([])
 expect(templeVisualParts(geometry,0,1540)).toEqual([])
 geometry.structureLifetimes![0].expiresWorldMinute=null
 expect(templeVisualParts(geometry,0,1540)).toHaveLength(6)
 const shortGeometry={...geometry,structureLifetimes:geometry.structureLifetimes!.map(record=>({...record,objectBoundary:{...record.objectBoundary!,topFeet:4}})),obstacles:geometry.obstacles.map(entity=>({...entity,heightFeet:Math.min(entity.heightFeet,4)}))}
 expect(templeVisualParts(shortGeometry,0,1540).filter(p=>p.kind==='wall')).toHaveLength(5)
 geometry.structureLifetimes=[]
 expect(templeVisualParts(geometry,0,1540)).toEqual([])
})
