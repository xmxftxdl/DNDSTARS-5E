import {expect,it} from 'vitest'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction,previewDnd5eMonsterCompositePrefix,type Dnd5eAction} from './headlessCombatEngine'
import {getDnd5eSrdMonster,setDnd5eRoomMonsterCatalog} from './monsters'
import {prepareDnd5eMonsterCompositeRuntimePlan} from './monsterCompositeRuntime'
import {prepareDnd5eMonsterAttack} from './monsterAttackAction'
import type {BattleMap,Token} from '../../store/maps'
import {prepareDnd5eMonsterCoreSpell,projectResolvedDnd5eMonsterCoreSpell} from './monsterCoreSpellAction'
import {settleDnd5eConcentrationChecks} from '../../pages/maps/settleDnd5eCombatResult'
import {createDnd5eConditionEffect,createDnd5eMechanicalEffect} from './activeEffects'
import {registerDnd5eRulesPlugin} from './pluginApi'

it.each(['hit','miss','invalid'] as const)('settles a spell-step counter atomically with preceding attacks: %s',branch=>{
  const base=getDnd5eSrdMonster('srd-5.1:glabrezu')!
  const custom={...base,id:'test:composite-save-counter',slug:'test-composite-save-counter',
    spellcasting:{...base.spellcasting!,casterLevel:1,spells:[{id:'sacred-flame',name:'Sacred Flame',level:0}]}}
  setDnd5eRoomMonsterCatalog([custom])
  const dispose=registerDnd5eRulesPlugin({
    manifest:{id:'test.composite-counter',name:'Counter',version:'1.0.0',apiVersion:2,
      rulesetId:'dnd5e-2014-srd-5.1',publisher:'Test',license:'CC0'},
    setup(api){api.registerDeclarativeSubclass({schemaVersion:1,id:'hunter',name:'Hunter',classId:'ranger',summary:'Synthetic',
      abilities:[{schemaVersion:1,id:'counter',name:'Counter',description:'Synthetic',level:15,
        trigger:{kind:'before-saving-throw'},cost:{economy:'reaction'},targeting:{kind:'self'},effects:[],automation:'full',
        mechanic:{kind:'saving-throw-weapon-counterattack',markEffectDefinitionId:'prey'}}]})},
  })
  try{
    const state=fixture(),hunter=state.combatants.hero
    state.combatants.demon.statBlockId=custom.id
    hunter.classId='ranger';hunter.level=15;hunter.classLevels={ranger:15}
    hunter.subclassIds={ranger:'test.composite-counter:hunter'}
    hunter.pluginFeatureIds=['test.composite-counter:hunter.counter']
    const mark=createDnd5eMechanicalEffect({definitionId:'prey',label:'Prey',targetId:'hero',
      source:{kind:'plugin',actorId:'hero',pluginId:'test.composite-counter'},
      modifiers:{onHitBonusDamage:{count:1,sides:6,bonus:0,damageType:'inherit-primary',
        appliesTo:'all-weapon-attacks',doubleDiceOnCritical:true,oncePerTurn:true,consumeEffectOnHit:false,boundTargetId:'demon'}}})
    hunter.classState.activeEffects=[mark]
    const intent=action('sacred-flame',0),spell=intent.steps[2]
    if(spell.kind!=='spell')throw Error('missing spell')
    const hit=branch!=='miss'
    spell.resolution={schemaVersion:1,targetIds:['hero'],targetSavingThrows:[{targetId:'hero',d20:hit?0:1}],effectRolls:[[4]]}
    spell.savingThrowCounterattacks=[{targetId:'hero',sourceId:'demon',ability:'dex',occurrence:0,
      featureId:'test.composite-counter:hunter.counter',attack:{type:'attack',actorId:'hero',targetId:'demon',
        d20:hit?18:1,attackModifier:20,
        damage:{count:1,sides:6,bonus:0,rolls:hit?[branch==='invalid'?7:2]:[],type:'slashing'},
        classDamageContext:{mode:'melee',weaponId:'sword',finesse:false,strengthBased:true,
          weaponDamageSides:6,damageType:'slashing',adjacentEnemyOfTarget:false},
        classDamageRolls:hit?[{source:'activity-effect-rider',rollId:`activity-on-hit:${mark.id}`,rolls:[4]}]:[],
      }}]
    const before=structuredClone(state)
    const prefix=previewDnd5eMonsterCompositePrefix(state,{...intent,steps:intent.steps.slice(0,2)},'counter-prefix')
    expect(prefix.ok).toBe(true)
    const result=resolveDnd5eHeadlessAction(state,intent)
    expect(result.ok,result.ok?'':result.reason).toBe(branch!=='invalid')
    expect(state).toEqual(before)
    if(!result.ok){
      expect(result.state).toEqual(before)
      expect(result.events).toEqual([])
      return
    }
    expect(result.events.filter(e=>e.type==='attack-resolved')).toHaveLength(3)
    expect(result.events.filter(e=>e.type==='saving-throw-counterattack-resolved')).toHaveLength(1)
    expect(result.events.filter(e=>e.type==='turn-resource-spent'&&e.resource==='reaction')).toHaveLength(1)
    expect(result.events.filter(e=>e.type==='turn-resource-spent'&&e.resource==='action')).toHaveLength(1)
    expect(result.state.combatants.hero.turn.reactionAvailable).toBe(false)
    expect(result.events.find(e=>e.type==='saving-throw-resolved'&&e.targetId==='hero'&&e.ability==='dex'))
      .toMatchObject({success:hit,d20:hit?0:1})
  }finally{dispose();setDnd5eRoomMonsterCatalog([])}
})

