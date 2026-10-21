import './activeEffects'
import { dnd5eExecutableCompanionOrder } from './companionOrderExecution'
import { migrateMapsState } from '../../store/maps'
import { afterEach, describe, expect, it } from 'vitest'
import { setMapGeometryRuntime } from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from './mapBridge'
import { resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { planDnd5eMonsterTurn } from './monsterTurnPlanner'
import { dnd5eSummonAutomaticTargets } from './summonAutomaticTargets'
import { prepareDnd5eMonsterAttack, resolvePreparedDnd5eMonsterAttack } from './monsterAttackAction'
import { resolveDnd5eMonsterMapMove } from './monsterMoveAction'
import { resolveDnd5eMonsterHelp } from './monsterBasicAction'
import { createDnd5eConditionEffect } from './activeEffects'
import { normalizeCharacter } from '../../store/characters'

const token = (id: string, x: number, patch: Partial<Token> = {}): Token => ({
  id, label: id, x, y: 25, size: 1, type: 'enemy', hp: 30, maxHp: 30,
  emoji: '', color: '', poolId: 'srd-5.1:goblin', ...patch,
})
const summon = (uncontrolled = false): Token => token('summon', 25, {
  poolId: 'srd-5.1:dretch',
  dnd5eSummon: { schemaVersion: 1, pluginId: 'test', featureId: 'summon',
    sourceCharacterId: 'owner', sourceTokenId: 'owner-token', createdRound: 1,
    expiresAfterRound: 600, side: 'enemy', commandPolicy: 'turn-order',
    controlSave: { ability: 'cha', dc: 15 }, controlEnded: uncontrolled ? true : undefined },
})
const map = (tokens: Token[]): BattleMap => ({ id: 'summon-target-map', name: 'Test',
  width: 600, height: 250, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0,
  showGrid: true, feetPerCell: 5, tokens })

describe('automatic summon turns', () => {
  it('protects an incapacitated source from visible enemies, preserves orders, and rejects allied attacks at the Host', () => {
    const actor = summon()
    actor.poolId = 'srd-5.1:goblin'
    actor.dnd5eSummon = { ...actor.dnd5eSummon!, side: 'player', controlSave: undefined,
      commandPolicy: 'persistent-order', autonomousBehavior: 'protect-source' }
    const owner = token('owner-token', 75, { type: 'player', characterId: 'owner', hp: 0 })
    const ally = token('ally', 75, { type: 'player' })
    const enemy = token('enemy', 125)
    const character = normalizeCharacter({ id: 'owner', name: 'Owner', currentHp: 0, maxHp: 30,
      conditions: ['unconscious'], charClass: '德鲁伊', level: 14 })
    const saved = migrateMapsState(JSON.parse(JSON.stringify({ maps: [map([actor, owner, ally, enemy])] }))).maps[0]
    const restoredActor = saved.tokens[0]
    expect(restoredActor.dnd5eSummon?.autonomousBehavior).toBe('protect-source')
    expect(dnd5eExecutableCompanionOrder(restoredActor, 'combat:1:summon', saved)).toMatchObject({ command: 'attack', autonomous: true })
    expect(dnd5eSummonAutomaticTargets(saved, restoredActor, [character])?.targets.map(t => t.id)).toEqual(['enemy'])
    expect(planDnd5eMonsterTurn(saved, restoredActor, [character])).toMatchObject({ attacked: true, targetTokenId: 'enemy' })
    const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'protector', map: saved, characters: [character],
      initiativeOrder: saved.tokens.map((t, i) => ({ tokenId: t.id, label: t.label, emoji: '', color: '', roll: 20 - i })) })
    const attack = { type: 'attack' as const, actorId: actor.id, targetId: enemy.id, attackModifier: 4, d20: 18,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [3], type: 'slashing' as const }, rangeFeet: 30 }
    expect(resolveDnd5eHeadlessAction(snapshot.state, { ...attack, targetId: ally.id })).toMatchObject({ ok: false, reason: 'invalid-target' })
    expect(resolveDnd5eHeadlessAction(snapshot.state, attack).ok).toBe(true)
    restoredActor.dnd5eCombatState = { companionCommand: { schemaVersion: 1, sourceOwnerId: 'owner-token',
      sourceFeatureId: 'summon', command: 'dodge', issuedRound: 1, persistentOrder: true } }
    expect(dnd5eExecutableCompanionOrder(restoredActor, 'combat:1:summon', saved)).toMatchObject({ command: 'dodge' })
    expect(dnd5eSummonAutomaticTargets(saved, restoredActor, [character])).toMatchObject({ mode: 'dodge', targets: [] })
    restoredActor.dnd5eCombatState = { summonAutonomousTurnKey: 'combat:1:summon' }
    expect(dnd5eExecutableCompanionOrder(restoredActor, 'combat:1:summon', saved)).toBeUndefined()
    expect(dnd5eExecutableCompanionOrder(restoredActor, 'combat:2:summon', saved)?.autonomous).toBe(true)
    expect(dnd5eSummonAutomaticTargets({ ...saved, tokens: saved.tokens.filter(t => t.id !== enemy.id) }, restoredActor, [character]))
      .toMatchObject({ mode: 'dodge', targets: [] })
  })
  it('autonomously pursues the nearest other subtype without control saves or player commands',()=>{
    const actor=summon()
    actor.dnd5eSummon={...actor.dnd5eSummon!,commandPolicy:undefined,controlSave:undefined,
      requiredCreatureSubtype:'demon',autonomousBehavior:'attack-nearest-other-subtype'}
    const current=map([actor,token('other-demon',50,{poolId:'srd-5.1:dretch'}),
      token('near',100,{type:'player'}),token('far',175,{type:'player'})])
    const restored=migrateMapsState(JSON.parse(JSON.stringify({maps:[current]}))).maps[0]
    const restoredActor=restored.tokens[0]
    expect(restoredActor.dnd5eSummon?.autonomousBehavior).toBe('attack-nearest-other-subtype')
    expect(dnd5eExecutableCompanionOrder(restoredActor,'combat:1:summon',restored)).toMatchObject({command:'attack',autonomous:true})
    expect(dnd5eSummonAutomaticTargets(restored,restoredActor,[])?.targets.map(t=>t.id)).toEqual(['near'])
    const snapshot=createDnd5eMapCombatSnapshot({combatId:'lesser',map:restored,characters:[],initiativeOrder:restored.tokens.map((t,i)=>({tokenId:t.id,label:t.label,emoji:'',color:'',roll:20-i}))})
    expect(snapshot.state.combatants[actor.id].summonedUncontrolledSubtype).toBe('demon')
    const attack={type:'attack' as const,actorId:actor.id,targetId:'near',attackModifier:4,d20:12,damage:{count:1,sides:6,bonus:0,rolls:[3],type:'slashing' as const},rangeFeet:30}
    expect(resolveDnd5eHeadlessAction(snapshot.state,{...attack,targetId:'far'})).toMatchObject({ok:false,reason:'invalid-target'})
    expect(resolveDnd5eHeadlessAction(snapshot.state,{...attack,targetId:'other-demon'})).toMatchObject({ok:false,reason:'invalid-target'})
    expect(resolveDnd5eHeadlessAction(snapshot.state,attack).ok).toBe(true)
  })

  it('admits autonomous nearest-target turns without an owner command and persists its checkpoint',()=>{
    const actor=summon()
    actor.dnd5eSummon={...actor.dnd5eSummon!,commandPolicy:undefined,controlSave:undefined,
      persistent:true,independentPersistent:true,autonomousBehavior:'attack-nearest-visible'}
    const current=map([actor,token('nearest',75),token('farther',225,{type:'player'})])
    expect(dnd5eExecutableCompanionOrder(actor,'combat:1:summon',current)).toMatchObject({command:'attack',autonomous:true})
    expect(planDnd5eMonsterTurn(current,actor)).toMatchObject({attacked:true,targetTokenId:'nearest'})
    actor.dnd5eCombatState={summonAutonomousTurnKey:'combat:1:summon'}
    const restored=migrateMapsState(JSON.parse(JSON.stringify({maps:[current]}))).maps[0]
    expect(dnd5eExecutableCompanionOrder(restored.tokens[0],'combat:1:summon',restored)).toBeUndefined()
    expect(dnd5eExecutableCompanionOrder(restored.tokens[0],'combat:2:summon',restored)?.autonomous).toBe(true)
    expect(restored.tokens[0].dnd5eCombatState?.companionCommand).toBeUndefined()
    restored.tokens[0].dnd5eSummon!.autonomousBehavior=undefined
    expect(dnd5eExecutableCompanionOrder(restored.tokens[0],'combat:2:summon',restored)).toBeUndefined()
  })

  it('guards only living visible hostile footprints intersecting the selected region after JSON reload', () => {
    const actor=summon()
    actor.dnd5eCombatState={companionCommand:{schemaVersion:1,sourceOwnerId:'owner-token',sourceFeatureId:'summon',
      command:'attack',issuedRound:1,persistentOrder:true,guardArea:{mapId:'summon-target-map',minX:100,minY:0,maxX:250,maxY:100}}}
    const current=JSON.parse(JSON.stringify(map([actor,token('outside',75,{type:'player'}),token('inside',125,{type:'player'}),
      token('ally',175),token('dead',225,{type:'player',hp:0}),token('large',275,{type:'player',size:2})]))) as BattleMap
    expect(dnd5eSummonAutomaticTargets(current,current.tokens[0],[])?.targets.map(t=>t.id)).toEqual(['inside','large'])
    current.tokens.find(t=>t.id==='inside')!.x=375
    expect(dnd5eSummonAutomaticTargets(current,current.tokens[0],[])?.targets.map(t=>t.id)).toEqual(['large'])
    current.tokens[0].dnd5eCombatState!.companionCommand!.guardArea!.mapId='other'
    expect(dnd5eSummonAutomaticTargets(current,current.tokens[0],[])).toEqual({mode:'dodge',targets:[]})
  })
  it('keeps the chosen attack target instead of a nearer hostile and waits if it disappears',()=>{
    const actor=summon()
    actor.dnd5eCombatState={companionCommand:{schemaVersion:1,sourceOwnerId:'owner-token',sourceFeatureId:'summon',command:'attack',attackTargetId:'chosen',issuedRound:1,persistentOrder:true}}
    const current=map([actor,token('near',75,{type:'player'}),token('chosen',175)])
    expect(dnd5eSummonAutomaticTargets(current,actor,[])?.targets.map(t=>t.id)).toEqual(['chosen'])
    expect(dnd5eSummonAutomaticTargets({...current,tokens:current.tokens.filter(t=>t.id!=='chosen')},actor,[])?.targets).toEqual([])
    current.tokens[2].hp=0
    expect(dnd5eSummonAutomaticTargets(current,actor,[])?.targets).toEqual([])
    const fallen=normalizeCharacter({id:'fallen',name:'Fallen',currentHp:0,maxHp:20,deathSaveFailures:0})
    current.tokens[2]={...current.tokens[2],type:'player',characterId:'fallen',poolId:undefined}
    expect(dnd5eSummonAutomaticTargets(current,actor,[fallen])?.targets.map(t=>t.id)).toEqual(['chosen'])
    expect(planDnd5eMonsterTurn(current,actor,[fallen])).toMatchObject({attacked:true,targetTokenId:'chosen'})
    fallen.deathSaveFailures=3
    expect(dnd5eSummonAutomaticTargets(current,actor,[fallen])?.targets).toEqual([])
  })
  it('keeps a living unconscious creature eligible and stops targeting it after confirmed death',()=>{
    const actor=summon()
    actor.poolId='srd-5.1:zombie'
    actor.dnd5eSummon={...actor.dnd5eSummon!,commandPolicy:undefined,controlSave:undefined,autonomousBehavior:'attack-nearest-visible'}
    const hero=normalizeCharacter({id:'fallen',name:'Fallen',currentHp:0,maxHp:20,deathSaveFailures:0})
    const current=map([actor,token('fallen-token',75,{type:'player',characterId:hero.id,hp:0,maxHp:20,poolId:undefined}),token('far',175,{type:'player'})])
    expect(dnd5eSummonAutomaticTargets(current,actor,[hero])?.targets.map(target=>target.id)).toEqual(['fallen-token'])
    const plan=planDnd5eMonsterTurn(current,actor,[hero])
    expect(plan).toMatchObject({attacked:true,targetTokenId:'fallen-token'})
    const initiativeOrder=current.tokens.map((entry,index)=>({tokenId:entry.id,label:entry.label,emoji:entry.emoji,color:entry.color,roll:20-index}))
    const prepared=prepareDnd5eMonsterAttack({combatId:'unconscious',map:current,characters:[hero],initiativeOrder,actorTokenId:actor.id,targetTokenId:'fallen-token',actionIndex:plan.actionIndex})
    expect(prepared.ok,prepared.ok?'':prepared.reason).toBe(true)
    if(prepared.ok){
      const result=resolvePreparedDnd5eMonsterAttack({prepared:prepared.prepared,rolls:prepared.prepared.attacks.map(()=>({d20:1,d20Second:1,damageRolls:[]}))})
      expect(result.result.ok,result.result.ok?'':result.result.reason).toBe(true)
      const hit=resolvePreparedDnd5eMonsterAttack({prepared:prepared.prepared,rolls:prepared.prepared.attacks.map(entry=>({d20:20,d20Second:20,damageRolls:entry.attack.damage.map(damage=>Array(damage.count*2).fill(1))}))})
      expect(hit.result.ok,hit.result.ok?'':hit.result.reason).toBe(true)
      expect(hit.result.state.combatants['fallen-token'].deathSaves).toMatchObject({failures:2,dead:false})
    }
    hero.deathSaveFailures=3
    expect(dnd5eSummonAutomaticTargets(current,actor,[hero])?.targets.map(target=>target.id)).toEqual(['far'])
  })
  it('plans autonomous attacks against the nearest visible creature of either faction and rejects a farther target at Host', () => {
    const actor=summon()
    actor.dnd5eSummon={...actor.dnd5eSummon!,commandPolicy:undefined,controlSave:undefined,autonomousBehavior:'attack-nearest-visible'}
    const current=map([actor,token('invisible',75,{dnd5eCombatState:{activeEffects:[createDnd5eConditionEffect({condition:'invisible',targetId:'invisible',source:{kind:'spell'},duration:{type:'permanent'}})]}}),token('near',125,{poolId:'srd-5.1:dretch'}),token('far',375,{type:'player'})])
    expect(dnd5eSummonAutomaticTargets(current,actor,[])?.targets.map(target=>target.id)).toEqual(['near'])
    const plan=planDnd5eMonsterTurn(current,actor)
    expect(plan).toMatchObject({moved:true,attacked:true,targetTokenId:'near'})
    const snapshot=createDnd5eMapCombatSnapshot({combatId:'autonomous',map:current,characters:[],initiativeOrder:current.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:token.emoji,color:token.color,roll:20-index}))})
    expect(snapshot.state.combatants[actor.id].summonedAutonomousBehavior).toBe('attack-nearest-visible')
    const attack={type:'attack' as const,actorId:actor.id,targetId:'near',attackModifier:4,d20:12,damage:{count:1,sides:6,bonus:0,rolls:[3],type:'slashing' as const}}
    expect(resolveDnd5eHeadlessAction(snapshot.state,{...attack,targetId:'far'})).toMatchObject({ok:false,reason:'invalid-target'})
    expect(resolveDnd5eHeadlessAction(snapshot.state,{...attack,targetId:'invisible'})).toMatchObject({ok:false,reason:'invalid-target'})
    expect(resolveDnd5eHeadlessAction(snapshot.state,attack).ok).toBe(true)
    current.tokens.push(token('tied',25,{y:125,type:'player'}))
    expect(dnd5eSummonAutomaticTargets(current,actor,[])?.targets.map(target=>target.id)).toEqual(['near','tied'])
    const moved={...actor,x:75}
    expect(dnd5eSummonAutomaticTargets(current,moved,[])?.targets.map(target=>target.id)).toEqual(['near'])
    actor.dnd5eCombatState={activeEffects:[createDnd5eConditionEffect({condition:'blinded',targetId:actor.id,source:{kind:'spell'},duration:{type:'permanent'}})]}
    expect(dnd5eSummonAutomaticTargets(current,actor,[])?.targets).toEqual([])
    actor.dnd5eCombatState=undefined
    current.tokens=current.tokens.filter(target=>target.id===actor.id||target.id==='invisible')
    expect(dnd5eSummonAutomaticTargets(current,actor,[])?.targets).toEqual([])
    expect(planDnd5eMonsterTurn(current,actor)).toMatchObject({attacked:false,moved:false,dodged:true})
  })
  afterEach(() => setMapGeometryRuntime([]))

  it('defaults to Dodge instead of attacking an unprovoked enemy without an order', () => {
    const actor = summon()
    const current = map([actor, token('enemy', 75, { type: 'player' })])
    expect(planDnd5eMonsterTurn(current, actor)).toMatchObject({ attacked: false, moved: false, dodged: true })
  })

  it.each([
    ['persistent-order', 'attack'], ['turn-order', 'attack'],
    ['persistent-order', 'ability-check'], ['turn-order', 'ability-check'],
  ] as const)('plans and applies bound %s %s Help after map restoration', (policy, helpKind) => {
    const actor = summon()
    actor.dnd5eSummon!.commandPolicy = policy
    actor.dnd5eCombatState = { companionCommand: {
      schemaVersion: 1, sourceOwnerId: 'owner-token', sourceFeatureId: 'summon',
      command: 'help', helpTargetId: 'chosen', helpKind, issuedRound: 1,
      persistentOrder: policy === 'persistent-order',
    } }
    const current = JSON.parse(JSON.stringify(map([actor,
      token('chosen', 75, { type: helpKind === 'attack' ? 'player' : 'enemy' }),
      token('other', 25, { y: 75, type: 'player' }),
    ]))) as BattleMap
    const before = structuredClone(current)
    const restoredActor = current.tokens[0]
    const plan = planDnd5eMonsterTurn(current, restoredActor)
    expect(plan).toMatchObject({ moved: false, attacked: false, help: { targetTokenId: 'chosen', helpKind } })
    const settled = resolveDnd5eMonsterHelp({ combatId: 'planned-help', map: current, characters: [],
      actorTokenId: actor.id, ...plan.help!, initiativeOrder: current.tokens.map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })) })
    expect(settled.ok, JSON.stringify(settled)).toBe(true)
    if (!settled.ok) return
    expect(settled.result.ok, JSON.stringify(settled.result)).toBe(true)
    if (!settled.result.ok) return
    expect(settled.result.state.combatants[actor.id].turn.actionAvailable).toBe(false)
    const applied = JSON.parse(JSON.stringify(settled.application!.map)) as BattleMap
    expect(applied.tokens.find(entry => entry.id === 'chosen')!.dnd5eCombatState)
      .toMatchObject(helpKind === 'attack' ? { helpedAttackSourceId: actor.id } : { helpedAbilityCheckSourceId: actor.id })
    if (helpKind === 'ability-check') {
      const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'planned-help', map: applied, characters: [],
        initiativeOrder: applied.tokens.map((entry, index) => ({ tokenId: entry.id, label: entry.label,
          emoji: '', color: '', roll: 20 - index })) })
      const advanced = resolveDnd5eHeadlessAction(snapshot.state, { type: 'end-turn', actorId: actor.id })
      expect(advanced.ok).toBe(true)
      if (!advanced.ok) return
      const checked = resolveDnd5eHeadlessAction(advanced.state, { type: 'ability-check', actorId: 'chosen',
        ability: 'str', d20: 2, d20Second: 18 })
      expect(checked.ok, JSON.stringify(checked)).toBe(true)
      if (!checked.ok) return
      expect(checked.events).toContainEqual(expect.objectContaining({ type: 'ability-check-resolved', mode: 'advantage', d20: 18 }))
      expect(checked.state.combatants.chosen.classState.helpedAbilityCheckSourceId).toBeUndefined()
    }
    expect(current).toEqual(before)
    const missing = { ...current, tokens: current.tokens.filter(entry => entry.id !== 'chosen') }
    const waiting = planDnd5eMonsterTurn(missing, restoredActor)
    expect(waiting.help).toBeUndefined()
    expect(waiting.attacked).toBe(false)
    if (helpKind === 'attack') {
      const distant = { ...current, tokens: current.tokens.map(entry => entry.id === 'chosen' ? { ...entry, x: 175 } : entry) }
      expect(planDnd5eMonsterTurn(distant, restoredActor).help).toBeUndefined()
    }
  })

  it.each([
    ['persistent-order', 'dash'], ['turn-order', 'dash'],
    ['persistent-order', 'disengage'], ['turn-order', 'disengage'],
  ] as const)('executes %s %s with a chosen map destination and saves the result', (policy, command) => {
    const actor = summon()
    actor.dnd5eSummon!.commandPolicy = policy
    actor.dnd5eCombatState = { companionCommand: {
      schemaVersion: 1, sourceOwnerId: 'owner-token', sourceFeatureId: 'summon',
      command, issuedRound: 1, persistentOrder: policy === 'persistent-order',
    } }
    const current = map([actor, token('enemy', 25, { y: 75, type: 'player' })])
    const before = structuredClone(current)
    const input = { combatId: 'ordered-movement', map: current, characters: [],
      initiativeOrder: current.tokens.map((entry, index) => ({ tokenId: entry.id, label: entry.label,
        emoji: '', color: '', roll: 20 - index })), actorTokenId: actor.id,
      to: { x: command === 'dash' ? 325 : 175, y: 25 },
      dash: command === 'dash', disengage: command === 'disengage' }
    const moved = resolveDnd5eMonsterMapMove(input)
    expect(moved.ok, JSON.stringify(moved)).toBe(true)
    if (!moved.ok) return
    expect(moved.result.ok, JSON.stringify(moved.result)).toBe(true)
    if (!moved.result.ok) return
    expect(moved.result.state.combatants[actor.id].turn.actionAvailable).toBe(false)
    expect(moved.application).toBeDefined()
    const restored = JSON.parse(JSON.stringify(moved.application!.map)) as BattleMap
    expect(restored.tokens.find(entry => entry.id === actor.id)).toMatchObject({
      ...input.to, dnd5eCombatState: { companionCommand: { command, sourceOwnerId: 'owner-token' } },
    })
    expect(current).toEqual(before)
    const uncommanded = structuredClone(current)
    uncommanded.tokens[0].dnd5eCombatState!.companionCommand = undefined
    const rejected = resolveDnd5eMonsterMapMove({ ...input, map: uncommanded })
    expect(rejected.ok && rejected.result.ok).toBe(false)
    if (rejected.ok) expect(rejected.application).toBeUndefined()
    expect(uncommanded.tokens[0].x).toBe(actor.x)
  })

  it.each(['persistent-order', 'turn-order'] as const)('plans and settles a restored %s Dodge order instead of attacking an aggressor', policy => {
    const actor = summon()
    actor.dnd5eSummon!.commandPolicy = policy
    actor.dnd5eCombatState = { summonAttackerIds: ['aggressor'], companionCommand: {
      schemaVersion: 1, sourceOwnerId: 'owner-token', sourceFeatureId: 'summon',
      command: 'dodge', issuedRound: 1, persistentOrder: policy === 'persistent-order',
    } }
    const current = JSON.parse(JSON.stringify(map([actor, token('aggressor', 75, { type: 'player' })]))) as BattleMap
    const restoredActor = current.tokens[0]
    const before = structuredClone(current)
    const plan = planDnd5eMonsterTurn(current, restoredActor)
    expect(plan).toMatchObject({ moved: false, attacked: false, dodged: true })
    expect(plan.message).toContain('遵照命令')
    expect(plan.targetTokenId).toBeUndefined()
    const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'ordered-dodge', map: current,
      characters: [], initiativeOrder: current.tokens.map((entry, index) => ({
        tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
      })) })
    const settled = resolveDnd5eHeadlessAction(snapshot.state, { type: 'dodge', actorId: actor.id })
    expect(settled.ok, JSON.stringify(settled)).toBe(true)
    if (!settled.ok) return
    expect(settled.state.combatants[actor.id].turn.actionAvailable).toBe(false)
    expect(resolveDnd5eHeadlessAction(settled.state, { type: 'dodge', actorId: actor.id }).ok).toBe(false)
    expect(current).toEqual(before)
  })

  it('retaliates against an attacker regardless of faction and keeps every multiattack target authorized', () => {
    const actor = summon()
    actor.dnd5eCombatState = { summonAttackerIds: ['aggressor'] }
    const current = map([actor, token('aggressor', 75), token('innocent', 25, { y: 75, type: 'player' })])
    const plan = planDnd5eMonsterTurn(current, actor)
    expect(plan.attacked).toBe(true)
    expect(plan.targetTokenId).toBe('aggressor')
    expect(plan.attackTargetTokenIds?.every(id => id === 'aggressor')).toBe(true)
  })

  it.each(['persistent-order', 'turn-order'] as const)('keeps a restored %s attack order inside attack planning and Host settlement', policy => {
    const actor = summon()
    actor.dnd5eSummon!.commandPolicy = policy
    actor.dnd5eCombatState = { companionCommand: {
      schemaVersion: 1, sourceOwnerId: 'owner-token', sourceFeatureId: 'summon',
      command: 'attack', issuedRound: 1, persistentOrder: policy === 'persistent-order',
    } }
    const current = JSON.parse(JSON.stringify(map([actor, token('enemy', 75, { type: 'player' }),
      token('ally', 25, { y: 75 })]))) as BattleMap
    const restoredActor = current.tokens[0]
    expect(dnd5eSummonAutomaticTargets(current, restoredActor, [])?.targets.map(entry => entry.id)).toEqual(['enemy'])
    const plan = planDnd5eMonsterTurn(current, restoredActor)
    expect(plan.attacked).toBe(true)
    expect(plan.targetTokenId).toBe('enemy')
    expect(plan.spellCast).toBeUndefined()
    expect(plan.specialAction).toBeUndefined()
    expect(plan.dodged).toBeFalsy()
    expect(plan.dashed).toBeFalsy()
    expect(plan.nimbleEscape).toBeUndefined()
    const prepared = prepareDnd5eMonsterAttack({ combatId: 'ordered-attack', map: current, characters: [],
      initiativeOrder: current.tokens.map((entry, index) => ({ tokenId: entry.id, label: entry.label,
        emoji: '', color: '', roll: 20 - index })),
      actorTokenId: actor.id, targetTokenId: plan.targetTokenId!, targetTokenIds: plan.attackTargetTokenIds,
      actionIndex: plan.actionIndex })
    expect(prepared.ok, JSON.stringify(prepared)).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eMonsterAttack({ prepared: prepared.prepared,
      rolls: prepared.prepared.attacks.map(() => ({ d20: 12, damageRolls: [[3]] })) })
    expect(resolved.result.ok, JSON.stringify(resolved.result)).toBe(true)
    const noEnemy = { ...current, tokens: current.tokens.filter(entry => entry.id !== 'enemy') }
    expect(planDnd5eMonsterTurn(noEnemy, restoredActor)).toMatchObject({ attacked: false, moved: false, dodged: false })
    const distant = { ...current, tokens: current.tokens.map(entry => entry.id === 'enemy' ? { ...entry, x: 525 } : entry) }
    const waiting = planDnd5eMonsterTurn(distant, restoredActor)
    expect(waiting.attacked).toBe(false)
    expect(waiting.dashed).toBeFalsy()
    expect(waiting.dodged).toBeFalsy()
  })

  it.each(['persistent-order', 'turn-order'] as const)('persists a real missed attack as %s retaliation authority through the map handoff', policy => {
    const actor = summon()
    actor.dnd5eSummon!.commandPolicy = policy
    const aggressor = token('aggressor', 75)
    const current = map([actor, aggressor, token('innocent', 25, { y: 75, type: 'player' })])
    const initiativeOrder = [aggressor, actor, current.tokens[2]].map((entry, index) => ({
      tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index,
    }))
    const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'retaliation', map: current,
      characters: [], initiativeOrder })
    const attack = resolveDnd5eHeadlessAction(snapshot.state, { type: 'attack', actorId: aggressor.id,
      targetId: actor.id, attackModifier: 0, d20: 1,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [3], type: 'slashing' } })
    expect(attack.ok).toBe(true)
    if (!attack.ok) return
    const applied = planDnd5eMapResultApplication({ state: attack.state, events: [...attack.events],
      map: current, characters: [], characterIdByCombatantId: snapshot.characterIdByCombatantId })
    const restored = JSON.parse(JSON.stringify(applied.map)) as BattleMap
    const restoredActor = restored.tokens.find(entry => entry.id === actor.id)!
    expect(restoredActor.dnd5eCombatState?.summonAttackerIds).toEqual([aggressor.id])
    const plan = planDnd5eMonsterTurn(restored, restoredActor)
    expect(plan.attacked).toBe(true)
    const prepared = prepareDnd5eMonsterAttack({ combatId: 'retaliation', map: restored, characters: [],
      initiativeOrder, actorTokenId: actor.id, targetTokenId: plan.targetTokenId!,
      targetTokenIds: plan.attackTargetTokenIds, actionIndex: plan.actionIndex })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eMonsterAttack({ prepared: prepared.prepared,
      rolls: prepared.prepared.attacks.map(() => ({ d20: 12, damageRolls: [[3]] })) })
    expect(resolved.result.ok, JSON.stringify(resolved.result)).toBe(true)
    expect(resolved.result.events.filter(event => event.type === 'attack-resolved').every(event => event.targetId === aggressor.id)).toBe(true)
  })

  it('pursues the nearest non-demon regardless of faction, ignoring a nearer demon', () => {
    const actor = summon(true)
    const current = map([actor, token('demon', 25, { y: 75, poolId: 'srd-5.1:dretch' }),
      token('near', 125), token('far', 375, { type: 'player' })])
    const plan = planDnd5eMonsterTurn(current, actor)
    expect(plan).toMatchObject({ moved: true, attacked: true, targetTokenId: 'near' })
    expect(plan.attackTargetTokenIds?.every(id => id === 'near')).toBe(true)
    // Rebuild exactly as a refreshed map does: omitted subtype must not remove
    // the uncontrolled targeting rule from the authoritative snapshot.
    const afterMove = { ...current, tokens: current.tokens.map(entry => entry.id === actor.id
      ? { ...entry, ...plan.newPosition } : entry) }
    const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'test', map: afterMove, characters: [],
      initiativeOrder: afterMove.tokens.map((entry, index) => ({ tokenId: entry.id,
        label: entry.label, emoji: '', color: '', roll: 20 - index })) })
    expect(snapshot.state.combatants[actor.id].summonedUncontrolledSubtype).toBe('demon')
    const attack = { type: 'attack' as const, actorId: actor.id, targetId: 'near',
      attackModifier: 4, d20: 12, damage: { count: 1, sides: 6, bonus: 0, rolls: [3], type: 'slashing' as const } }
    expect(resolveDnd5eHeadlessAction(snapshot.state, attack).ok).toBe(true)
    expect(resolveDnd5eHeadlessAction(snapshot.state, { ...attack, targetId: 'far' }))
      .toMatchObject({ ok: false, reason: 'invalid-target' })
    const prepared = prepareDnd5eMonsterAttack({ combatId: 'test', map: afterMove, characters: [],
      initiativeOrder: afterMove.tokens.map((entry, index) => ({ tokenId: entry.id,
        label: entry.label, emoji: '', color: '', roll: 20 - index })),
      actorTokenId: actor.id, targetTokenId: plan.targetTokenId!,
      targetTokenIds: plan.attackTargetTokenIds, actionIndex: plan.actionIndex })
    expect(prepared.ok, JSON.stringify(prepared)).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5eMonsterAttack({ prepared: prepared.prepared,
      rolls: prepared.prepared.attacks.map(() => ({ d20: 12, damageRolls: [[3]] })) })
    expect(resolved.result.ok, JSON.stringify(resolved.result)).toBe(true)
    expect(resolved.result.events.filter(event => event.type === 'attack-resolved').every(event => event.targetId === 'near')).toBe(true)
  })

  it('keeps equal-distance targets legal and re-evaluates nearest targets after moving', () => {
    const actor = summon(true)
    const current = map([actor, token('a', 125), token('b', 25, { y: 125 })])
    expect(dnd5eSummonAutomaticTargets(current, actor, [])?.targets.map(entry => entry.id)).toEqual(['a', 'b'])
    expect(dnd5eSummonAutomaticTargets(current, { ...actor, x: 75 }, [])?.targets.map(entry => entry.id)).toEqual(['a'])
  })

  it('does not use old retaliation history after control is lost', () => {
    const actor = summon(true)
    actor.dnd5eCombatState = { summonAttackerIds: ['far'] }
    const current = map([actor, token('near', 75), token('far', 225)])
    expect(dnd5eSummonAutomaticTargets(current, actor, [])?.targets.map(entry => entry.id)).toEqual(['near'])
  })

  it('uses a legal Dash to pursue a target beyond normal movement and attack reach', () => {
    const actor = summon(true)
    const current = map([actor, token('distant', 525)])
    const plan = planDnd5eMonsterTurn(current, actor)
    expect(plan).toMatchObject({ moved: true, dashed: true, attacked: false })
    expect(plan.newPosition!.x).toBeGreaterThan(actor.x)
    expect(plan.decision?.metrics?.movementFeet).toBeLessThanOrEqual(40)
  })

  it('excludes protected occupants from the nearest-target search and rejects them at attack preparation', () => {
    const actor = summon(true)
    const current = map([actor, token('protected', 75), token('outside', 175)])
    current.dnd5ePluginAreas = [{ id: 'ward', pluginId: 'test', featureId: 'circle', label: 'Ward',
      color: '', sourceCharacterId: 'owner', sourceTokenId: 'owner-token',
      createdRound: 1, expiresAfterRound: 600, cells: [{ col: 1, row: 0 }],
      blocking: { restrictedTokenIds: [actor.id], protectsOccupantsFromRestrictedTokens: true } }]
    expect(dnd5eSummonAutomaticTargets(current, actor, [])?.targets.map(entry => entry.id)).toEqual(['outside'])
    expect(prepareDnd5eMonsterAttack({ combatId: 'test', map: current, characters: [],
      initiativeOrder: [], actorTokenId: actor.id, targetTokenId: 'protected' }))
      .toMatchObject({ ok: false, reason: 'invalid-target' })
  })
})
