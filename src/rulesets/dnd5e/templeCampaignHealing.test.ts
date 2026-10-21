import {expect,it} from 'vitest'
import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import {normalizeCharacter} from '../../store/characters'
import {createDnd5eMechanicalEffect,createDnd5eConditionEffect} from './activeEffects'
import {dnd5eTempleCampaignHealingBonus,type TempleCampaignHealingContext} from './templeCampaignHealing'
import {reconcileDnd5eCharacterCampaignTime} from './campaignTimeRules'
import {characterCombatClockKey} from '../../../shared/combat-round-credits.mjs'

function fixture():TempleCampaignHealingContext{
 const geometry=createEmptyMapGeometry('temple')
 geometry.structureLifetimes=[{id:'temple',casterId:'builder',entityIds:['wall'],createdWorldMinute:1,expiresWorldMinute:3,replacementGroup:'temple-of-the-gods',
 objectBoundary:{points:[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}],bottomFeet:0,topFeet:15},templeWard:{hostileCreatureTypes:['fiend'],healingBonus:5,saveDc:18,lighting:'none'}}]
 return {geometry,token:{id:'hero-token',characterId:'hero',type:'player',label:'Hero',emoji:'',color:'',size:1,x:50,y:50,elevationFeet:5},actorKey:characterCombatClockKey('hero'),fromWorldMinute:0,
 clock:{schemaVersion:2,worldMinute:4,displayMode:'campaign-day',displayMinuteOffset:0,timers:[],advances:[],updatedAt:1}}
}
it('counts only healing ticks during the temple lifetime and caps the effect duration',()=>{
 const context=fixture()
 expect(dnd5eTempleCampaignHealingBonus(context,7,40)).toBe(100)
 expect(dnd5eTempleCampaignHealingBonus(context,7,15)).toBe(25)
 expect(dnd5eTempleCampaignHealingBonus(context,0,40)).toBe(0)
 context.token.x=101
 expect(dnd5eTempleCampaignHealingBonus(context,7,40)).toBe(0)
})
it('excludes already settled combat rounds and uses the strongest overlapping ward per interval',()=>{
 const c=fixture()
 c.clock.advances=[{id:'combat',kind:'advance',fromWorldMinute:1,toWorldMinute:2,minutes:1,reason:'combat',dawnsCrossed:0,expiredTimerIds:[],createdAt:1,combatRoundCredits:{[c.actorKey]:10}}]
 expect(dnd5eTempleCampaignHealingBonus(c,7,30)).toBe(50)
 c.geometry.structureLifetimes!.push({...c.geometry.structureLifetimes![0],id:'second',createdWorldMinute:2,expiresWorldMinute:4,templeWard:{...c.geometry.structureLifetimes![0].templeWard!,healingBonus:3}})
 expect(dnd5eTempleCampaignHealingBonus(c,7,30)).toBe(80)
})
it('applies the bounded bonus through campaign reconciliation without granting it again on replay',()=>{
 const c=fixture()
 const effect=createDnd5eMechanicalEffect({definitionId:'regenerate',label:'Regenerate',targetId:'hero',source:{kind:'spell',actorId:'healer',spellLevel:7,magical:true},
 duration:{type:'rounds',remainingRounds:100,tickOn:'target-turn-end'},periodicHealing:{timing:'target-turn-start',amount:1}})
 const hero=normalizeCharacter({id:'hero',name:'Hero',currentHp:1,maxHp:500,dnd5eWorldTimeAppliedMinute:0,dnd5eCombatState:{schemaVersion:2,activeEffects:[effect]}})
 const result=reconcileDnd5eCharacterCampaignTime(hero,c.clock,{templeHealing:c})
 expect(result.character.currentHp).toBe(141)
 const replay=reconcileDnd5eCharacterCampaignTime(JSON.parse(JSON.stringify(result.character)),c.clock,{templeHealing:c})
 expect(replay.character.currentHp).toBe(141)
 expect(hero.currentHp).toBe(1)
})
it.each(['permanent','expires','dead','simulacrum'] as const)('respects %s healing prevention during campaign advancement',kind=>{
 const c=fixture()
 const regeneration=createDnd5eMechanicalEffect({definitionId:'regenerate',label:'Regenerate',targetId:'hero',source:{kind:'spell',actorId:'healer',spellLevel:7,magical:true},
 duration:{type:'rounds',remainingRounds:100,tickOn:'target-turn-end'},periodicHealing:{timing:'target-turn-start',amount:1}})
 const blocked=createDnd5eMechanicalEffect({definitionId:'no-healing',label:'No healing',targetId:'hero',source:{kind:'spell',actorId:'enemy',magical:true},modifiers:{preventHealing:true},
 duration:kind==='expires'?{type:'rounds',remainingRounds:25,tickOn:'target-turn-end'}:{type:'permanent'}})
 const hero=normalizeCharacter({id:'hero',name:'Hero',currentHp:kind==='dead'?0:1,maxHp:500,deathSaveFailures:kind==='dead'?3:0,dnd5eWorldTimeAppliedMinute:0,
 dnd5eCombatState:{schemaVersion:2,activeEffects:['dead','simulacrum'].includes(kind)?[regeneration]:[regeneration,blocked]}})
 const result=reconcileDnd5eCharacterCampaignTime(hero,c.clock,{templeHealing:c,cannotRegainHitPoints:kind==='simulacrum'})
 // Twenty-five blocked rounds leave five temple ticks and ten ordinary ticks.
 expect(result.character.currentHp).toBe(kind==='expires'?41:kind==='dead'?0:1)
})
it.each([false,true])('clears only zero-HP unconsciousness after healing; independent unconsciousness=%s',asleep=>{
 const c=fixture()
 const regeneration=createDnd5eMechanicalEffect({definitionId:'regenerate',label:'Regenerate',targetId:'hero',source:{kind:'spell',actorId:'healer',spellLevel:7,magical:true},
 duration:{type:'rounds',remainingRounds:100,tickOn:'target-turn-end'},periodicHealing:{timing:'target-turn-start',amount:1}})
 const unconscious=createDnd5eConditionEffect({condition:'unconscious',targetId:'hero',source:{kind:'system',rulesId:'zero-hit-points'}})
 const prone=createDnd5eConditionEffect({condition:'prone',targetId:'hero',source:{kind:'system',rulesId:'zero-hit-points'}})
 const sleep=createDnd5eConditionEffect({condition:'unconscious',targetId:'hero',source:{kind:'spell',rulesId:'sleep',actorId:'enemy'}})
 const hero=normalizeCharacter({id:'hero',name:'Hero',currentHp:0,maxHp:500,deathSaveFailures:2,deathSaveSuccesses:1,deathSaveStable:true,dnd5eWorldTimeAppliedMinute:0,
 dnd5eCombatState:{schemaVersion:2,activeEffects:[regeneration,unconscious,prone,...asleep?[sleep]:[]]}})
 const result=reconcileDnd5eCharacterCampaignTime(hero,c.clock,{templeHealing:c}).character
 expect(result.currentHp).toBe(140)
 expect(result.deathSaveFailures).toBe(0)
 expect(result.deathSaveSuccesses).toBe(0)
 expect(result.deathSaveStable).toBe(false)
 const effects=result.dnd5eCombatState!.activeEffects!
 expect(effects.some(e=>e.standardCondition==='unconscious'&&e.source.rulesId==='zero-hit-points')).toBe(false)
 expect(effects.some(e=>e.standardCondition==='unconscious'&&e.source.rulesId==='sleep')).toBe(asleep)
 expect(effects.some(e=>e.standardCondition==='prone')).toBe(true)
})
it.each(['submerged','surfaces','water-breathing','no-air','not-submerged','water-form','magical-water'] as const)('settles collapsed breathing correctly for %s',mode=>{
 const c=fixture()
 const regeneration=createDnd5eMechanicalEffect({definitionId:'regenerate',label:'Regenerate',targetId:'hero',source:{kind:'spell',actorId:'healer',spellLevel:7,magical:true},
 duration:{type:'rounds',remainingRounds:100,tickOn:'target-turn-end'},periodicHealing:{timing:'target-turn-start',amount:1}})
 const submerged=createDnd5eMechanicalEffect({definitionId:'submerged',label:'Submerged',targetId:'hero',source:{kind:'spell',actorId:'enemy'},modifiers:{submerged:true},
 duration:mode==='surfaces'?{type:'rounds',remainingRounds:25,tickOn:'target-turn-end'}:{type:'permanent'}})
 const hero=normalizeCharacter({id:'hero',name:'Hero',currentHp:0,maxHp:500,dnd5eWorldTimeAppliedMinute:0,dnd5eCombatState:{schemaVersion:2,
 submergedBreathing:{schemaVersion:1,breathSeconds:0,survivalSeconds:0,collapsed:true,lastStepKey:'test'},activeEffects:[regeneration,...mode==='not-submerged'?[]:[submerged]]}})
 if(mode==='water-form')hero.dnd5eCombatState!.wildShapeFormId='srd-5.1:giant-shark'
 if(mode==='magical-water')hero.dnd5eCombatState!.activeEffects!.push(createDnd5eMechanicalEffect({definitionId:'water-breathing',label:'Water breathing',targetId:'hero',source:{kind:'spell',actorId:'healer'},modifiers:{environmentalCapabilities:{breatheIn:['water']}}}))
 const result=reconcileDnd5eCharacterCampaignTime(hero,c.clock,{templeHealing:c,intrinsicBreathing:mode==='water-form'?undefined:{canBreatheWater:mode==='water-breathing',doesNotNeedAir:mode==='no-air'}})
 expect(result.character.currentHp).toBe(mode==='submerged'?0:mode==='surfaces'?40:140)
 if(mode==='water-form')expect(result.character.dnd5eCombatState?.wildShapeCurrentHp).toBe(140)
})