it('replays attack-spell ward evidence inside a registered custom composite without committing a failed prefix',()=>{
  const base=getDnd5eSrdMonster('srd-5.1:glabrezu')!
  const custom={...base,id:'test:composite-spell-ward',slug:'test-composite-spell-ward',
    spellcasting:{...base.spellcasting!,casterLevel:1,attackBonus:8,spells:[{id:'fire-bolt',name:'Fire Bolt',level:0}]}}
  setDnd5eRoomMonsterCatalog([custom])
  try {
    const state=fixture()
    state.combatants.demon.statBlockId=custom.id
    state.combatants.warded={...structuredClone(state.combatants.hero),id:'warded',name:'Warded',position:{x:10,y:0}}
    state.initiativeOrder=[...state.initiativeOrder,'warded']
    state.distanceFeetByCombatantPair={'demon\u0000warded':10,'demon\u0000hero':5}
    const ward=createDnd5eMechanicalEffect({definitionId:'ward',label:'Ward',targetId:'warded',source:{kind:'plugin',actorId:'warded'},
      attackAttemptWard:{ability:'cha',dc:17,frequency:'once-per-turn',onFailure:'cannot-target-this-turn'}})
    state.combatants.warded.classState.activeEffects=[ward]
    const intent=action('fire-bolt',0),spell=intent.steps[2]
    if(spell.kind!=='spell')throw Error('missing spell')
    spell.resolution={schemaVersion:1,targetIds:['warded'],d20:18,d20Second:18,effectRolls:[[4]]}
    const prefix=previewDnd5eMonsterCompositePrefix(state,{...intent,steps:intent.steps.slice(0,2)},'spell-ward-prefix')
    expect(prefix.ok,JSON.stringify(prefix)).toBe(true)
    const before=JSON.stringify(state)
    for(const d20 of [1,20]) {
      spell.attackWardSaves=[{targetId:'warded',saves:[{effectId:ward.id,targetId:'demon',d20}]}]
      const result=resolveDnd5eHeadlessAction(state,intent)
      expect(result.ok,result.ok?undefined:result.reason).toBe(d20===20)
      expect(result.state.combatants.warded.currentHp).toBe(d20===20?196:200)
      if(d20===20){
        expect(result.state.combatants.hero.currentHp).toBeLessThan(200)
        expect(result.events.filter(e=>e.type==='saving-throw-resolved'&&e.ability==='cha')).toHaveLength(1)
        expect(result.events.filter(e=>e.type==='turn-resource-spent'&&e.resource==='action')).toHaveLength(1)
      }else{
        expect(result.state.combatants.hero.currentHp).toBe(200)
        expect(result.state.combatants.demon.turn.actionAvailable).toBe(true)
      }
    }
    const successful=spell.attackWardSaves!
    const blocked={targetId:'warded',saves:[{effectId:ward.id,targetId:'demon',d20:1}],spell:{spellId:'fire-bolt',slotLevel:0}}
    const abandoned={...intent,steps:[...intent.steps.slice(0,2),{kind:'skip' as const,actionId:'innate-spell-step',wardBlocked:blocked}]}
    const skip=resolveDnd5eHeadlessAction(state,abandoned)
    expect(skip.ok,skip.ok?undefined:skip.reason).toBe(true)
    expect(skip.state.combatants.hero.currentHp).toBeLessThan(200)
    expect(skip.state.combatants.warded.currentHp).toBe(200)
    expect(skip.state.combatants.demon.turn.actionAvailable).toBe(false)
    expect(skip.events.filter(e=>e.type==='monster-spell-cast')).toHaveLength(0)
    expect(skip.state.combatants.warded.classState.activeEffects?.[0].attackAttemptWardReceipts?.[0].success).toBe(false)
    const retargeted=resolveDnd5eHeadlessAction(state,{...intent,steps:[...intent.steps.slice(0,2),{
      ...spell,attackWardSaves:undefined,wardRetargets:[blocked],resolution:{...spell.resolution,targetIds:['hero']},
    }]})
    expect(retargeted.ok,retargeted.ok?undefined:retargeted.reason).toBe(true)
    expect(retargeted.state.combatants.hero.currentHp).toBe(skip.state.combatants.hero.currentHp-4)
    expect(retargeted.state.combatants.warded.currentHp).toBe(200)
    for(const forged of [{...blocked,saves:[{...blocked.saves[0],d20:20}]},
      {...blocked,spell:{spellId:'magic-missile',slotLevel:1}}, {...blocked,targetId:'hero'},
      {...blocked,saves:[]}]) {
      const result=resolveDnd5eHeadlessAction(state,{...abandoned,steps:[...intent.steps.slice(0,2),{
        kind:'skip',actionId:'innate-spell-step',wardBlocked:forged,
      }]})
      expect(result.ok).toBe(false)
      expect(result.state.combatants.hero.currentHp).toBe(200)
    }
    for(const evidence of [undefined,[],[...successful,...successful],[{targetId:'hero',saves:successful[0].saves}]]){
      spell.attackWardSaves=evidence
      const result=resolveDnd5eHeadlessAction(state,intent)
      expect(result.ok).toBe(false)
      expect(result.state.combatants.hero.currentHp).toBe(200)
    }
    expect(JSON.stringify(state)).toBe(before)
  } finally {setDnd5eRoomMonsterCatalog([])}
})

