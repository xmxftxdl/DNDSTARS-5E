import {describe,it,expect} from 'vitest'
import {createDnd5eMechanicalEffect,normalizeDnd5eActiveEffects,validateDnd5eActiveEffectsStrict} from './activeEffects'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction} from './headlessCombatEngine'
import {dnd5eCombatantPairKey,dnd5eDirectedCombatantPairKey} from './headlessCombatPrimitives'
import {isDnd5eSourceAuraRequirement} from './sourceAuraRequirement'
import {refreshDnd5eMapSpatialRelations} from './mapBridge'
import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import {readDnd5eDeclaredDamageTraitReport} from './damageTraitReport'
const actor=(id:string,initiative:number)=>createDnd5eCombatant({id,name:id,controller:'player',initiative,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:30,maxHp:30,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
const effect=()=>createDnd5eMechanicalEffect({definitionId:'test:shield-aura',label:'Shield',source:{kind:'feature',actorId:'source'},targetId:'target',duration:{type:'permanent'},modifiers:{conditionalDamageResistances:[{damageTypes:['fire'],sourceAura:{radiusFeet:10,requiresRage:true,requiresLineOfEffect:true}}]}})
describe('source-bound damage resistance',()=>{
 it.each(['near','edge','far','missing-distance','blocked','not-raging','missing-source','source-down','wrong-type','suspended'] as const)('checks live source and geometry after JSON reload: %s',mode=>{
  const source=actor('source',5),attacker=actor('attacker',20),target=actor('target',10)
  source.classState.raging=mode!=='not-raging'
  if(mode==='source-down')source.currentHp=0
  const shield=effect();if(mode==='suspended')shield.suspendedBy=['test']
  target.classState.activeEffects=normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([shield])))
  expect(validateDnd5eActiveEffectsStrict(target.classState.activeEffects).issues).toEqual([])
  expect(target.classState.activeEffects[0].modifiers?.conditionalDamageResistances?.[0].sourceAura).toEqual({radiusFeet:10,requiresRage:true,requiresLineOfEffect:true})
  const state=startDnd5eHeadlessCombat('aura',[attacker,target,...mode==='missing-source'?[]:[source]])
  if(mode!=='missing-distance')state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('source','target')]:mode==='far'?15:mode==='edge'?10:5}
  if(mode==='blocked')state.lineOfEffectBlockedByCombatantPair={[dnd5eDirectedCombatantPairKey('source','target')]:true}
  const before=JSON.stringify(state)
  const report=readDnd5eDeclaredDamageTraitReport(state.combatants.target,{state,targetId:'target'})
  expect(report.conditional.some(rule=>rule.outcome==='resistant'&&rule.damageTypes?.includes('fire')))
    .toBe(['near','edge','wrong-type'].includes(mode))
  const result=resolveDnd5eHeadlessAction(state,{type:'attack',actorId:'attacker',targetId:'target',attackModifier:10,d20:15,damage:{count:1,sides:8,bonus:0,rolls:[8],type:mode==='wrong-type'?'cold':'fire'}})
  expect(result.ok).toBe(true);if(!result.ok)return
  expect(result.state.combatants.target.currentHp).toBe(['near','edge'].includes(mode)?26:22)
  expect(JSON.stringify(state)).toBe(before)
 })
 it.each([{radiusFeet:-1},{radiusFeet:Infinity},{radiusFeet:10,requiresRage:false},{radiusFeet:10,requiresLineOfEffect:'true'},{radiusFeet:10,sourceId:'forged'}])('rejects malformed aura metadata %j',sourceAura=>{
  expect(isDnd5eSourceAuraRequirement(sourceAura)).toBe(false)
  const invalid=JSON.parse(JSON.stringify(effect()));invalid.modifiers.conditionalDamageResistances[0].sourceAura=sourceAura
  expect(validateDnd5eActiveEffectsStrict([invalid]).issues.length).toBeGreaterThan(0)
  expect(normalizeDnd5eActiveEffects([invalid]).some(e=>e.modifiers?.conditionalDamageResistances?.length)).toBe(false)
 })
})

