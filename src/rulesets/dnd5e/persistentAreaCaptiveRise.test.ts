import { expect, it, afterEach } from 'vitest'
import { normalizeDnd5ePersistentAreaTriggerSnapshot } from './persistentAreaTypes'
import { planDnd5ePersistentAreaCaptiveRise } from './persistentAreaCaptiveRise'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import type { Dnd5eActiveEffectInstance } from './activeEffects'

afterEach(()=>setMapGeometryRuntime([]))
const declaration={id:'rise',label:'Rise',timing:'turn-start',oncePerTurn:true,boundRestraintRiseFeet:5}
it.each([0,-1,1001,1.5,'5',NaN])('rejects invalid rise distance %s',value=>{
 expect(normalizeDnd5ePersistentAreaTriggerSnapshot({...declaration,boundRestraintRiseFeet:value})).toBeUndefined()
})
it('requires a turn-start transaction with turn deduplication and no damage or save',()=>{
 expect(normalizeDnd5ePersistentAreaTriggerSnapshot(declaration)?.boundRestraintRiseFeet).toBe(5)
 for(const extra of [{timing:'on-enter'},{oncePerTurn:false},{savingThrow:{ability:'str',dc:15,onSuccess:'none'}},{damage:{count:1,sides:6,type:'fire'}}])
  expect(normalizeDnd5ePersistentAreaTriggerSnapshot({...declaration,...extra})).toBeUndefined()
})
it('respects overhead solids, exact generation, suppression, ceiling and missing source area',()=>{
 const token:Token={id:'target',label:'Target',type:'enemy',x:25,y:25,size:1,hp:20,maxHp:20,color:'',emoji:''}
 const area:Dnd5ePluginArea={id:'vortex',pluginId:'test',featureId:'vortex',label:'Vortex',sourceTokenId:'caster',sourceCharacterId:'caster',color:'',createdRound:1,expiresAfterRound:11,anchorMode:'fixed',relation:'any',includeSelf:true,cells:[{col:0,row:0}],vertical:{mode:'volume',baseElevationFeet:0,heightFeet:30}}
 const map:BattleMap={id:'rise',name:'Rise',width:100,height:100,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[token],dnd5ePluginAreas:[area]}
 const effect={stackingKey:'capture',stackingPolicy:'replace',schemaVersion:1,label:'Captured',kind:'condition',appliedAt:1,id:'captured',definitionId:'captured',standardCondition:'restrained',source:{actorId:'caster',kind:'feature',rulesId:'vortex'},duration:{type:'permanent'},modifiers:{magicallyHeldAloft:true},areaLifetime:{mapId:'rise',areaId:'vortex',sourceActorId:'caster'}} as Dnd5eActiveEffectInstance
 const input={map,area,token,effects:[effect],elevationFeet:0,distanceFeet:5}
 expect(planDnd5ePersistentAreaCaptiveRise(input)).toBe(5)
 expect(planDnd5ePersistentAreaCaptiveRise({...input,elevationFeet:28})).toBe(30)
 expect(planDnd5ePersistentAreaCaptiveRise({...input,elevationFeet:32})).toBe(32)
 expect(planDnd5ePersistentAreaCaptiveRise({...input,map:{...map,dnd5ePluginAreas:[]}})).toBe(0)
 expect(planDnd5ePersistentAreaCaptiveRise({...input,effects:[{...effect,suspendedBy:['antimagic']}]})).toBe(0)
 expect(planDnd5ePersistentAreaCaptiveRise({...input,effects:[{...effect,areaLifetime:{...effect.areaLifetime!,generation:1}}]})).toBe(0)
 const geometry=createEmptyMapGeometry(map.id)
 geometry.obstacles=[{id:'ceiling',kind:'obstacle',label:'Ceiling',points:[{x:0,y:0},{x:50,y:0},{x:50,y:50},{x:0,y:50}],baseHeightFeet:8,heightFeet:1,blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,cover:'total',createdAt:1}]
 setMapGeometryRuntime([geometry])
 expect(planDnd5ePersistentAreaCaptiveRise(input)).toBe(3)
})


