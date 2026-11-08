import {it,expect} from 'vitest'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction,dnd5eCombatantPairKey,type Dnd5eAction} from '../../../src/rulesets/dnd5e/headlessCombatEngine'
import {registerDnd5eRulesPlugin} from '../../../src/rulesets/dnd5e/pluginApi'
import {withAllyNaturalOneCheckpoints,type AllyNaturalOneRequest} from '../../../src/rulesets/dnd5e/allyNaturalOneCheckpoint'
import {createDnd5eDamageCommitSession} from '../../../src/rulesets/dnd5e/damageCommitSession'
import {createDnd5eConditionEffect} from '../../../src/rulesets/dnd5e/activeEffects'
import {resolveDnd5eActionWithDamageReactions} from '../../../src/rulesets/dnd5e/damageReactionFlow'

const ability={schemaVersion:1,id:'bountiful-luck',name:'慷慨吉运',description:'半身人用反应令30尺内可见的另一盟友重掷攻击、技能或豁免的自然1；接受新结果，本人幸运暂停到下自己回合结束。',level:1,trigger:{kind:'after-d20-roll'},cost:{economy:'reaction'},targeting:{kind:'single-creature',relation:'ally',rangeFeet:30,requiresSight:true,includeSelf:false},effects:[],automation:'full',mechanic:{kind:'ally-natural-one-reroll'}} as const
function fixture(outer:'full'|'partial'|'manual'='full',inner:'full'|'partial'|'manual'='full'){
  const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.bountiful',name:'Bountiful real parent',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Test',license:'CC0'},setup(api){api.registerFeat({id:'bountiful-luck',name:'慷慨吉运',summary:'Original requirement prototype',description:ability.description,automation:outer,prerequisite:{raceIds:['halfling']},declarativeAbility:{...ability,automation:inner}})}})
  const make=(id:string,initiative:number,controller:'player'|'dm'='player')=>createDnd5eCombatant({id,name:id,initiative,controller,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:12,currentHp:30,maxHp:30,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
  const ally=make('ally',30),owner=make('owner',20),enemy=make('enemy',10,'dm')
  owner.pluginFeatureIds=['test.bountiful:feat-bountiful-luck']
  owner.racialRules={halflingLucky:true,halfOrcRelentlessEndurance:false,halfOrcSavageAttacks:false,innateSpells:[]}
  const state=startDnd5eHeadlessCombat('bountiful-parent',[ally,owner,enemy])
  state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey(ally.id,owner.id)]:30}
  return {state,dispose}
}
it.each(['attack','skill','save'] as const)('reruns actual %s parent with one forced new die, real reaction cost and no parent mutation',kind=>{
  const {state,dispose}=fixture()
  try{
    if(kind==='save')state.combatants.ally.concentrating=true
    const before=structuredClone(state),requests:AllyNaturalOneRequest[]=[]
    const action:Dnd5eAction=kind==='attack'?{type:'attack',actorId:'ally',targetId:'enemy',attackModifier:5,d20:1,damage:{count:1,sides:6,bonus:0,rolls:[3],type:'slashing'}}:kind==='skill'?{type:'ability-check',actorId:'ally',ability:'dex',skill:'stealth',d20:1,dc:12}:{type:'concentration-save',actorId:'ally',d20:1,dc:10}
    const result=withAllyNaturalOneCheckpoints((request)=>{requests.push(request);return {ownerId:'owner',featureId:'test.bountiful:feat-bountiful-luck',replacement:15}},()=>resolveDnd5eHeadlessAction(state,action))
    expect(result.ok,result.ok?'':result.reason).toBe(true)
    expect(requests).toHaveLength(1);expect(requests[0]).toMatchObject({actorId:'ally',originalRolls:[1],dieIndex:0})
    expect(result.state.combatants.owner.turn.reactionAvailable).toBe(false)
    expect(result.events).toContainEqual(expect.objectContaining({type:'ally-natural-one-rerolled',actorId:'owner',targetId:'ally',originalValues:[1],values:[15],dieIndex:0,replacement:15}))
    expect(result.state.combatants.owner.classState.activeEffects?.[0].duration).toMatchObject({type:'until-turn-boundary',boundary:'source-turn-end',includeCreationTurn:false})
    if(kind==='attack')expect(result.state.combatants.enemy.currentHp).toBe(27)
    if(kind==='skill')expect(result.events).toContainEqual(expect.objectContaining({type:'ability-check-resolved',d20:15,success:true}))
    if(kind==='save')expect(result.state.combatants.ally.concentrating).toBe(true)
    expect(state).toEqual(before)
  }finally{dispose()}
})
it('accepts a replacement 1 once without recursively offering it to another owner',()=>{
  const {state,dispose}=fixture()
  try{
    const second=structuredClone(state.combatants.owner);second.id='second';state.combatants.second=second
    state.distanceFeetByCombatantPair![dnd5eCombatantPairKey('ally','second')]=5
    let prompts=0
    const result=withAllyNaturalOneCheckpoints(request=>{prompts++;expect(request.options).toHaveLength(2);return {ownerId:'owner',featureId:'test.bountiful:feat-bountiful-luck',replacement:1}},()=>resolveDnd5eHeadlessAction(state,{type:'ability-check',actorId:'ally',ability:'dex',skill:'stealth',d20:1,dc:12}))
    expect(result.ok).toBe(true);expect(prompts).toBe(1)
    expect(result.state.combatants.second.turn.reactionAvailable).toBe(true)
    expect(result.events).toContainEqual(expect.objectContaining({type:'ability-check-resolved',d20:1,success:false}))
  }finally{dispose()}
})