it('recomputes aura range and full cover from current map positions rather than stale pairs',()=>{
 const source=actor('source',10),target=actor('target',0),attacker=actor('attacker',20)
 source.position={x:225,y:225};target.position={x:325,y:225};attacker.position={x:375,y:225}
 source.classState.raging=true;target.classState.activeEffects=[effect()]
 const state=startDnd5eHeadlessCombat('mapped-aura',[attacker,source,target])
 const map:import('../../store/maps').BattleMap={id:'aura',name:'Aura',width:800,height:600,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[source,target,attacker].map(c=>({id:c.id,label:c.name,type:'player',characterId:c.id,x:c.position.x,y:c.position.y,size:1,emoji:'X',color:'#fff'}))}
 const geometry=createEmptyMapGeometry(map.id);geometry.vision.enabled=false
 for(const mode of ['near','far','returned','covered','vision-only','opened'] as const){
  state.combatants.target.position={x:mode==='far'?625:325,y:225}
  state.combatants.attacker.position={x:state.combatants.target.position.x+50,y:225}
  geometry.walls=['covered','vision-only'].includes(mode)?[{id:'wall',kind:'wall',label:'Wall',points:[{x:275,y:0},{x:275,y:600}],baseHeightFeet:0,heightFeet:100,blocksVision:true,blocksMovement:true,blocksLineOfEffect:mode==='covered',createdAt:1}]:[]
  refreshDnd5eMapSpatialRelations(state,map,[],{geometry})
  const result=resolveDnd5eHeadlessAction(state,{type:'attack',actorId:'attacker',targetId:'target',attackModifier:10,d20:15,damage:{count:1,sides:8,bonus:0,rolls:[8],type:'fire'}})
  expect(result.ok,mode).toBe(true);if(!result.ok)continue
  expect(30-result.state.combatants.target.currentHp,mode).toBe(['far','covered'].includes(mode)?8:4)
  expect(state.combatants.target.classState.activeEffects).toHaveLength(1)
 }
})

it('stops shielding when the source leaves the map or is deleted, including persisted recipients',()=>{
 const source=actor('source',10),target=actor('target',0),attacker=actor('attacker',20)
 source.position={x:225,y:225};target.position={x:325,y:225};attacker.position={x:375,y:225}
 source.classState.raging=true;target.classState.activeEffects=[effect()]
 const state=startDnd5eHeadlessCombat('source-map-lifecycle',[attacker,source,target])
 const tokens=[source,target,attacker].map(c=>({id:c.id,label:c.name,type:'player' as const,characterId:c.id,x:c.position.x,y:c.position.y,size:1,emoji:'X',color:'#fff'}))
 const map:import('../../store/maps').BattleMap={id:'aura',name:'Aura',width:800,height:600,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens}
 const geometry=createEmptyMapGeometry(map.id);geometry.vision.enabled=false
 for(const mode of ['present','off-map','returned','deleted'] as const){
  map.tokens=mode==='off-map'||mode==='deleted'?tokens.filter(t=>t.id!=='source'):tokens
  if(mode==='deleted')delete state.combatants.source
  // A retained combatant snapshot must not stand in for a token on this map.
  refreshDnd5eMapSpatialRelations(state,map,[],{geometry})
  const restored=JSON.parse(JSON.stringify(state)) as typeof state
  const result=resolveDnd5eHeadlessAction(restored,{type:'attack',actorId:'attacker',targetId:'target',attackModifier:10,d20:15,damage:{count:1,sides:8,bonus:0,rolls:[8],type:'fire'}})
  expect(result.ok,mode).toBe(true);if(!result.ok)continue
  expect(30-result.state.combatants.target.currentHp,mode).toBe(mode==='present'||mode==='returned'?4:8)
  // Leaving and returning during the same rage preserves the chosen recipient.
  expect(restored.combatants.target.classState.activeEffects).toHaveLength(1)
 }
})

it('withdraws source-owned resistance when incoming damage ends the source rage',()=>{
 const source=actor('source',10),target=actor('target',0),attacker=actor('attacker',20)
 source.classId='barbarian';source.classLevels={barbarian:10};source.classState.raging=true;source.currentHp=1
 target.classState.activeEffects=[effect()]
 const state=startDnd5eHeadlessCombat('aura-source-down',[attacker,source,target])
 const result=resolveDnd5eHeadlessAction(state,{type:'attack',actorId:'attacker',targetId:'source',attackModifier:10,d20:15,damage:{count:1,sides:8,bonus:0,rolls:[8],type:'fire'}})
 expect(result.ok).toBe(true);if(!result.ok)return
 expect(result.state.combatants.source.currentHp).toBe(0)
 expect(result.state.combatants.source.classState.raging).not.toBe(true)
 expect((result.state.combatants.target.classState.activeEffects??[]).some(e=>e.modifiers?.conditionalDamageResistances?.some(r=>r.sourceAura?.requiresRage))).toBe(false)
 expect(state.combatants.target.classState.activeEffects).toHaveLength(1)
})