it('prepares both pincer occurrences and the spell step through the map adapter',()=>{
  const monster=getDnd5eSrdMonster('srd-5.1:glabrezu')!
  const actionIndex=monster.actions.findIndex(a=>a.id==='multiattack-pincers-and-spell')
  expect(prepareDnd5eMonsterCompositeRuntimePlan(monster,monster.actions[actionIndex])?.children.map(c=>c.kind))
    .toEqual(['weapon','weapon','spell'])
  const actor:Token={id:'demon',label:'Demon',x:0,y:0,color:'',emoji:'',size:2,type:'enemy',poolId:monster.id,hp:157,maxHp:157}
  const target:Token={id:'hero',label:'Target',x:20,y:0,color:'',emoji:'',size:1,type:'enemy',dnd5eSide:'player',poolId:'srd-5.1:bandit',hp:11,maxHp:11}
  const map:BattleMap={id:'composite-map',name:'Composite',width:200,height:100,gridSize:10,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[actor,target]}
  const prepared=prepareDnd5eMonsterAttack({combatId:'map-composite',map,characters:[],initiativeOrder:[
    {tokenId:actor.id,label:actor.label,emoji:'',color:'',roll:20},
    {tokenId:target.id,label:target.label,emoji:'',color:'',roll:10},
  ],actorTokenId:actor.id,targetTokenId:target.id,actionIndex})
  expect(prepared.ok,JSON.stringify(prepared)).toBe(true)
  if(!prepared.ok)return
  expect(prepared.prepared.attacks.map(a=>a.sequenceIndex)).toEqual([0,1])
  expect(prepared.prepared.compositeRuntime?.children.map(c=>c.kind)).toEqual(['weapon','weapon','spell'])
})