it.each(['too-far','unknown-distance','hostile','self','spent','dead','blinded','non-one','plain-ability'] as const)('uses the actual %s scope before a reaction choice exists',boundary=>{
  const {state,dispose}=fixture()
  try{
    if(boundary==='too-far')state.distanceFeetByCombatantPair![dnd5eCombatantPairKey('ally','owner')]=31
    if(boundary==='unknown-distance')state.distanceFeetByCombatantPair={}
    if(boundary==='hostile')state.combatants.owner.controller='dm'
    if(boundary==='self')state.combatants.ally.pluginFeatureIds=state.combatants.owner.pluginFeatureIds,state.combatants.owner.pluginFeatureIds=[]
    if(boundary==='spent')state.combatants.owner.turn.reactionAvailable=false
    if(boundary==='dead')state.combatants.owner.currentHp=0
    if(boundary==='blinded')state.combatants.owner.classState.activeEffects=[createDnd5eConditionEffect({condition:'blinded',targetId:'owner',source:{kind:'system'}})]
    let prompts=0
    const result=withAllyNaturalOneCheckpoints(()=>{prompts++;return undefined},()=>resolveDnd5eHeadlessAction(state,{type:'ability-check',actorId:'ally',ability:'dex',skill:boundary==='plain-ability'?undefined:'stealth',d20:boundary==='non-one'?2:1,dc:12}))
    expect(result.ok,result.ok?'':result.reason).toBe(true);expect(prompts).toBe(boundary==='plain-ability'?1:0)
    expect(result.state.combatants.owner.turn.reactionAvailable).toBe(boundary==='spent'?false:true)
  }finally{dispose()}
})

it.each([true,false])('uses the actual existing parent replay session, choosing=%s without publishing or double charging',use=>{
  const {state,dispose}=fixture()
  try{
    const before=structuredClone(state)
    const session=createDnd5eDamageCommitSession(state,{type:'attack',actorId:'ally',targetId:'enemy',attackModifier:5,d20:1,damage:{count:1,sides:6,bonus:0,rolls:[3],type:'slashing'}},()=>false)
    const pending=session.run(state)
    expect(pending.status).toBe('pending-ally-natural-one');expect(state).toEqual(before)
    if(pending.status!=='pending-ally-natural-one')throw Error(pending.status)
    expect(pending.snapshot.combatants.enemy.currentHp).toBe(30)
    const forged={...pending.request,actorId:'enemy'}
    expect(session.resumeAllyNaturalOne(state,pending.occurrence,forged)).toMatchObject({status:'rejected',reason:'changed-reaction'})
    const finished=session.resumeAllyNaturalOne(state,pending.occurrence,pending.request,use?{ownerId:'owner',featureId:'test.bountiful:feat-bountiful-luck',replacement:15}:undefined)
    expect(finished.status).toBe('resolved')
    if(finished.status!=='resolved')throw Error(finished.status)
    expect(finished.result.ok).toBe(true)
    expect(finished.result.state.combatants.owner.turn.reactionAvailable).toBe(!use)
    expect(finished.result.state.combatants.enemy.currentHp).toBe(use?27:30)
    expect(session.resumeAllyNaturalOne(state,pending.occurrence,pending.request)).toMatchObject({status:'rejected',reason:'session-ended'})
    expect(state).toEqual(before)
  }finally{dispose()}
})

