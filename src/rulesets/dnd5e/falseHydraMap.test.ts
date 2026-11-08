import {prepareDnd5eOpportunityAttack,resolvePreparedDnd5eOpportunityAttack} from './opportunityAttackAction'
import {createDnd5eTurnEconomyCounts} from './turnEconomy'
import {it,expect,beforeAll,afterAll} from 'vitest'
import {FALSE_HYDRA} from './testFixtures/falseHydraDefinition'
import {registerDnd5ePluginMonsterCatalogEntry} from './roomMonsterCatalog'
import {createMultipartCreature} from './multipartCreature'
import {prepareDnd5eMonsterAttack,resolvePreparedDnd5eMonsterAttack} from './monsterAttackAction'
import {dnd5eMapTokenDistanceFeet,dnd5eInstantAoeAffectsTokenVertically} from './verticalCombatGeometry'
import {dnd5eMonsterAreaActionTargetIds} from './monsterAreaAction'
import {createDnd5eMapCombatSnapshot,planDnd5eMapResultApplication} from './mapBridge'
import {resolveDnd5eHeadlessAction} from './headlessCombatEngine'
import {normalizeCharacter} from '../../store/characters'
import type {BattleMap,Token} from '../../store/maps'
let dispose:()=>void
beforeAll(()=>{dispose=registerDnd5ePluginMonsterCatalogEntry(FALSE_HYDRA)})
afterAll(()=>dispose())
function fixture(){
 const parts=createMultipartCreature({x:10,y:10,z:0});parts.heads[0].position={x:40,y:10,z:0}
 const hydra:Token={id:'hydra',label:'Hydra',type:'enemy',poolId:FALSE_HYDRA.id,x:100,y:100,size:4,creatureSize:'巨型',hp:184,maxHp:184,emoji:'',color:'#f00',dnd5eCombatState:{monsterMultipart:parts}}
 const hero=normalizeCharacter({id:'hero',name:'Hero',charClass:'战士',race:'人类',level:1,currentHp:40,maxHp:40,ac:10})
 const target:Token={id:'hero-token',characterId:hero.id,label:'Hero',type:'player',x:450,y:100,size:1,emoji:'',color:'#fff'}
 const map:BattleMap={id:'hydra-map',name:'Hydra Map',width:2000,height:1000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[hydra,target]}
 const initiativeOrder=map.tokens.map((t,i)=>({tokenId:t.id,label:t.label,emoji:'',color:'',roll:20-i}))
 return {map,hydra,target,hero,initiativeOrder}
}
it('runs a remote-head bite through map preparation, shared HP settlement, and map persistence',()=>{
 const {map,hydra,target,hero,initiativeOrder}=fixture()
 const prepared=prepareDnd5eMonsterAttack({combatId:map.id,map,characters:[hero],initiativeOrder,actorTokenId:hydra.id,targetTokenId:target.id,
   actionIndex:FALSE_HYDRA.actions.findIndex(a=>a.id==='bite-head-1')})
 expect(prepared.ok,JSON.stringify(prepared.ok?null:prepared)).toBe(true);if(!prepared.ok)return
 const resolved=resolvePreparedDnd5eMonsterAttack({prepared:prepared.prepared,rolls:[{targetId:target.id,d20:15,damageRolls:[[5]],onHitEffectRolls:[{effectId:'grapple-head-1'}]}]})
 expect(resolved.result.ok,JSON.stringify(resolved.result.ok?null:resolved.result.reason)).toBe(true)
 const projected=resolved.application?.map.tokens.find(t=>t.id===hydra.id)
 expect(projected?.x).toBe(100);expect(projected?.y).toBe(100)
 expect(projected?.dnd5eCombatState?.monsterMultipart?.heads[0].position.x).toBe(40)
 expect(projected?.dnd5eCombatState?.monsterMultipart?.heads[0].grappledTargetId).toBe(target.id)
 expect(projected?.dnd5eCombatState?.monsterMultipart?.activeHeadId).toBeUndefined()
})
it('measures incoming attacks to the neck and includes the union of head scream areas once',()=>{
 const {map,hydra,target}=fixture()
 const attacker={...target,x:300,y:150}
 expect(dnd5eMapTokenDistanceFeet({map,left:attacker,right:hydra})).toBeLessThanOrEqual(5)
 const distant={...target,id:'distant',x:1000,y:100};map.tokens.push(distant)
 const ids=dnd5eMonsterAreaActionTargetIds({map,characters:[],actorTokenId:hydra.id,actionId:'many-headed-scream',areaTargetCell:{col:1,row:1}})
 expect(ids).toContain('distant');expect(ids?.filter(id=>id===target.id)).toHaveLength(1)
})
it('intersects raised heads in 3D instead of using only the body elevation',()=>{
 const {map,hydra,target}=fixture();hydra.dnd5eCombatState!.monsterMultipart!.heads[0].position.z=30
 const input={map,spellId:'test',area:{shape:'circle' as const,origin:'point' as const,radiusFeet:5},sourceToken:target,targetToken:hydra,
   effectOrigin:{x:400,y:100},effectOriginElevationFeet:30,effectAim:{x:400,y:100},effectAimElevationFeet:30}
 expect(dnd5eInstantAoeAffectsTokenVertically(input)).toBe(true)
 expect(dnd5eInstantAoeAffectsTokenVertically({...input,effectOriginElevationFeet:100,effectAimElevationFeet:100})).toBe(false)
})
it('persists death-consumption restrictions and regrows once after an elapsed long rest',()=>{
 const {map,hydra,target,hero,initiativeOrder}=fixture();target.x=150
 hero.currentHp=0;hero.dnd5eCombatState={deathRound:1,deathCause:'other'}
 const snapshot=createDnd5eMapCombatSnapshot({map,characters:[hero],initiativeOrder,combatId:map.id,worldMinute:100})
 snapshot.state.combatants[target.id].deathSaves.dead=true
 snapshot.state.combatants[target.id].creatureType='humanoid'
 const consumed=resolveDnd5eHeadlessAction(snapshot.state,{type:'multipart-control',actorId:hydra.id,headId:'head-2',command:'consume-corpse',targetId:target.id,deathAgeMinutes:20})
 expect(consumed.ok,JSON.stringify(consumed.ok?null:consumed.reason)).toBe(true)
 expect(consumed.state.combatants[target.id].classState.falseHydraConsumedBy).toBe(hydra.id)
 const application=planDnd5eMapResultApplication({state:consumed.state,map,characters:[hero],characterIdByCombatantId:snapshot.characterIdByCombatantId,events:[...consumed.events]})
 expect(application.characters[0].dnd5eCombatState?.falseHydraConsumedBy).toBe(hydra.id)
 const begun=resolveDnd5eHeadlessAction(consumed.state,{type:'multipart-control',actorId:hydra.id,headId:'head-2',command:'start-rest'})
 expect(begun.ok).toBe(true)
 begun.state.companionScene!.worldMinute=580
 const rested=resolveDnd5eHeadlessAction(begun.state,{type:'multipart-control',actorId:hydra.id,headId:'head-2',command:'finish-rest'})
 expect(rested.ok).toBe(true)
 expect(rested.state.combatants.hydra.classState.monsterMultipart!.heads.filter(h=>h.alive)).toHaveLength(5)
})

