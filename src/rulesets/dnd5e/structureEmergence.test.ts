import {expect,it} from 'vitest'
import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import type {BattleMap,Token} from '../../store/maps'
import {placeDnd5eMightyFortressKeep} from './mightyFortressStructure'
import {prepareDnd5eStructureEmergence,dnd5eStructureEmergenceDestinations} from './structureEmergence'

function fixture(){
 const creature=(id:string,x:number,y:number,z=0):Token=>({id,type:'enemy',label:id,color:'',emoji:'',size:1,x,y,elevationFeet:z,hp:12,maxHp:20})
 const map:BattleMap={id:'rise',name:'Rise',width:2000,height:2000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,
  tokens:[creature('keep',600,600),creature('tower',200,200),creature('courtyard',400,400),creature('flying',700,700,60)]}
 const before=createEmptyMapGeometry(map.id,1)
 const after=placeDnd5eMightyFortressKeep({map,geometry:before,origin:{x:100,y:100},rotationDegrees:0,elevationFeet:0,createdAt:1,structureId:'fortress',
  towerThicknessInches:12,floorThicknessInches:6}).geometry
 return {map,before,after,creature}
}
it('harmlessly raises main-building and tower residents above new stone and leaves higher flyers unchanged',()=>{
 const input=fixture(),original=structuredClone(input.map)
 const result=prepareDnd5eStructureEmergence(input)
 expect(result.ok).toBe(true)
 if(!result.ok)throw Error(result.reason)
 expect(result.map.tokens.map(t=>[t.id,t.elevationFeet,t.hp])).toEqual([['keep',31.5,12],['tower',30,12],['courtyard',0,12],['flying',60,12]])
 expect(result.changedTokenIds).toEqual(['keep','tower'])
 expect(input.map).toEqual(original)
})
it('requires explicit safe placement for unsupported wall edges or colliding final residents',()=>{
 const input=fixture()
 input.map.tokens.push(input.creature('wall-edge',100,600))
 expect(prepareDnd5eStructureEmergence(input)).toMatchObject({ok:false,tokenIds:['wall-edge']})
 input.map.tokens.pop()
 input.map.tokens.push(input.creature('above-keep',600,600,10))
 const result=prepareDnd5eStructureEmergence(input)
 expect(result).toMatchObject({ok:false})
 if(result.ok)throw Error('overlapping landing accepted')
 expect(result.tokenIds).toContain('above-keep')
 expect(input.map.tokens[0].elevationFeet).toBe(0)
})

it('offers supported, unoccupied destinations and validates explicit choices again',()=>{
 const input=fixture()
 input.map.tokens.push(input.creature('edge',100,600))
 const options=dnd5eStructureEmergenceDestinations({...input,tokenId:'edge'})
 expect(options.length).toBeGreaterThan(0)
 const {x,y,elevationFeet}=options[0]
 const result=prepareDnd5eStructureEmergence({...input,placements:{edge:{x,y,elevationFeet}}})
 expect(result.ok).toBe(true)
 if(!result.ok)throw Error(result.reason)
 expect(result.map.tokens.find(token=>token.id==='edge')).toMatchObject({x,y,elevationFeet,hp:12})
 expect(prepareDnd5eStructureEmergence({...input,placements:{edge:{x:1800,y:1800,elevationFeet}}})).toMatchObject({ok:false})
 expect(prepareDnd5eStructureEmergence({...input,placements:{flying:{x,y,elevationFeet}}})).toMatchObject({ok:false,reason:'structure-emergence-placement-invalid'})
 expect(input.map.tokens.find(token=>token.id==='edge')?.x).toBe(100)
})
