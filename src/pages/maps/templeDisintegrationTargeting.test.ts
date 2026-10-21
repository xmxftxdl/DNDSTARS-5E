import {it,expect} from 'vitest'
import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import type {BattleMap} from '../../store/maps'
import {prepareDnd5eTempleStructure} from '../../rulesets/dnd5e/templeStructure'
import {prepareDnd5eTempleDisintegrationTarget} from '../../rulesets/dnd5e/templeDisintegration'
import {templeDisintegrationCellTargets} from './templeDisintegrationTargeting'

it('highlights only exact Host-valid temple surfaces and removes choices when stale or unseen',()=>{
 const map:BattleMap={id:'map',name:'Map',width:1000,height:500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,
  tokens:[{id:'caster',type:'player',label:'Caster',x:25,y:25,size:1,color:'',emoji:''}]}
 const built=prepareDnd5eTempleStructure({map,geometry:createEmptyMapGeometry(map.id),origin:{x:200,y:100},widthFeet:20,depthFeet:20,heightFeet:15,
  elevationFeet:0,rotationDegrees:0,structureId:'temple:test',casterId:'builder',authorizedCreatureIds:[],worldMinute:0,createdAt:1,
  hostileCreatureTypes:['fiend'],lighting:'bright',sourceSaveDc:18,sourceWisdomModifier:5})
 if(!built.ok)throw Error(built.reason)
 const input={map,geometry:built.geometry,actorTokenId:'caster',characters:[],worldMinute:100}
 const targets=templeDisintegrationCellTargets(input)
 expect(targets.length).toBeGreaterThan(0)
 expect(new Set(targets.map(target=>`${target.cell.col}:${target.cell.row}`)).size).toBe(targets.length)
 for(const {declaration} of JSON.parse(JSON.stringify(targets)) as typeof targets){
  expect(prepareDnd5eTempleDisintegrationTarget({...input,targetEntityId:declaration.entityId,targetPosition:declaration.point,
   targetElevationFeet:declaration.point.elevationFeet,rangeFeet:60}).ok).toBe(true)
 }
 expect(templeDisintegrationCellTargets({...input,worldMinute:1440})).toEqual([])
 expect(templeDisintegrationCellTargets({...input,geometry:createEmptyMapGeometry(map.id)})).toEqual([])
 expect(templeDisintegrationCellTargets({...input,map:{...map,tokens:[{...map.tokens[0],dnd5eCombatState:{conditions:['blinded']}}]}})).toEqual([])
})