function fixture(){
  const state=startDnd5eHeadlessCombat('glabrezu-spell-multiattack',['demon','hero'].map((id,index)=>createDnd5eCombatant({
    id,name:id,controller:index?'player':'dm',initiative:20-index,statBlockId:index?undefined:'srd-5.1:glabrezu',
    abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,
    currentHp:200,maxHp:200,temporaryHp:0,speed:30,position:{x:index*5,y:0},concentrating:false,
  })))
  state.combatants.demon.classState.monsterSpellUsesBySpellId={fly:{current:1,max:1}}
  return state
}
function action(spellId:string,slotLevel:number):Extract<Dnd5eAction,{type:'monster-multiattack-composite'}>{
  return {type:'monster-multiattack-composite',schemaVersion:1,actorId:'demon',actionId:'multiattack-pincers-and-spell',steps:[
    ...[0,1].map(()=>({kind:'weapon' as const,actionId:'pincer',roll:{targetId:'hero',d20:18,damageRolls:[[1,1]],onHitEffectRolls:[{effectId:'pincer-grapple'}]}})),
    {kind:'spell',actionId:'innate-spell-step',spellId,slotLevel,resolution:{schemaVersion:1,targetIds:['demon'],effectRolls:[]}},
  ]}
}

it.each([['detect-magic',1],['fly',3]] as const)('resolves two pincers then %s using one parent action',(spellId,level)=>{
  const state=fixture(),before=structuredClone(state)
  const single=resolveDnd5eHeadlessAction(state,{type:'monster-action',actorId:'demon',actionId:'pincer',rolls:[{targetId:'hero',d20:18,damageRolls:[[1,1]],onHitEffectRolls:[{effectId:'pincer-grapple'}]}]})
  expect(single.ok,'standalone pincer: '+JSON.stringify({reason:single.ok?null:single.reason,action:getDnd5eSrdMonster('srd-5.1:glabrezu')?.actions.find(a=>a.id==='pincer')})).toBe(true)
  const resolved=resolveDnd5eHeadlessAction(state,action(spellId,level))
  expect(resolved.ok,JSON.stringify(resolved)).toBe(true)
  expect(resolved.events.filter(e=>e.type==='attack-resolved')).toHaveLength(2)
  expect(resolved.events.filter(e=>e.type==='monster-spell-cast')).toHaveLength(1)
  expect(resolved.events.filter(e=>e.type==='turn-resource-spent'&&e.resource==='action')).toHaveLength(1)
  expect(resolved.state.combatants.hero.currentHp).toBeLessThan(200)
  expect(resolved.state.combatants.demon.turn.actionAvailable).toBe(false)
  if(spellId==='fly')expect(resolved.state.combatants.demon.classState.monsterSpellUsesBySpellId?.fly.current).toBe(0)
  if(spellId==='detect-magic')expect(resolved.state.combatants.demon.classState.activeEffects?.some(e=>e.grantedActivities?.includes('spell:detect-magic:reveal-auras'))).toBe(true)
  expect(state).toEqual(before)
})

it('rejects an unlisted spell and rolls back both preceding pincer hits',()=>{
  const state=fixture(),before=structuredClone(state)
  const rejected=resolveDnd5eHeadlessAction(state,action('cure-wounds',1))
  expect(rejected.ok).toBe(false)
  expect(rejected.state.combatants.hero.currentHp).toBe(200)
  expect(rejected.state.combatants.demon.turn.actionAvailable).toBe(true)
  expect(state).toEqual(before)
})

