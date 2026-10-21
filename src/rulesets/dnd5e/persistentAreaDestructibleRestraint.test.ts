import {expect,it} from 'vitest'
import {migrateMapsState,type BattleMap,type Dnd5ePluginArea} from '../../store/maps'
import {collectDnd5ePersistentAreaTriggers} from './pluginAreas'
import {prepareDnd5ePersistentAreaTrigger,resolvePreparedDnd5ePersistentAreaTrigger} from './pluginAreaTransactions'
import {normalizeDnd5ePersistentAreaTriggerDeclaration} from './persistentAreaTypes'
import {settleStoneWallAttack} from './stoneWallAttack'
const declaration={id:'solidify',label:'Solidify',timing:'on-create' as const,oncePerTarget:true,savingThrow:{ability:'dex' as const,dc:15,onSuccess:'none' as const},condition:{condition:'restrained' as const,endsWithArea:true,duration:{expiresAt:'permanent' as const},destructibleRestraint:{label:'Binding stone',armorClass:15,hitPoints:25},removalAction:{label:'Escape',economy:'action' as const,maxDistanceFeet:5,abilityCheck:{ability:'str' as const,dc:20}}}}
it('creates separate durable restraints and releases only the destroyed object captive',()=>{
 expect(normalizeDnd5ePersistentAreaTriggerDeclaration(declaration)?.condition?.destructibleRestraint).toEqual(declaration.condition.destructibleRestraint)
 const area:Dnd5ePluginArea={id:'mud',pluginId:'test',featureId:'solidify',sourceTokenId:'caster',sourceCharacterId:'',label:'Mud',color:'#aaa',createdRound:1,expiresAfterRound:1,permanent:true,cells:[{col:1,row:1},{col:2,row:1}],anchorCell:{col:1,row:1},triggers:[declaration]}
 let map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:['caster','first','second'].map((id,i)=>({id,label:id,type:'enemy',poolId:'srd-5.1:bandit',x:i*50+25,y:i===0?25:75,size:1,hp:40,maxHp:40,color:'',emoji:''})),dnd5ePluginAreas:[area]}
 const order=map.tokens.map((t,i)=>({tokenId:t.id,label:t.label,roll:20-i,color:'',emoji:''}))
 for(const targetId of ['first','second']){
 const candidate=collectDnd5ePersistentAreaTriggers({map,round:1,timing:'on-create',turnKey:'1:caster'}).find(c=>c.targetToken.id===targetId)!
 const prep=prepareDnd5ePersistentAreaTrigger({combatId:'combat',map,characters:[],round:1,candidate,initiativeOrder:order})
 expect(prep.ok).toBe(true);if(!prep.ok)throw Error(prep.reason)
 const result=resolvePreparedDnd5ePersistentAreaTrigger({prepared:prep.prepared,d20:1})
 expect(result.result.ok).toBe(true)
 map=migrateMapsState(JSON.parse(JSON.stringify({maps:[result.application!.map]}))).maps[0]
 }
 expect(map.dnd5ePluginAreas).toHaveLength(3)
 const stone=map.dnd5ePluginAreas!.find(a=>a.id.endsWith(':first'))!
 expect(stone.entityProfile).toMatchObject({armorClass:15,hitPoints:25})
 for(const type of ['poison','psychic'])expect(settleStoneWallAttack({map,characters:[],areaId:stone.id,panelId:'entity',hit:true,total:20,damage:100,damageType:type})?.hitPointsAfter).toBe(25)
 const miss=settleStoneWallAttack({map,characters:[],areaId:stone.id,panelId:'entity',hit:false,total:14,damage:30,damageType:'bludgeoning'})!
 expect(miss.hitPointsAfter).toBe(25)
 const hit=settleStoneWallAttack({map,characters:[],areaId:stone.id,panelId:'entity',hit:true,total:15,damage:10,damageType:'bludgeoning'})!
 expect(hit.hitPointsAfter).toBe(15)
 const destroyed=settleStoneWallAttack({map:hit.map,characters:[],areaId:stone.id,panelId:'entity',hit:true,total:15,damage:15,damageType:'bludgeoning'})!
 expect(destroyed.outcome).toBe('destroyed')
 expect(destroyed.map.dnd5ePluginAreas!.map(a=>a.id)).toEqual(['mud','mud:restraint:second'])
 expect(destroyed.map.tokens.find(t=>t.id==='first')?.dnd5eCombatState?.activeEffects??[]).toHaveLength(0)
 expect(destroyed.map.tokens.find(t=>t.id==='second')?.dnd5eCombatState?.activeEffects?.some(e=>e.standardCondition==='restrained')).toBe(true)
 expect(destroyed.map.tokens.find(t=>t.id==='first')?.hp).toBe(40)
})
it.each([{armorClass:0},{hitPoints:0},{hitPoints:1.5},{label:''},{extra:true}])('rejects malformed destructible restraints %j',patch=>{
 expect(normalizeDnd5ePersistentAreaTriggerDeclaration({...declaration,condition:{...declaration.condition,destructibleRestraint:{...declaration.condition.destructibleRestraint,...patch}}})).toBeUndefined()
})