it('projects the public aura modifier and defends non-attack Activity damage',async()=>{
 const {automationCapabilityFromLegacyStatus}=await import('../../domain/automation/automationCapability')
 const {validateDnd5eActivityDefinitionV1}=await import('./activities/dnd5eActivityValidation')
 const {resolveDnd5eActivity}=await import('./activities/dnd5eActivityExecutor')
 const {dnd5eActivityActorSnapshotFromCombatantV1:snapshot}=await import('./activities/dnd5eActivityCombatAuthority')
 const {commitDnd5eActivityExecution}=await import('./headlessCombatEngine')
 const aura:import('./activities/dnd5eActivityContracts').Dnd5eActivityDefinitionV1={schemaVersion:1,id:'shield',name:'Shield',activation:{kind:'free'},target:{kind:'creature',relation:'any',rangeFeet:10,count:1},automation:automationCapabilityFromLegacyStatus('full'),effects:[{schemaVersion:1,id:'shield',name:'Shield',duration:{kind:'permanent'},stacking:'unique-by-source',modifiers:[{kind:'conditional-damage-resistance',damageTypes:['fire'],sourceAura:{radiusFeet:10,requiresRage:true,requiresLineOfEffect:true}}]}],outcomes:[{id:'grant',when:{kind:'always'},operations:[{id:'grant',kind:'apply-effect',effectId:'shield',target:'target'}]}]}
 expect(validateDnd5eActivityDefinitionV1(aura)).toEqual([])
 const source=actor('source',20),target=actor('target',10);source.classState.raging=true
 const state=startDnd5eHeadlessCombat('activity',[source,target]);state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('source','target')]:5}
 const grant=resolveDnd5eActivity({activity:aura,actor:snapshot(source),targets:[snapshot(target)],distanceFeetByTargetId:{target:5},rolls:{}})
 expect(grant.ok,JSON.stringify(grant)).toBe(true)
 const granted=commitDnd5eActivityExecution(state,{actorId:'source',activityId:'shield',targetIds:['target'],resolution:grant,source:{kind:'feature',id:'shield',packageId:'test.aura'}})
 expect(granted.ok).toBe(true);if(!granted.ok)return
 expect(granted.state.combatants.target.classState.activeEffects?.some(e=>e.modifiers?.conditionalDamageResistances?.[0].sourceAura?.radiusFeet===10)).toBe(true)
 const damage:import('./activities/dnd5eActivityContracts').Dnd5eActivityDefinitionV1={schemaVersion:1,id:'heat',name:'Heat',activation:{kind:'free'},target:{kind:'creature',relation:'any',rangeFeet:30,count:1},automation:automationCapabilityFromLegacyStatus('full'),outcomes:[{id:'hurt',when:{kind:'always'},operations:[{id:'fire',kind:'damage',target:'target',damageType:'fire',amount:{kind:'constant',value:8}}]}]}
 for(const distance of [5,15,5]){
   const live=structuredClone(granted.state);live.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('source','target')]:distance}
   const result=commitDnd5eActivityExecution(live,{actorId:'source',activityId:'heat',targetIds:['target'],resolution:resolveDnd5eActivity({activity:damage,actor:snapshot(live.combatants.source),targets:[snapshot(live.combatants.target)],distanceFeetByTargetId:{target:distance},rolls:{}}),source:{kind:'feature',id:'heat',packageId:'test.aura'}})
   expect(result.ok).toBe(true);if(result.ok)expect(result.state.combatants.target.currentHp).toBe(distance<=10?26:22)
 }
})

it.each(['voluntary','expired','not-sustained'] as const)('retires only the ending source rage aura while preserving other sources and mixed benefits: %s', mode=>{
 const source=actor('source',20),target=actor('target',10),other=actor('other',0)
 source.classId='barbarian';source.classLevels={barbarian:10};source.classState.raging=true
 const own=effect(),second=effect(),mixed=effect()
 second.id='other-aura';second.source.actorId='other';other.classState.raging=true
 mixed.id='mixed';mixed.modifiers={...mixed.modifiers,speedBonusFeet:5,conditionalDamageResistances:[...mixed.modifiers!.conditionalDamageResistances!,{damageTypes:['cold']}]}
 target.classState.activeEffects=[own,second,mixed]
 const state=startDnd5eHeadlessCombat('rage-cleanup',[source,target,other])
 state.combatants.source.classState.rageTurnsRemaining=mode==='expired'?1:10
 state.combatants.source.classState.rageSustainedThisTurn=mode!=='not-sustained'
 const result=resolveDnd5eHeadlessAction(state,mode==='voluntary'
   ?{type:'barbarian-rage',actorId:'source',end:true}
   :{type:'end-turn',actorId:'source'})
 expect(result.ok).toBe(true);if(!result.ok)return
 const effects=result.state.combatants.target.classState.activeEffects??[]
 expect(effects.some(e=>e.id===own.id)).toBe(false)
 expect(effects.find(e=>e.id==='other-aura')?.modifiers?.conditionalDamageResistances?.[0].sourceAura?.requiresRage).toBe(true)
 expect(effects.find(e=>e.id==='mixed')?.modifiers).toMatchObject({speedBonusFeet:5,conditionalDamageResistances:[{damageTypes:['cold']}]})
 expect(result.events).toContainEqual(expect.objectContaining({type:'active-effect-removed',targetId:'target',effectId:own.id}))
 // A later rage cannot resurrect the removed selection after persistence.
 const restored=normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify(effects)))
 expect(restored.some(e=>e.source.actorId==='source'&&e.modifiers?.conditionalDamageResistances?.some(r=>r.sourceAura?.requiresRage))).toBe(false)
 expect(state.combatants.target.classState.activeEffects).toHaveLength(3)
})