it.each([150,164,165,200])('evaluates innate Power Word Stun after both pincer hits at initial HP %s',hp=>{
  const state=fixture()
  state.combatants.hero.currentHp=hp
  state.combatants.demon.classState.monsterSpellUsesBySpellId!['power-word-stun']={current:1,max:1}
  const intent=action('power-word-stun',8)
  const step=intent.steps[2]
  if(step.kind!=='spell')throw Error('missing spell step')
  step.resolution.targetIds=['hero']
  const result=resolveDnd5eHeadlessAction(state,intent)
  expect(result.ok,JSON.stringify(result)).toBe(true)
  expect(result.state.combatants.hero.currentHp).toBeLessThan(hp)
  if(hp===164)expect(result.state.combatants.hero.currentHp).toBe(150)
  if(hp===165)expect(result.state.combatants.hero.currentHp).toBe(151)
  expect(result.state.combatants.hero.conditions.includes('stunned')).toBe(result.state.combatants.hero.currentHp<=150)
  expect(result.events.filter(e=>e.type==='saving-throw-resolved')).toHaveLength(0)
  expect(result.state.combatants.demon.classState.monsterSpellUsesBySpellId?.['power-word-stun'].current).toBe(0)
  expect(result.events.filter(e=>e.type==='turn-resource-spent'&&e.resource==='action')).toHaveLength(1)
})

it.each([1,20])('resolves innate Dispel Magic after pincer hits with check %s',d20=>{
  const state=fixture()
  const held=createDnd5eConditionEffect({condition:'frightened',source:{kind:'spell',actorId:'other-caster',rulesId:'fear',spellLevel:4},targetId:'hero'})
  state.combatants.hero.classState.activeEffects=[held]
  const intent=action('dispel-magic',3)
  const step=intent.steps[2]
  if(step.kind!=='spell')throw Error('missing spell step')
  step.resolution={schemaVersion:1,targetIds:['hero'],effectRolls:[],dispelMagicChecks:[{effectId:held.id,d20}]}
  const result=resolveDnd5eHeadlessAction(state,intent)
  expect(result.ok,JSON.stringify(result)).toBe(true)
  expect(result.state.combatants.hero.classState.activeEffects?.some(e=>e.id===held.id)).toBe(d20===1)
  expect(result.events.filter(e=>e.type==='attack-resolved')).toHaveLength(2)
  expect(result.events).toContainEqual(expect.objectContaining({type:'spell-dispelled',spellId:'fear',spellLevel:4,dc:14,success:d20===20}))
  expect(result.events.filter(e=>e.type==='turn-resource-spent'&&e.resource==='action')).toHaveLength(1)
})

it('rolls back both hits when the chosen daily spell has already been spent',()=>{
  const state=fixture()
  state.combatants.demon.classState.monsterSpellUsesBySpellId!.fly.current=0
  const before=structuredClone(state)
  const rejected=resolveDnd5eHeadlessAction(state,action('fly',3))
  expect(rejected).toMatchObject({ok:false,reason:'class-resource-unavailable'})
  expect(rejected.state.combatants.hero.currentHp).toBe(200)
  expect(rejected.state.combatants.demon.turn.actionAvailable).toBe(true)
  expect(state).toEqual(before)
})

it.each([15,16])('settles a saving-throw spell after the pincer hits (WIS %s)',d20=>{
  const state=fixture()
  state.combatants.demon.classState.monsterSpellUsesBySpellId!.confusion={current:1,max:1}
  const intent=action('confusion',4)
  const step=intent.steps[2]
  if(step.kind!=='spell')throw Error('missing spell step')
  step.resolution={schemaVersion:1,targetIds:['hero'],effectRolls:[],targetSavingThrows:[{targetId:'hero',d20}]}
  const resolved=resolveDnd5eHeadlessAction(state,intent)
  expect(resolved.ok,JSON.stringify(resolved)).toBe(true)
  expect(resolved.events.filter(e=>e.type==='attack-resolved')).toHaveLength(2)
  expect(resolved.events.filter(e=>e.type==='saving-throw-resolved')).toHaveLength(1)
  expect(resolved.state.combatants.hero.classState.activeEffects?.some(e=>e.definitionId.includes('confusion'))??false).toBe(d20<16)
  expect(resolved.state.combatants.demon.classState.monsterSpellUsesBySpellId?.confusion.current).toBe(0)
  expect(resolved.events.filter(e=>e.type==='turn-resource-spent'&&e.resource==='action')).toHaveLength(1)
})

