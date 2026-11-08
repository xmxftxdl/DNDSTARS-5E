import{createDnd5eOriginalD20Session}from'./damageCommitSession'
import{prepareDnd5eMonsterAttack,resolvePreparedDnd5eMonsterAttack}from'./monsterAttackAction'
import{getDnd5eSrdMonster}from'./monsters'
import{it,expect,vi}from'vitest'
import{buildMonsterZeroScene}from'./damageZeroMonsterOriginal.scene.fixture'
import{withAllyNaturalOneCheckpoints}from'./allyNaturalOneCheckpoint'
import{resolveDnd5eHeadlessAction}from'./headlessCombatEngine'
vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>({roomId:'room',memberId:'host',role:'dm'})}))
it('actual attack damage to0 then actual death save1 visits true helper before own Lucky',async()=>{
 const scene=await buildMonsterZeroScene()
 try{
  const zero=scene.session.resumeDamageZeroSavingThrow(scene.source.prepared.state,scene.frame,undefined)
  expect(zero.status).toBe('resolved');if(zero.status!=='resolved')throw Error(zero.status)
  const hurt=zero.result.result.state;expect(hurt.combatants['soul-token'].currentHp).toBe(0)
  let ended=resolveDnd5eHeadlessAction(hurt,{type:'end-turn',actorId:'actual-goblin'})
  for(let i=0;ended.ok&&ended.state.initiativeOrder[ended.state.initiativeIndex]!=='soul-token'&&i<8;i++)ended=resolveDnd5eHeadlessAction(ended.state,{type:'end-turn',actorId:ended.state.initiativeOrder[ended.state.initiativeIndex]})
  expect(ended.ok,ended.ok?'':ended.reason).toBe(true);expect(ended.state.initiativeOrder[ended.state.initiativeIndex]).toBe('soul-token');let offers=0
  const result=withAllyNaturalOneCheckpoints(request=>{offers++;expect(request.kind).toBe('saving-throw');expect(request.nativeLucky).not.toBe(true);const owner=request.options.find(o=>o.ownerId==='helper-token');if(!owner)throw Error('actual helper required');return{...owner,replacement:17}},()=>resolveDnd5eHeadlessAction(ended.state,{type:'death-save',actorId:'soul-token',d20:1}))
  expect(result.ok,result.ok?'':result.reason).toBe(true);expect(offers).toBe(1);expect(result.state.combatants['soul-token'].deathSaves.successes).toBe(1);expect(result.state.combatants['helper-token'].turn.reactionAvailable).toBe(false)
 }finally{scene.dispose()}
},120000)

it('actual Merrow harpoon pure opposed strength1 must offer the real nearby acquired helper',async()=>{
 const scene=await buildMonsterZeroScene()
 try{
  const old=scene.proof.map,monster=getDnd5eSrdMonster('srd-5.1:merrow');if(!monster)throw Error('Actual SRD Merrow required')
  const action=monster.actions.find(a=>a.id==='harpoon'),effect=action?.attack?.onHitEffects?.find(e=>e.kind==='forced-movement');if(!action?.attack||!effect||effect.kind!=='forced-movement')throw Error('Actual catalog opposed effect required')
  expect(effect.resistance.kind).toBe('opposed-ability-check')
  const map={...old,tokens:[{id:'merrow',poolId:monster.id,type:'enemy'as const,dnd5eSide:'enemy'as const,label:'Actual Merrow',x:525,y:375,size:2,hp:monster.hitPoints.average,maxHp:monster.hitPoints.average,color:'',emoji:'M'},...old.tokens.map(t=>t.id==='soul-token'?{...t,x:725,y:375}:t.id==='helper-token'?{...t,x:775,y:375}:t)]},initiativeOrder=map.tokens.map((t,i)=>({tokenId:t.id,label:t.label,roll:25-i,color:'',emoji:''})),prepared=prepareDnd5eMonsterAttack({combatId:'real-merrow-contest',round:1,map,characters:scene.proof.characters,initiativeOrder,actorTokenId:'merrow',targetTokenId:'soul-token',actionIndex:monster.actions.indexOf(action)})
  expect(prepared.ok).toBe(true);if(!prepared.ok)throw Error(prepared.reason);expect(prepared.prepared.state.combatants['soul-token'].currentHp).toBe(7)
  const actualInput={prepared:prepared.prepared,rolls:[{d20:18,mode:'normal'as const,damageRolls:action.attack!.damage.map(g=>Array(g.count).fill(1)),onHitEffectRolls:[{effectId:effect.id,sourceD20:10,d20:1,forcedMovement:{targetId:'soul-token',to:{x:625,y:375},distanceFeet:10}}]}]},session=createDnd5eOriginalD20Session(actualInput,resolvePreparedDnd5eMonsterAttack,'soul-token','ability-check')
  try{const stage=session.run(prepared.prepared.state);expect(stage.status).toBe('pending-ally-natural-one');if(stage.status!=='pending-ally-natural-one')throw Error(stage.status);expect(stage.request.actorId).toBe('soul-token');expect(stage.request.kind).toBe('ability-check');expect(stage.request.skill).toBeUndefined();expect(stage.request.options.some(o=>o.ownerId==='helper-token')).toBe(true)}finally{session.cancel()}
  let offers=0;const result=withAllyNaturalOneCheckpoints(request=>{offers++;expect(request.kind).toBe('ability-check');expect(request.actorId).toBe('soul-token');expect(request.skill).toBeUndefined();const owner=request.options.find(o=>o.ownerId==='helper-token');if(!owner)throw Error('Actual nearby helper required');return{...owner,replacement:1}},()=>resolvePreparedDnd5eMonsterAttack({prepared:prepared.prepared,rolls:[{d20:18,mode:'normal',damageRolls:action.attack!.damage.map(g=>Array(g.count).fill(1)),onHitEffectRolls:[{effectId:effect.id,sourceD20:10,d20:1,forcedMovement:{targetId:'soul-token',to:{x:625,y:375},distanceFeet:10}}]}]}))
  expect(result.result.ok,result.result.ok?'':result.result.reason).toBe(true);expect(result.result.events.some(e=>e.type==='monster-on-hit-contest-resolved')).toBe(true);expect(offers).toBe(1)
 }finally{scene.dispose()}
},120000)
