import {expect,it} from 'vitest'
import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import {normalizeCharacter} from '../../store/characters'
import type {BattleMap} from '../../store/maps'
import {prepareDnd5eTempleStructure} from './templeStructure'
import {createDnd5eMapCombatSnapshot} from './mapBridge'
import {resolveDnd5eTempleExpiry} from './templeExpirySettlement'
import {registerTempleExpiryInteraction,settleBrowserTempleExpiry} from '../../composition/browserTempleExpiry'
import {createDnd5eTurnEconomyCounts} from './turnEconomy'
import {settleDnd5eTempleCampaignTime} from './templeCampaignSettlement'
import {normalizeSharedCampaignTime} from '../../lib/campaignTime'
import {reconcileDnd5eCharacterCampaignTime} from './campaignTimeRules'
import {createDnd5eConditionEffect} from './activeEffects'

function fixture(){
 const actor=normalizeCharacter({id:'wizard',name:'Wizard',charClass:'法师',level:3,dnd5eClassLevels:{wizard:3},
  abilities:{str:10,dex:10,con:14,int:16,wis:10,cha:10},maxHp:30,currentHp:30,equipment:{},
  dnd5eClassChoices:{classes:{wizard:{selections:{'spell-prepared':['feather-fall']}}}},
  classResources:{'dnd5e-spell-slot-1':{current:1,max:4}}})
 const map:BattleMap={id:'temple',name:'Temple',width:2000,height:1500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[
  {id:'wizard',characterId:'wizard',type:'player',label:'Wizard',x:450,y:450,elevationFeet:15,size:1,color:'',emoji:'',hp:30,maxHp:30},
  {id:'resident',type:'enemy',label:'Resident',x:550,y:450,elevationFeet:0,size:1,color:'',emoji:'',hp:30,maxHp:30}]}
 const built=prepareDnd5eTempleStructure({map:{...map,tokens:[]},geometry:createEmptyMapGeometry(map.id),origin:{x:300,y:300},widthFeet:30,depthFeet:30,heightFeet:15,
  elevationFeet:0,rotationDegrees:0,structureId:'temple:test',casterId:'builder',authorizedCreatureIds:[],worldMinute:100,createdAt:1,
  hostileCreatureTypes:['fiend'],lighting:'bright',sourceSaveDc:18,sourceWisdomModifier:5})
 if(!built.ok)throw Error(built.reason)
 const snapshot=createDnd5eMapCombatSnapshot({map,geometry:built.geometry,characters:[actor],combatId:'expiry',worldMinute:1539,
  initiativeOrder:map.tokens.map((t,index)=>({tokenId:t.id,label:t.label,emoji:'',color:'',roll:20-index}))})
 return {map,geometry:built.geometry,characters:[actor],state:snapshot.state,characterIdByCombatantId:snapshot.characterIdByCombatantId,worldMinute:1540}
}

it('requires a real falling die before expiry, preserves the pending snapshot, and settles one floor occupant without hurting ground residents',()=>{
 const input=fixture(),before=structuredClone(input)
 const pending=resolveDnd5eTempleExpiry(input)
 expect(pending).toMatchObject({ok:false,reason:'invalid-dice',airborneFalls:[{combatantId:'wizard',fallingDamageDice:1}]})
 expect('application' in pending).toBe(false)
 expect(input).toEqual(before)
 const settled=resolveDnd5eTempleExpiry({...input,airborneFallDamageRollsByCombatantId:{wizard:[4]}})
 expect(settled.ok,JSON.stringify(settled)).toBe(true);if(!settled.ok)throw Error(settled.reason)
 expect(settled.geometry.structureLifetimes).toEqual([])
 expect(settled.application.map.tokens.find(t=>t.id==='wizard')).toMatchObject({elevationFeet:0,hp:26})
 expect(settled.application.characters[0].currentHp).toBe(26)
 expect(settled.application.map.tokens.find(t=>t.id==='resident')).toMatchObject({elevationFeet:0,hp:30})
 expect(settled.result.state.combatants.wizard.conditions).toContain('prone')
 expect(input).toEqual(before)
 const replay=resolveDnd5eTempleExpiry({...input,state:settled.result.state,map:settled.application.map,characters:settled.application.characters,geometry:settled.geometry})
 expect(replay).toMatchObject({ok:true,changed:false,expiredIds:[]})
 if(replay.ok)expect(replay.application.characters[0].currentHp).toBe(26)
})

