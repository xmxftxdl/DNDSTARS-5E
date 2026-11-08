import { describe, expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { parseDnd5eContentPackageV2, dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { applyDnd5eInventoryMutation, normalizeDnd5eInventory } from './items'
import { createDnd5eCombatant, dnd5eCombatantPairKey, dnd5eDirectedCombatantPairKey, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, dnd5eEffectiveSpeed, commitDnd5eActivityExecution } from './headlessCombatEngine'
import { resolveDnd5eTentacleRod2014, type Dnd5eTentacleRodRollRequest } from './tentacleRod2014'
import { prepareDnd5eTentacleRodMap, resolvePreparedDnd5eTentacleRodMap } from './tentacleRod2014Map'
import { dnd5eActiveSavingThrowDisadvantages, dnd5eActiveActionOrBonusActionOnly, createDnd5eConditionEffect, createDnd5eMechanicalEffect } from './activeEffects'
import type { BattleMap } from '../../store/maps'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'

function fixture() {
  // Keep the engine regression independent of private, gitignored user packs.
  const raw={format:'dndstars5e-content',schemaVersion:2,
    manifest:{id:'test.tentacle-rod-2014',name:'Synthetic native item test',version:'1.0.0',apiVersion:2,
      rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0-1.0',distributionPolicy:'local-only'},
    provenance:{edition:'2014',contentMode:'incremental',sourceTitle:'Original synthetic test data'},assets:[],
    content:{items:[{id:'tentacle-rod',name:'Test rod',category:'equipment',icon:'magic-rod',stackable:false,
      description:'Synthetic test fixture.',rulesText:'Synthetic native item declaration.',source:{book:'Tests',license:'CC0-1.0'},
      equipment:{id:'test-rod-held',name:'Test rod',slot:'mainWeapon',allowedSlots:['mainWeapon','offHand']},
      magicItem:{kind:'rod',rarity:'rare',attunement:'required',automation:'headless'},
      use:{economy:'action',consumeQuantity:0,targeting:{kind:'creature',rangeFeet:15,includeSelf:true},effect:{kind:'tentacle-rod-2014'}}
    }]}}
  const pkg=parseDnd5eContentPackageV2(new TextEncoder().encode(JSON.stringify(raw)).buffer)!
  const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
  const templateId=`${pkg.manifest.id}:tentacle-rod`
  let owner=normalizeCharacter({id:'owner',name:'Owner',currentHp:30,maxHp:30,equipment:{}})
  const grant=applyDnd5eInventoryMutation([owner],{type:'grant',characterId:owner.id,templateId,quantity:1})
  expect(grant.ok).toBe(true)
  owner=grant.characters[0]
  owner.dnd5eInventory!.entries[0].attuned=true
  owner.dnd5eInventory!.entries[0].equippedSlot='mainWeapon'
  owner.equipment={mainWeapon:owner.dnd5eInventory!.entries[0].item.equipment!}
  owner.dnd5eInventory!.entries[0].identified=true
  const make=(id:string,initiative:number)=>createDnd5eCombatant({id,name:id,controller:id==='owner'?'player':'dm',initiative,
    abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:15,currentHp:40,maxHp:40,
    temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
  const state=startDnd5eHeadlessCombat('rod',[make('owner',30),make('target',20),make('other',10)])
  state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('owner','target')]:15,[dnd5eCombatantPairKey('owner','other')]:10}
  const intent={actorId:'owner',instanceId:normalizeDnd5eInventory(owner).entries[0].instanceId,receiptId:'use-1',targetIds:['target','target','target']}
  return {state,owner,intent,dispose}
}
const dice=(attacks=[10,10,10],save=1,requests:Dnd5eTentacleRodRollRequest[]=[])=>async(request:Dnd5eTentacleRodRollRequest)=>{
  requests.push(request)
  if(request.id==='tentacle-con-save')return Array(request.count).fill(save)
  if(request.sides===6)return Array(request.count).fill(4)
  return Array(request.count).fill(attacks[Number(request.id.slice(-1))-1])
}
describe('2014 Tentacle Rod native item transaction',()=>{
  it('settles three hits and one action, applies only the 2014 restrictions, and repeats its CON save at turn end',async()=>{
    const f=fixture();try{
      const before=structuredClone(f.state),requests:Dnd5eTentacleRodRollRequest[]=[]
      const result=await resolveDnd5eTentacleRod2014({...f,roll:dice(undefined,1,requests)})
      expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)return
      expect(f.state).toEqual(before)
      expect(result.state.combatants.target.currentHp).toBe(28)
      expect(result.state.combatants.owner.turn.actionAvailable).toBe(false)
      expect(requests.map(r=>r.id)).toEqual(['tentacle-1','tentacle-1-damage','tentacle-2','tentacle-2-damage','tentacle-3','tentacle-3-damage','tentacle-con-save'])
      const effects=result.state.combatants.target.classState.activeEffects!
      expect(effects).toHaveLength(1)
      expect(effects[0].modifiers).toMatchObject({speedMultiplier:0.5,savingThrowDisadvantages:['dex'],preventReactions:true,actionOrBonusActionOnly:true})
      expect(effects[0].duration).toMatchObject({type:'rounds',remainingRounds:10})
      expect(effects[0].repeatSave).toMatchObject({ability:'con',dc:15,timing:'target-turn-end'})
      expect(result.state.combatants.target.conditions).not.toContain('restrained')
      expect(dnd5eEffectiveSpeed(result.state.combatants.target)).toBe(15)
      expect(result.state.combatants.target.turn.reactionAvailable).toBe(false)
      expect(dnd5eActiveSavingThrowDisadvantages(effects)).toContain('dex')
      expect(dnd5eActiveActionOrBonusActionOnly(effects)).toBe(true)
      expect(effects[0].modifiers?.maximumAttacksPerTurn).toBeUndefined()
      expect(effects[0].modifiers?.armorClassBonus).toBeUndefined()
      const next=resolveDnd5eHeadlessAction(result.state,{type:'end-turn',actorId:'owner'})
      expect(next.ok).toBe(true)
      const end=resolveDnd5eHeadlessAction(next.state,{type:'end-turn',actorId:'target',activeEffectSavingThrows:[{effectId:effects[0].id,d20:20}]})
      expect(end.ok,JSON.stringify(end)).toBe(true)
      expect(end.state.combatants.target.classState.activeEffects ?? []).toHaveLength(0)
      expect(end.state.combatants.target.currentHp).toBe(28)
    }finally{f.dispose()}
  })
  it.each([[1,10,10],[10,1,10],[10,10,1]])('does not trigger a save after a miss (%s,%s,%s)',async(a,b,c)=>{
    const f=fixture();try{const requests:Dnd5eTentacleRodRollRequest[]=[];const result=await resolveDnd5eTentacleRod2014({...f,roll:dice([a,b,c],1,requests)})
      expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)return
      expect(result.state.combatants.target.currentHp).toBe(32)
      expect(requests.some(r=>r.id==='tentacle-con-save')).toBe(false)
      expect(result.slowedTargetId).toBeUndefined()
    }finally{f.dispose()}
  })
  it('supports split targets and doubles only critical damage dice',async()=>{
    const f=fixture();try{f.intent.targetIds=['target','other','target'];const result=await resolveDnd5eTentacleRod2014({...f,roll:dice([20,10,10])})
      expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)return
      expect(result.state.combatants.target.currentHp).toBe(28)
      expect(result.state.combatants.other.currentHp).toBe(36)
      expect(result.slowedTargetId).toBeUndefined()
    }finally{f.dispose()}
  })
  it('successful initial save leaves only damage',async()=>{
    const f=fixture();try{const result=await resolveDnd5eTentacleRod2014({...f,roll:dice(undefined,20)})
      expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)return
      expect(result.state.combatants.target.currentHp).toBe(28)
      expect(result.state.combatants.target.classState.activeEffects ?? []).toHaveLength(0)
    }finally{f.dispose()}
  })
  it('failed turn-end save retains the effect, and ten rounds expire even when every repeat fails',async()=>{
    const f=fixture();try{
      const result=await resolveDnd5eTentacleRod2014({...f,roll:dice()});expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)return
      let state=result.state
      const id=state.combatants.target.classState.activeEffects![0].id
      for(let round=0;round<10;round++){
        state.initiativeIndex=state.initiativeOrder.indexOf('target')
        const end=resolveDnd5eHeadlessAction(state,{type:'end-turn',actorId:'target',activeEffectSavingThrows:[{effectId:id,d20:1}]})
        expect(end.ok,JSON.stringify(end)).toBe(true);state=end.state
        if(round===0)expect(state.combatants.target.classState.activeEffects?.[0].duration).toMatchObject({remainingRounds:9})
      }
      expect(state.combatants.target.classState.activeEffects ?? []).toHaveLength(0)
      expect(state.combatants.target.currentHp).toBe(28)
      expect(dnd5eEffectiveSpeed(state.combatants.target)).toBe(30)
    }finally{f.dispose()}
  })
  it('invalid later dice rolls back the entire use, including damage and action cost',async()=>{
    const f=fixture();try{
      const before=structuredClone(f.state)
      const result=await resolveDnd5eTentacleRod2014({...f,roll:async request=>request.id==='tentacle-3'?[21]:dice()(request)})
      expect(result.ok).toBe(false);expect(f.state).toEqual(before)
      expect(f.owner.dnd5eInventory?.authorityUseReceipts).not.toContain('use-1')
    }finally{f.dispose()}
  })
  it('enforces either action or bonus action, while leaving Attack action attack counts unchanged',async()=>{
    const f=fixture();try{
      const result=await resolveDnd5eTentacleRod2014({...f,roll:dice()});expect(result.ok).toBe(true);if(!result.ok)return
      for(const first of ['action','bonus-action'] as const){
        const state=structuredClone(result.state);state.initiativeIndex=state.initiativeOrder.indexOf('target')
        const spend=(s:typeof state,economy:'action'|'bonus-action')=>commitDnd5eActivityExecution(s,{actorId:'target',activityId:'test-action',targetIds:[],
          resolution:{ok:true,status:'resolved',checks:[],proposals:[],consumptions:[{kind:'action-economy',economy,amount:1,consumeOn:'resolve'}]}})
        const used=spend(state,first);expect(used.ok,JSON.stringify(used)).toBe(true)
        expect(spend(used.state,first==='action'?'bonus-action':'action').ok).toBe(false)
      }
    }finally{f.dispose()}
  })
  it('uses disadvantage for a prone target beyond five feet and advantage within five feet',async()=>{
    const f=fixture();try{
      f.state.combatants.target.conditions=['prone']
      f.state.combatants.target.classState.activeEffects=[createDnd5eConditionEffect({targetId:'target',condition:'prone',source:{kind:'system'}})]
      for(const distance of [15,5]){
        f.state.distanceFeetByCombatantPair![dnd5eCombatantPairKey('owner','target')]=distance
        const requests:Dnd5eTentacleRodRollRequest[]=[]
        const result=await resolveDnd5eTentacleRod2014({...f,roll:dice(undefined,20,requests)})
        expect(result.ok,JSON.stringify(result)).toBe(true)
        expect(requests.filter(r=>/^tentacle-\d$/.test(r.id)).map(r=>r.mode)).toEqual(Array(3).fill(distance===15?'disadvantage':'advantage'))
      }
    }finally{f.dispose()}
  })
  it('retains the effect when the wielder is incapacitated or the victim leaves fifteen feet',async()=>{
    const f=fixture();try{
      const result=await resolveDnd5eTentacleRod2014({...f,roll:dice()});expect(result.ok).toBe(true);if(!result.ok)return
      result.state.combatants.owner.conditions=['incapacitated']
      result.state.distanceFeetByCombatantPair![dnd5eCombatantPairKey('owner','target')]=100
      result.state.initiativeIndex=result.state.initiativeOrder.indexOf('target')
      const effect=result.state.combatants.target.classState.activeEffects![0]
      const end=resolveDnd5eHeadlessAction(result.state,{type:'end-turn',actorId:'target',activeEffectSavingThrows:[{effectId:effect.id,d20:1}]})
      expect(end.ok,JSON.stringify(end)).toBe(true)
      expect(end.state.combatants.target.classState.activeEffects).toHaveLength(1)
    }finally{f.dispose()}
  })
  it('automatically doubles damage against a paralyzed creature within five feet, but not at fifteen feet',async()=>{
    const f=fixture();try{
      f.state.combatants.target.conditions=['paralyzed']
      f.state.combatants.target.classState.activeEffects=[createDnd5eConditionEffect({targetId:'target',condition:'paralyzed',source:{kind:'system'}})]
      for(const distance of [5,15]){
        f.state.distanceFeetByCombatantPair![dnd5eCombatantPairKey('owner','target')]=distance
        const result=await resolveDnd5eTentacleRod2014({...f,roll:dice(undefined,20)})
        expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)return
        expect(result.state.combatants.target.currentHp).toBe(distance===5?16:28)
      }
    }finally{f.dispose()}
  })
  it('collects independent Bless-style attack dice from live effects instead of ignoring them',async()=>{
    const f=fixture();try{
      f.state.combatants.owner.classState.activeEffects=[createDnd5eMechanicalEffect({definitionId:'test-bless',label:'Bless',targetId:'owner',source:{kind:'dm'},
        modifiers:{rollDiceModifiers:[{count:1,sides:4,direction:'add',appliesTo:['attack']}]}})]
      let extras=0
      const result=await resolveDnd5eTentacleRod2014({...f,roll:async request=>{
        if(request.sides===4){extras++;return [4]}
        return dice([2,2,2],20)(request)
      }})
      expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)return
      expect(extras).toBe(3)
      expect(result.checks.filter(check=>check.kind==='attack-roll').map(check=>check.total)).toEqual([15,15,15])
      expect(result.state.combatants.target.currentHp).toBe(28)
    }finally{f.dispose()}
  })
  it('automatically resolves concentration checks caused by the three actual damage instances',async()=>{
    const f=fixture();try{
      f.state.combatants.target.concentrating=true
      f.state.combatants.target.classState.concentrationSpellId='test-focus'
      let concentrationRolls=0
      const result=await resolveDnd5eTentacleRod2014({...f,roll:async request=>{
        if(request.id.startsWith('concentration-')){concentrationRolls++;return [20]}
        return dice(undefined,20)(request)
      }})
      expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)return
      expect(concentrationRolls).toBe(3)
      expect(result.state.combatants.target.concentrating).toBe(true)
      expect(result.events.filter(event=>event.type==='concentration-check-required').every(event=>event.settled)).toBe(true)
    }finally{f.dispose()}
  })
  it('honors magical bludgeoning resistance and immunity through ordinary damage settlement',async()=>{
    const f=fixture();try{
      f.state.combatants.target.damageResistances=['bludgeoning']
      const resisted=await resolveDnd5eTentacleRod2014({...f,roll:dice(undefined,20)})
      expect(resisted.ok,JSON.stringify(resisted)).toBe(true);if(!resisted.ok)return
      expect(resisted.state.combatants.target.currentHp).toBe(34)
      f.state.combatants.target.damageImmunities=['bludgeoning']
      const immune=await resolveDnd5eTentacleRod2014({...f,roll:dice(undefined,20)})
      expect(immune.ok,JSON.stringify(immune)).toBe(true);if(!immune.ok)return
      expect(immune.state.combatants.target.currentHp).toBe(40)
    }finally{f.dispose()}
  })
  it('persists the actual map result and inventory receipt for both DM and player requests',async()=>{
    const f=fixture();try{
      const victim=normalizeCharacter({id:'victim',name:'Victim',currentHp:40,maxHp:40,equipment:{}})
      const map:BattleMap={id:'map',name:'Rod integration',width:500,height:500,gridSize:50,feetPerCell:5,
        gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[
          {id:'owner-token',characterId:'owner',type:'player',label:'Owner',x:25,y:25,size:1,color:'',emoji:''},
          {id:'target-token',characterId:'victim',type:'enemy',label:'Victim',x:125,y:25,size:1,color:'',emoji:''},
        ]}
      for(const sourceMode of ['dm','player'] as const){
        const action:SharedPlayerActionState={id:`map-use-${sourceMode}`,mapId:'map',type:'dnd5e-item-use',status:'pending',sourceMode,
          actorTokenId:'owner-token',characterId:'owner',round:1,initiativeIndex:0,seq:1,updatedAt:1,
          dnd5eItemUse:{instanceId:f.intent.instanceId,targetTokenIds:['target-token','target-token','target-token']}}
        const prepared=prepareDnd5eTentacleRodMap({action,map,characters:[f.owner,victim],initiativeOrder:[]})
        expect(prepared).toBeDefined();if(!prepared)return
        const result=await resolvePreparedDnd5eTentacleRodMap(prepared,dice())
        expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)return
        const updated=result.application.characters.find(character=>character.id==='victim')!
        expect(updated.currentHp).toBe(28)
        expect(updated.dnd5eCombatState?.activeEffects?.[0]?.repeatSave).toMatchObject({ability:'con',dc:15})
        expect(result.application.characters.find(character=>character.id==='owner')?.dnd5eInventory?.authorityUseReceipts).toContain(action.id)
        expect(result.application.changedCharacterIds).toEqual(expect.arrayContaining(['owner','victim']))
      }
    }finally{f.dispose()}
  })
  it('writes damage and repeat-save effects back to an actual NPC token',async()=>{
    const f=fixture();try{
      const map:BattleMap={id:'npc-map',name:'NPC rod use',width:500,height:500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[
        {id:'owner-token',characterId:'owner',type:'player',label:'Owner',x:25,y:25,size:1,color:'',emoji:''},
        {id:'ogre-token',poolId:'ogre',type:'enemy',label:'Ogre',x:125,y:25,size:2,color:'',emoji:'',hp:59,maxHp:59},
      ]}
      const action:SharedPlayerActionState={id:'npc-use',mapId:map.id,type:'dnd5e-item-use',status:'pending',sourceMode:'dm',actorTokenId:'owner-token',
        characterId:'owner',round:1,initiativeIndex:0,seq:1,updatedAt:1,dnd5eItemUse:{instanceId:f.intent.instanceId,targetTokenIds:Array(3).fill('ogre-token')}}
      const prepared=prepareDnd5eTentacleRodMap({action,map,characters:[f.owner],initiativeOrder:[]})
      expect(prepared).toBeDefined();if(!prepared)return
      const result=await resolvePreparedDnd5eTentacleRodMap(prepared,dice())
      expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)return
      const token=result.application.map.tokens.find(token=>token.id==='ogre-token')!
      expect(token.hp).toBe(47)
      expect(token.dnd5eCombatState?.activeEffects?.[0]?.repeatSave).toMatchObject({ability:'con',dc:15,timing:'target-turn-end'})
      expect(result.application.changedTokenIds).toContain('ogre-token')
    }finally{f.dispose()}
  })
  it('upgrades an already-owned manual item from its currently installed template',async()=>{
    const f=fixture();try{
      f.owner.dnd5eInventory!.entries[0].item.use={economy:'action',consumeQuantity:0,effect:{kind:'dm-adjudication',adjudication:'Old 1.0.0 snapshot'}}
      const result=await resolveDnd5eTentacleRod2014({...f,roll:dice()})
      expect(result.ok,JSON.stringify(result)).toBe(true);if(!result.ok)return
      expect(result.state.combatants.target.currentHp).toBe(28)
    }finally{f.dispose()}
  })
  it.each(['unattuned','not-held','out-of-range','replay','action-spent','invalid-count','suppressed','package-disabled','blocked-effect'] as const)('rejects %s without rolling or mutating state',async(kind)=>{
    const f=fixture();try{
      if(kind==='unattuned')f.owner.dnd5eInventory!.entries[0].attuned=false
      if(kind==='not-held'){f.owner.dnd5eInventory!.entries[0].equippedSlot=undefined;f.owner.equipment={}}
      if(kind==='out-of-range')f.state.distanceFeetByCombatantPair![dnd5eCombatantPairKey('owner','target')]=20
      if(kind==='replay')f.owner.dnd5eInventory!.authorityUseReceipts=['use-1']
      if(kind==='action-spent')f.state.combatants.owner.turn.actionAvailable=false
      if(kind==='invalid-count')f.intent.targetIds=['target','target']
      if(kind==='suppressed')f.state.combatants.owner.magicSuppressed=true
      if(kind==='package-disabled')f.dispose()
      if(kind==='blocked-effect')f.state.lineOfEffectBlockedByCombatantPair={[dnd5eDirectedCombatantPairKey('owner','target')]:true}
      const before=structuredClone(f.state),requests:Dnd5eTentacleRodRollRequest[]=[]
      expect((await resolveDnd5eTentacleRod2014({...f,roll:dice(undefined,1,requests)})).ok).toBe(false)
      expect(requests).toHaveLength(0);expect(f.state).toEqual(before)
    }finally{f.dispose()}
  })
})