it('runs the existing asynchronous Host driver rather than publishing a provisional failed attack',async()=>{
  const {state,dispose}=fixture()
  try{
    const before=structuredClone(state)
    let prompts=0
    const result=await resolveDnd5eActionWithDamageReactions({state,action:{type:'attack',actorId:'ally',targetId:'enemy',attackModifier:5,d20:1,damage:{count:1,sides:6,bonus:0,rolls:[3],type:'slashing'}},combatRevision:1,authorityUnchanged:()=>true,confirm:async()=>({accepted:false}),roll:async()=>{throw Error('no unrelated activity dice')},chooseAllyNaturalOne:async({request})=>{
      prompts++;expect(state).toEqual(before);expect(request.actorId).toBe('ally')
      return {ownerId:'owner',featureId:'test.bountiful:feat-bountiful-luck',replacement:15}
    }})
    expect(result.ok).toBe(true);expect(prompts).toBe(1);expect(result.state.combatants.enemy.currentHp).toBe(27)
    expect(state).toEqual(before)
  }finally{dispose()}
})

it('suppresses only native Lucky through the next own turn end, preserving the new result and restoring afterward',()=>{
  const {state,dispose}=fixture()
  try{
    const first=withAllyNaturalOneCheckpoints(()=>({ownerId:'owner',featureId:'test.bountiful:feat-bountiful-luck',replacement:15}),()=>resolveDnd5eHeadlessAction(state,{type:'ability-check',actorId:'ally',ability:'dex',skill:'stealth',d20:1,dc:12}))
    expect(first.ok).toBe(true)
    const next=resolveDnd5eHeadlessAction(first.state,{type:'end-turn',actorId:'ally'})
    expect(next.ok).toBe(true)
    const blocked=resolveDnd5eHeadlessAction(next.state,{type:'ability-check',actorId:'owner',ability:'dex',skill:'stealth',d20:1,dc:12})
    expect(blocked.ok).toBe(true)
    expect(blocked.events).toContainEqual(expect.objectContaining({type:'ability-check-resolved',d20:1}))
    const forged=resolveDnd5eHeadlessAction(next.state,{type:'ability-check',actorId:'owner',ability:'dex',skill:'stealth',d20:1,halflingLuckyD20:20,dc:12})
    expect(forged.ok).toBe(false)
    const end=resolveDnd5eHeadlessAction(blocked.state,{type:'end-turn',actorId:'owner'})
    expect(end.ok).toBe(true)
    expect(end.state.combatants.owner.classState.activeEffects).not.toEqual(expect.arrayContaining([expect.objectContaining({tags:['bountiful-luck:racial-lucky-suppressed']})]))
    const enemyEnd=resolveDnd5eHeadlessAction(end.state,{type:'end-turn',actorId:'enemy'})
    expect(enemyEnd.ok).toBe(true)
    const allyEnd=resolveDnd5eHeadlessAction(enemyEnd.state,{type:'end-turn',actorId:'ally'})
    expect(allyEnd.ok).toBe(true)
    const restored=resolveDnd5eHeadlessAction(allyEnd.state,{type:'ability-check',actorId:'owner',ability:'dex',skill:'stealth',d20:1,halflingLuckyD20:20,dc:12})
    expect(restored.ok).toBe(true)
    expect(restored.events).toContainEqual(expect.objectContaining({type:'halfling-lucky-rerolled',reroll:20}))
  }finally{dispose()}
})