it('allows Feather Fall at the expiry boundary and consumes its spell slot and reaction only in the result',()=>{
 const input=fixture()
 const settled=resolveDnd5eTempleExpiry({...input,solidExitFeatherFallChoices:[{casterId:'wizard',targetIds:['wizard']}]})
 expect(settled.ok,JSON.stringify(settled)).toBe(true);if(!settled.ok)throw Error(settled.reason)
 expect(settled.geometry.structureLifetimes).toEqual([])
 expect(settled.application.characters[0].currentHp).toBe(30)
 expect(settled.application.characters[0].classResources?.['dnd5e-spell-slot-1']?.current).toBe(0)
 expect(settled.result.state.combatants.wizard.turn.reactionAvailable).toBe(false)
 expect(input.characters[0].classResources?.['dnd5e-spell-slot-1']?.current).toBe(1)
 expect(resolveDnd5eTempleExpiry({...input,solidExitFeatherFallChoices:[{casterId:'wizard',targetIds:['resident']}]})).toMatchObject({ok:false,reason:'invalid-reaction'})
})

it.each(['early','permanent','flight'] as const)('does not drop a supported or flying occupant: %s',mode=>{
 const input=fixture()
 if(mode==='early')input.worldMinute=1539
 if(mode==='permanent')input.geometry.structureLifetimes![0].expiresWorldMinute=null
 if(mode==='flight')input.state.combatants.wizard.movementSpeeds={walk:30,fly:30}
 const result=resolveDnd5eTempleExpiry(input)
 expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)throw Error(result.reason)
 expect(result.application.characters[0].currentHp).toBe(30)
 expect(result.application.map.tokens.find(t=>t.id==='wizard')?.elevationFeet).toBe(15)
 expect(result.geometry.structureLifetimes).toHaveLength(mode==='flight'?0:1)
})

it.each([1,20])('requires the creature-underneath saving throw before committing a roof fall: %s',d20=>{
 const input=fixture()
 input.map.tokens[1].x=450
 const snapshot=createDnd5eMapCombatSnapshot({map:input.map,geometry:input.geometry,characters:input.characters,combatId:'expiry',worldMinute:1539,
  initiativeOrder:input.map.tokens.map((t,index)=>({tokenId:t.id,label:t.label,emoji:'',color:'',roll:20-index}))})
 input.state=snapshot.state
 const pending=resolveDnd5eTempleExpiry({...input,airborneFallDamageRollsByCombatantId:{wizard:[4]}})
 expect(pending).toMatchObject({ok:false,reason:'invalid-dice'})
 if(pending.ok||!pending.airborneFalls?.[0].collision)throw Error('Missing collision saving throw')
 const result=resolveDnd5eTempleExpiry({...input,airborneFallDamageRollsByCombatantId:{wizard:[4],[pending.airborneFalls[0].collision.rollKey]:[d20]}})
 expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)throw Error(result.reason)
 expect(result.application.characters[0].currentHp).toBe(d20===1?28:26)
 expect(result.application.map.tokens.find(t=>t.id==='resident')?.hp).toBe(d20===1?28:30)
})