it('does not let the caller omit or duplicate the mandatory spell step',()=>{
  for(const steps of [action('detect-magic',1).steps.slice(0,2),[...action('detect-magic',1).steps,action('detect-magic',1).steps[2]],
    [...action('detect-magic',1).steps.slice(0,2),{kind:'skip' as const,actionId:'innate-spell-step'}]]){
    const state=fixture()
    const rejected=resolveDnd5eHeadlessAction(state,{...action('detect-magic',1),steps})
    expect(rejected.ok).toBe(false)
    expect(rejected.state.combatants.hero.currentHp).toBe(200)
    expect(rejected.state.combatants.demon.turn.actionAvailable).toBe(true)
  }
})

it('projects the Darkness area and both hits after one composite settlement without recasting',async()=>{
  const actor:Token={id:'demon',label:'Demon',x:75,y:75,color:'',emoji:'',size:2,type:'enemy',poolId:'srd-5.1:glabrezu',hp:157,maxHp:157}
  const target:Token={id:'hero',label:'Target',x:125,y:75,color:'',emoji:'',size:1,type:'enemy',dnd5eSide:'player',poolId:'srd-5.1:bandit',hp:200,maxHp:200}
  const map:BattleMap={id:'composite-darkness',name:'Darkness',width:1000,height:500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[actor,target]}
  const prepared=prepareDnd5eMonsterCoreSpell({combatId:map.id,map,characters:[],initiativeOrder:map.tokens.map((t,i)=>({tokenId:t.id,label:t.label,emoji:'',color:'',roll:20-i})),
    actorTokenId:actor.id,spellId:'darkness',slotLevel:2,targetTokenIds:[],areaTargetCell:{col:6,row:3}})
  expect(prepared.ok,JSON.stringify(prepared)).toBe(true)
  if(!prepared.ok)return
  const intent=action('darkness',2)
  const step=intent.steps[2]
  if(step.kind!=='spell')throw Error('missing spell')
  step.resolution.targetIds=[]
  const result=resolveDnd5eHeadlessAction(prepared.prepared.state,intent)
  expect(result.ok,JSON.stringify(result)).toBe(true)
  const before=structuredClone(result)
  const projected=projectResolvedDnd5eMonsterCoreSpell({prepared:prepared.prepared,result})
  expect(projected.application?.map.tokens.find(t=>t.id==='hero')?.hp).toBeLessThan(200)
  expect(projected.application?.map.dnd5ePluginAreas).toHaveLength(1)
  expect(projected.application?.map.dnd5ePluginAreas?.[0]).toMatchObject({coreSpellId:'darkness',sourceTokenId:'demon',anchorCell:{col:6,row:3}})
  expect(projected.createdAreaId).toBeTruthy()
  expect(result).toEqual(before)
  expect(projected.result.events.filter(e=>e.type==='monster-spell-cast')).toHaveLength(1)
  expect(projected.result.events.filter(e=>e.type==='turn-resource-spent'&&e.resource==='action')).toHaveLength(1)
  expect(map.dnd5ePluginAreas).toBeUndefined()
  if(!result.ok||!projected.application)throw Error('missing projection')
  const settled=await settleDnd5eConcentrationChecks({result,map:projected.application.map,characters:[],priorApplication:projected.application,
    characterIdByCombatantId:{},rollD20:async()=>20,rollD4:async()=>1,rollDice:async count=>Array(count).fill(1)})
  expect(settled.application.changedTokenIds).toContain('demon')
  expect(settled.application.changedTokenIds).toContain('hero')
  expect(settled.application.tokenPatches?.demon.dnd5eCombatState).toBeTruthy()
  expect(settled.application.map.dnd5ePluginAreas).toHaveLength(1)
})