it('retains Bountiful new 1 for one original die while another independent advantage die still uses native Lucky',()=>{
  const {state,dispose}=fixture()
  try{
    state.combatants.ally.racialRules=structuredClone(state.combatants.owner.racialRules)
    let prompts=0
    const result=withAllyNaturalOneCheckpoints(request=>{
      prompts++
      if(request.dieIndex===0)return {ownerId:'owner',featureId:'test.bountiful:feat-bountiful-luck',replacement:1}
      return undefined
    },()=>resolveDnd5eHeadlessAction(state,{type:'ability-check',actorId:'ally',ability:'dex',skill:'stealth',mode:'advantage',d20:1,d20Second:1,halflingLuckyD20:20,halflingLuckyD20Second:12,dc:12}))
    expect(result.ok,result.ok?'':result.reason).toBe(true);expect(prompts).toBe(1)
    expect(result.events).toContainEqual(expect.objectContaining({type:'halfling-lucky-rerolled',dieIndex:1,reroll:12}))
    expect(result.events).not.toContainEqual(expect.objectContaining({type:'halfling-lucky-rerolled',dieIndex:0}))
    expect(result.events).toContainEqual(expect.objectContaining({type:'ability-check-resolved',d20:12,total:12}))
  }finally{dispose()}
})

it.each(['spell-attack','monster-weapon','opposed-grapple','death-save'] as const)('keeps actual %s families on the same natural-one checkpoint',family=>{
  const {state,dispose}=fixture()
  try{
    const actor=state.combatants.ally
    state.distanceFeetByCombatantPair![dnd5eCombatantPairKey('ally','enemy')]=5
    let action:Dnd5eAction
    if(family==='spell-attack'){
      state.distanceFeetByCombatantPair![dnd5eCombatantPairKey('ally','enemy')]=30
      actor.classId='wizard';actor.level=1;actor.classLevels={wizard:1};actor.classSelections={'spell-cantrips':['fire-bolt']}
      action={type:'cast-spell',actorId:'ally',targetId:'enemy',spellId:'fire-bolt',slotLevel:0,d20:1,effectRolls:[3]}
    }else if(family==='monster-weapon'){
      actor.statBlockId='srd-5.1:goblin'
      action={type:'monster-action',actorId:'ally',actionId:'scimitar',rolls:[{targetId:'enemy',d20:1,damageRolls:[[3]]}]}
    }else if(family==='opposed-grapple'){
      action={type:'grapple',actorId:'ally',targetId:'enemy',actorD20:1,targetD20:10,targetDefense:'athletics'}
    }else{
      actor.currentHp=0
      action={type:'death-save',actorId:'ally',d20:1}
    }
    let prompts=0
    const result=withAllyNaturalOneCheckpoints(request=>{prompts++;expect(request.originalRolls).toEqual([1]);return {ownerId:'owner',featureId:'test.bountiful:feat-bountiful-luck',replacement:15}},()=>resolveDnd5eHeadlessAction(state,action))
    expect(result.ok,result.ok?'':result.reason).toBe(true);expect(prompts).toBe(1)
    expect(result.state.combatants.owner.turn.reactionAvailable).toBe(false)
    if(family==='spell-attack')expect(result.state.combatants.enemy.currentHp).toBe(27)
    if(family==='monster-weapon')expect(result.state.combatants.enemy.currentHp).toBeLessThan(30)
    if(family==='death-save')expect(result.state.combatants.ally.deathSaves.successes).toBe(1)
  }finally{dispose()}
})

it.each([['full','manual'],['full','partial'],['manual','full'],['partial','full']] as const)('legal outer %s / inner %s registration cannot execute or pause native Lucky',(outer,inner)=>{
  const {state,dispose}=fixture(outer,inner)
  try{
    let prompts=0
    const result=withAllyNaturalOneCheckpoints(()=>{prompts++;return undefined},()=>resolveDnd5eHeadlessAction(state,{type:'ability-check',actorId:'ally',ability:'dex',skill:'stealth',d20:1,dc:12}))
    expect(result.ok).toBe(true);expect(prompts).toBe(0)
    expect(result.state.combatants.owner.turn.reactionAvailable).toBe(true)
    expect(result.state.combatants.owner.classState.activeEffects).not.toEqual(expect.arrayContaining([expect.objectContaining({tags:['bountiful-luck:racial-lucky-suppressed']})]))
  }finally{dispose()}
})