it.each(['fall','feather','spent','unmounted'] as const)('runs the browser Host expiry interaction and persists its reaction economy: %s',async mode=>{
 const input=fixture()
 const economy=createDnd5eTurnEconomyCounts('combat:1:wizard')
 if(mode==='spent')economy.reaction.current=0
 const combat={mapId:input.map.id,combatId:'combat',active:true,round:1,initiativeIndex:0,
  initiativeOrder:input.map.tokens.map((t,index)=>({tokenId:t.id,label:t.label,emoji:'',color:'',roll:20-index})),
  dnd5eTurnEconomyByToken:{wizard:economy},updatedAt:1}
 let rolls=0,choices=0
 const unregister=registerTempleExpiryInteraction({
  chooseFeatherFall:async(state)=>{
   choices++
   expect(state.combatants.wizard.turn.reactionAvailable).toBe(mode!=='spent')
   if(mode==='unmounted')unregister()
   return mode==='feather'?{casterId:'wizard',targetIds:['wizard']}:undefined
  },
  rollFalls:async falls=>{rolls++;expect(falls[0].fallingDamageDice).toBe(1);return{wizard:[4]}},
 })
 try{
  if(mode==='unmounted')await expect(settleBrowserTempleExpiry({...input,combat})).rejects.toThrow('temple-expiry-host-interaction-unavailable')
  else{
   const result=await settleBrowserTempleExpiry({...input,combat})
   expect(result.characters[0].currentHp).toBe(mode==='feather'?30:26)
   expect(result.characters[0].classResources?.['dnd5e-spell-slot-1']?.current).toBe(mode==='feather'?0:1)
   expect(result.combat?.dnd5eTurnEconomyByToken?.wizard.reaction.current).toBe(mode==='fall'?1:0)
   expect(rolls).toBe(mode==='feather'?0:1)
   expect(result.geometry.structureLifetimes).toEqual([])
  }
  expect(choices).toBe(1)
  expect(input.characters[0].currentHp).toBe(30)
  expect(combat.dnd5eTurnEconomyByToken.wizard.reaction.current).toBe(mode==='spent'?0:1)
 }finally{unregister()}
})

it('settles the old day before creating Feather Fall, so room clock replay does not expire the new reaction',()=>{
 const input=fixture(),clock=normalizeSharedCampaignTime({worldMinute:1540})
 const settled=settleDnd5eTempleCampaignTime({maps:[input.map],geometry:[input.geometry],characters:[{...input.characters[0],dnd5eWorldTimeAppliedMinute:100}],clock})
 expect(settled.characters[0].dnd5eWorldTimeAppliedMinute).toBe(1540)
 const snapshot=createDnd5eMapCombatSnapshot({...input,characters:settled.characters,combatId:'expiry-clock',initiativeOrder:input.map.tokens.map((t,index)=>({tokenId:t.id,label:t.label,emoji:'',color:'',roll:20-index}))})
 const result=resolveDnd5eTempleExpiry({...input,characters:settled.characters,state:snapshot.state,characterIdByCombatantId:snapshot.characterIdByCombatantId,
  solidExitFeatherFallChoices:[{casterId:'wizard',targetIds:['wizard']}]})
 expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)throw Error(result.reason)
 const character=result.application.characters[0]
 expect(character.dnd5eCombatState?.activeEffects?.some(effect=>effect.source.rulesId==='feather-fall')).toBe(true)
 const replay=reconcileDnd5eCharacterCampaignTime(character,clock)
 expect(replay.changed).toBe(false)
 expect(replay.character.dnd5eCombatState?.activeEffects?.some(effect=>effect.source.rulesId==='feather-fall')).toBe(true)
})

it('expires prior non-healing effects for temple NPCs once without mutating the pending map',()=>{
 const input=fixture(),clock=normalizeSharedCampaignTime({worldMinute:1540})
 const effect=createDnd5eConditionEffect({condition:'restrained',targetId:'resident',
  source:{kind:'spell',rulesId:'web',actorId:'caster'},
  duration:{type:'rounds',remainingRounds:10,tickOn:'target-turn-end'}})
 const map={...input.map,tokens:input.map.tokens.map(token=>token.id==='resident'?{
  ...token,dnd5eWorldTimeAppliedMinute:100,dnd5eCombatState:{schemaVersion:2 as const,activeEffects:[effect]},
 }:token)}
 const before=structuredClone(map)
 const settled=settleDnd5eTempleCampaignTime({maps:[map],geometry:[input.geometry],characters:input.characters,clock})
 const resident=settled.maps[0].tokens.find(token=>token.id==='resident')!
 expect(resident.dnd5eWorldTimeAppliedMinute).toBe(1540)
 expect(resident.dnd5eCombatState?.activeEffects??[]).toEqual([])
 expect(resident.hp).toBe(30)
 expect(map).toEqual(before)
 const replay=settleDnd5eTempleCampaignTime({...settled,geometry:[input.geometry],clock})
 expect(replay.changed).toBe(false)
 expect(replay.maps).toEqual(settled.maps)
})
