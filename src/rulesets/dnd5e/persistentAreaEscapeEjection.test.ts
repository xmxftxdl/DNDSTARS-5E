import {it,expect,afterEach} from 'vitest'
import {planDnd5eEscapeEjectionMovement} from './persistentAreaEscapeEjection'
import {normalizeDnd5ePersistentAreaTriggerDeclaration} from './persistentAreaTypes'
import {createEmptyMapGeometry,setMapGeometryRuntime} from '../../lib/mapGeometry'
import type {BattleMap,Token} from '../../store/maps'
afterEach(()=>setMapGeometryRuntime([]))
const token:Token={id:'captive',label:'Captive',type:'enemy',x:525,y:525,size:1,elevationFeet:30,color:'',emoji:''}
const map:BattleMap={id:'ejection',name:'Ejection',width:1100,height:1100,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[token]}
it.each([[1,0,-1],[2,1,-1],[3,1,0],[4,1,1],[5,0,1],[6,-1,1],[7,-1,0],[8,-1,-1]])('keeps rolled compass direction %s and grid distance',(direction,dc,dr)=>{
 expect(planDnd5eEscapeEjectionMovement(map,token,direction,30)).toEqual({position:{x:525+dc*300,y:525+dr*300},distanceFeet:30})
})
it('stops at a map edge without rerouting or leaving the map',()=>{
 expect(planDnd5eEscapeEjectionMovement(map,token,3,180)).toEqual({position:{x:1075,y:525},distanceFeet:55})
})
it('does not pass through same-height creatures or treat creatures beneath the flight as blockers',()=>{
 const other={...token,id:'other',x:675}
 expect(planDnd5eEscapeEjectionMovement({...map,tokens:[token,other]},token,3,30)?.position).toEqual({x:625,y:525})
 expect(planDnd5eEscapeEjectionMovement({...map,tokens:[token,{...other,elevationFeet:0}]},token,3,30)?.position).toEqual({x:825,y:525})
})
it('stops before a solid wall instead of selecting a side-step destination',()=>{
 const geometry=createEmptyMapGeometry(map.id)
 geometry.obstacles=[{id:'wall',kind:'obstacle',label:'Wall',points:[{x:650,y:450},{x:700,y:450},{x:700,y:600},{x:650,y:600}],baseHeightFeet:0,heightFeet:60,blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,cover:'total',createdAt:1}]
 setMapGeometryRuntime([geometry])
 expect(planDnd5eEscapeEjectionMovement(map,token,3,30)?.position).toEqual({x:625,y:525})
})
it('validates bounded dice and requires an area-bound escape check',()=>{
 const condition={condition:'restrained',duration:{expiresAt:'permanent'},endsWithArea:true,escapeCheck:{ability:'str',dc:'source-save-dc',economy:'action'},escapeEjection:{count:3,sides:6,feetPerPoint:10}}
 const normalize=(c:unknown)=>normalizeDnd5ePersistentAreaTriggerDeclaration({id:'capture',label:'Capture',timing:'on-create',condition:c})
 expect(normalize(condition)?.condition?.escapeEjection).toEqual({count:3,sides:6,feetPerPoint:10})
 for(const patch of [{endsWithArea:false},{escapeCheck:undefined},{condition:'prone'},{escapeEjection:{count:0,sides:6,feetPerPoint:10}},{escapeEjection:{count:20,sides:100,feetPerPoint:100}}])expect(normalize({...condition,...patch})).toBeUndefined()
})
