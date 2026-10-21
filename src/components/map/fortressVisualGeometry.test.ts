import {it,expect} from 'vitest'
import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import {placeDnd5eMightyFortressKeep} from '../../rulesets/dnd5e/mightyFortressStructure'
import {fortressVisualParts,fortressFurnitureOnViewedStory} from './fortressVisualGeometry'
it('draws actual owned construction by story, preserves holes and excludes destroyed/expired/unowned geometry',()=>{
 const map={id:'map',name:'Map',width:2000,height:2000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[]}
 const geometry=placeDnd5eMightyFortressKeep({map,geometry:createEmptyMapGeometry(map.id,1),structureId:'keep',origin:{x:100,y:100},rotationDegrees:0,elevationFeet:0,
  towerThicknessInches:6,floorThicknessInches:6,createdAt:1,lifetime:{casterId:'caster',worldMinute:100},eastRoomsPerLevel:[2,0,0],
  stairOpenings:[{level:2,column:1,row:1}],stairs:[{id:'lower',from:{x:47.5,y:47.5,elevationFeet:0},to:{x:62.5,y:47.5,elevationFeet:10.5},widthFeet:5,thicknessInches:6}]}).geometry
 const furniture={id:'chair',type:'obstacle' as const,label:'Chair',size:1,color:'',emoji:'',x:750,y:850,elevationFeet:10.5,
  dnd5eObjectState:{schemaVersion:1 as const,structureBinding:{schemaVersion:1 as const,mapId:map.id,structureId:'keep'},inventoryItem:{templateId:'module:chair',quantity:1,receiptId:'chair'}}}
 expect(fortressFurnitureOnViewedStory(furniture,geometry,0)).toBe(false)
 expect(fortressFurnitureOnViewedStory(furniture,geometry,10.5)).toBe(true)
 expect(fortressFurnitureOnViewedStory(furniture,geometry,21)).toBe(false)
 expect(fortressFurnitureOnViewedStory({...furniture,elevationFeet:0},geometry,0)).toBe(true)
 expect(fortressFurnitureOnViewedStory({...furniture,dnd5eObjectState:undefined},geometry,0)).toBe(true)
 expect(fortressFurnitureOnViewedStory({...furniture,dnd5eObjectState:{...furniture.dnd5eObjectState,inventoryItem:undefined}},geometry,0)).toBe(true)
 const ground=fortressVisualParts(geometry,0,100)
 expect(ground.some(part=>part.kind==='wall')).toBe(true)
 expect(ground.filter(part=>part.kind==='floor')).toHaveLength(0)
 expect(ground.filter(part=>part.kind==='stairs')).toHaveLength(2)
 const upstairs=fortressVisualParts(geometry,10.5,100)
 expect(upstairs.filter(part=>part.kind==='floor')).toHaveLength(24)
 expect(upstairs.some(part=>part.entity.id==='keep:floor:keep-level-2.1.1')).toBe(false)
 expect(upstairs.filter(part=>part.kind==='floor').every(part=>part.entity.id.includes('keep-level-2'))).toBe(true)
 const wall=ground.find(part=>part.kind==='wall')!.entity
 geometry.obstacles.push({...wall,id:'dm-guide'})
 wall.dnd5eDurability!.hitPoints=0
 expect(fortressVisualParts(geometry,0,100).some(part=>part.entity.id===wall.id||part.entity.id==='dm-guide')).toBe(false)
 expect(fortressVisualParts(geometry,0,99)).toEqual([])
 expect(fortressVisualParts(geometry,0,10180)).toEqual([])
 geometry.structureLifetimes=[]
 expect(fortressVisualParts(geometry,0,100)).toEqual([])
})