it('prepares an opportunity bite from a surviving head even after the ordinary reaction is spent',()=>{
 const {map,hydra,target,hero,initiativeOrder}=fixture()
 const parts=hydra.dnd5eCombatState!.monsterMultipart!
 parts.heads[0].alive=false;parts.heads[1].position={x:40,y:10,z:0}
 const economy=createDnd5eTurnEconomyCounts('40');economy.reaction.current=0
 const prepared=prepareDnd5eOpportunityAttack({combatId:map.id,map,characters:[hero],initiativeOrder,initiativeIndex:1,
   actorTokenId:hydra.id,targetTokenId:target.id,turnEconomy:economy})
 expect(prepared.ok,JSON.stringify(prepared.ok?null:prepared.reason)).toBe(true)
 if(!prepared.ok)return
 expect(prepared.prepared.weaponName).toContain('头2')
 const resolved=resolvePreparedDnd5eOpportunityAttack({prepared:prepared.prepared,d20:15,damageRolls:[5]})
 expect(resolved.result.ok,JSON.stringify(resolved.result.ok?null:resolved.result.reason)).toBe(true)
 expect(resolved.result.state.combatants[target.id].conditions).toContain('grappled')
 expect(resolved.application?.map.tokens.find(t=>t.id===hydra.id)?.x).toBe(100)
})