it.each([true,false])('defers native Lucky until eligible Bountiful choice, use=%s; a new 1 never loops',use=>{
  const {state,dispose}=fixture()
  try{
    state.combatants.ally.racialRules=structuredClone(state.combatants.owner.racialRules)
    const sequence:string[]=[]
    const result=withAllyNaturalOneCheckpoints(request=>{
      sequence.push(request.nativeLucky?'native-lucky':'bountiful')
      expect(request.originalRolls).toEqual([1])
      if(request.nativeLucky)return {ownerId:'ally',featureId:'dnd5e-racial-halfling-lucky',replacement:15}
      return use?{ownerId:'owner',featureId:'test.bountiful:feat-bountiful-luck',replacement:1}:undefined
    },()=>resolveDnd5eHeadlessAction(state,{type:'ability-check',actorId:'ally',ability:'dex',skill:'stealth',d20:1,dc:12}))
    expect(result.ok,result.ok?'':result.reason).toBe(true)
    expect(sequence).toEqual(use?['bountiful']:['bountiful','native-lucky'])
    expect(result.state.combatants.owner.turn.reactionAvailable).toBe(!use)
    expect(result.events).toContainEqual(expect.objectContaining({type:'ability-check-resolved',d20:use?1:15}))
  }finally{dispose()}
})

it('preserves the old no-feat native Lucky contract without creating any new pending request',()=>{
  const {state,dispose}=fixture()
  try{
    state.combatants.owner.pluginFeatureIds=[]
    state.combatants.ally.racialRules=structuredClone(state.combatants.owner.racialRules)
    let prompts=0
    const action={type:'ability-check' as const,actorId:'ally',ability:'dex' as const,skill:'stealth',d20:1,dc:12}
    const missing=withAllyNaturalOneCheckpoints(()=>{prompts++;return undefined},()=>resolveDnd5eHeadlessAction(state,action))
    expect(missing).toMatchObject({ok:false,reason:'invalid-dice'})
    const supplied=withAllyNaturalOneCheckpoints(()=>{prompts++;return undefined},()=>resolveDnd5eHeadlessAction(state,{...action,halflingLuckyD20:15}))
    expect(supplied.ok).toBe(true);expect(prompts).toBe(0)
    expect(supplied.events).toContainEqual(expect.objectContaining({type:'halfling-lucky-rerolled',reroll:15}))
  }finally{dispose()}
})

it('a bare real resolver returns typed uncommitted decision evidence, without swallowing it as invalid dice',()=>{
  const {state,dispose}=fixture()
  try{
    const before=structuredClone(state)
    const result=resolveDnd5eHeadlessAction(state,{type:'ability-check',actorId:'ally',ability:'dex',skill:'stealth',d20:1,dc:12})
    expect(result).toMatchObject({ok:false,reason:'ally-natural-one-decision-required',events:[]})
    if(result.ok)throw Error('decision expected')
    expect(result.allyNaturalOneRequirement?.request).toMatchObject({actorId:'ally',originalRolls:[1],dieIndex:0})
    expect(result.state).toEqual(before);expect(state).toEqual(before)
  }finally{dispose()}
})

it.each(['advantage','disadvantage'] as const)('native Lucky applies only to the other independent original die in %s',mode=>{
  const {state,dispose}=fixture()
  try{
    state.combatants.ally.racialRules=structuredClone(state.combatants.owner.racialRules)
    const requests:AllyNaturalOneRequest[]=[]
    const result=withAllyNaturalOneCheckpoints(request=>{
      requests.push(request);expect(request.originalRolls).toEqual([1,1])
      return request.nativeLucky?{ownerId:'ally',featureId:'dnd5e-racial-halfling-lucky',replacement:15}:{ownerId:'owner',featureId:'test.bountiful:feat-bountiful-luck',replacement:1}
    },()=>resolveDnd5eHeadlessAction(state,{type:'ability-check',actorId:'ally',ability:'dex',skill:'stealth',mode,d20:1,d20Second:1,dc:12}))
    expect(result.ok,result.ok?'':result.reason).toBe(true)
    expect(requests.map(request=>[request.dieIndex,request.nativeLucky===true])).toEqual([[0,false],[1,true]])
    expect(result.events).toContainEqual(expect.objectContaining({type:'ability-check-resolved',d20:mode==='advantage'?15:1}))
    expect(result.events).toContainEqual(expect.objectContaining({type:'halfling-lucky-rerolled',dieIndex:1,reroll:15}))
    expect(result.events).not.toContainEqual(expect.objectContaining({type:'halfling-lucky-rerolled',dieIndex:0}))
  }finally{dispose()}
})
