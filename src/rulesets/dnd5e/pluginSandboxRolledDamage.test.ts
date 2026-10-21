import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { registerDnd5eActivityPackage } from './activities/dnd5eActivityRegistry'
import { resolveDnd5ePreparedWithDamageReactions } from './damageReactionFlow'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { registerDnd5eRulesPlugin } from './pluginApi'
import type { Dnd5ePluginAction, Dnd5ePluginDiceRollDeclaration } from './pluginApi'
import type { Dnd5eSandboxCapabilityOperation } from './pluginSandbox'
import { createDnd5eCombatant, resolveDnd5eSandboxedPluginCapabilities, startDnd5eHeadlessCombat } from './headlessCombatEngine'

const manifest = { id: 'test.worker-damage', name: 'Damage', version: '1.0.0', apiVersion: 2 as const,
  rulesetId: 'dnd5e-2014-srd-5.1' as const, publisher: 'Tests', license: 'CC0-1.0' }
const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative,
  controller: id === 'actor' ? 'player' : 'dm', abilities: {str:10,dex:10,con:10,int:10,wis:10,cha:10},
  proficiencyBonus:2, armorClass:10, currentHp:30, maxHp:30, temporaryHp:0, speed:30,
  position:{x:0,y:0}, concentrating:false, pluginFeatureIds:[`${manifest.id}:blast`] })

function fixture(mode: string) {
  const declaration: Dnd5ePluginDiceRollDeclaration = {id:'damage',label:'Damage',count:1,sides:6,
    modifier:mode === 'negative' ? -6 : 0, damageType:'fire'}
  if (mode === 'untyped') delete declaration.damageType
  const perTarget = mode === 'wrong-target-pool' || mode === 'per-target'
  const dispose = registerDnd5eRulesPlugin({manifest, setup(api) {
    api.registerHeadlessAction({id:'blast',execution:'worker',
      ...(perTarget ? {perTargetRolls:[declaration]} : {rolls:[declaration]})})
    api.registerFeature({id:'blast',name:'Blast',summary:'Blast',description:'Blast',automation:'full',
      action:{id:'blast',label:'Blast',economy:'action',targeting:{kind:'multiple-creatures',relation:'enemy',maximumTargets:2}}})
  }})
  const actor=make('actor',20), a=make('a',10), b=make('b',5)
  const effect=createDnd5eMechanicalEffect({id:'mark',definitionId:'mark',label:'Mark',targetId:'a',
    source:{kind:'feature',actorId:mode === 'foreign' ? 'other' : 'actor'},modifiers:{damageRollsBySourceBonus:3}})
  if (mode === 'suspended') effect.suspendedBy=['antimagic']
  a.classState.activeEffects=[effect]
  if (mode === 'resistant') a.damageResistances=['fire']
  const state=JSON.parse(JSON.stringify(startDnd5eHeadlessCombat('damage',[actor,a,b])))
  const result={values:[mode === 'bad-die' ? 7 : 5],modifier:declaration.modifier ?? 0,
    total:5+(declaration.modifier ?? 0)}
  const action: Dnd5ePluginAction={type:'plugin',pluginId:manifest.id,actionId:'blast',featureId:`${manifest.id}:blast`,actorId:'actor',targetIds:['a','b'],
    rolls:perTarget ? {'damage:a':result,'damage:b':result} : {damage:result}}
  const operation: Dnd5eSandboxCapabilityOperation={kind:'deal-rolled-damage',targetId:'a',rollId:perTarget ? mode === 'per-target' ? 'damage:a' : 'damage:b' : mode === 'unknown' ? 'absent' : 'damage',
    multiplier:mode === 'half' || mode === 'resistant' ? 0.5 : 1}
  return {dispose,state,action,operation}
}

describe('Worker declared damage pools', () => {
  it.each([
    ['own',22],['foreign',25],['suspended',25],['half',26],['resistant',28],['negative',28],['per-target',22],
  ] as const)('settles %s with Host-owned provenance before rounding and defenses', (mode,hp) => {
    const f=fixture(mode)
    try {
      const before=JSON.stringify(f.state)
      const result=resolveDnd5eSandboxedPluginCapabilities(f.state,f.action,[f.operation,{...f.operation,targetId:'b',rollId:mode === 'per-target' ? 'damage:b' : f.operation.rollId}])
      expect(result.ok,JSON.stringify(result)).toBe(true)
      expect(result.state.combatants.a.currentHp).toBe(hp)
      expect(result.state.combatants.b.currentHp).toBe(mode === 'negative' ? 30 : mode === 'half' || mode === 'resistant' ? 28 : 25)
      expect(result.events.filter(e=>e.type === 'damage-roll-bonus-applied')).toHaveLength(['foreign','suspended'].includes(mode) ? 0 : 1)
      expect(result.state.combatants.actor.turn.actionAvailable).toBe(false)
      expect(JSON.stringify(f.state)).toBe(before)
      const replay=resolveDnd5eSandboxedPluginCapabilities(result.state,f.action,[f.operation])
      expect(replay.ok).toBe(false)
      expect(replay.state.combatants.a.currentHp).toBe(hp)
    } finally {f.dispose()}
  })
  it.each(['untyped','unknown','bad-die','wrong-target-pool','duplicate','unselected','invalid-multiplier'])('rejects %s before spending or damage', mode => {
    const f=fixture(mode)
    try {
      const ops=mode === 'duplicate' ? [f.operation,f.operation] : [mode === 'unselected' ? {...f.operation,targetId:'outside'} :
        mode === 'invalid-multiplier' ? {...f.operation,multiplier:3} as unknown as Dnd5eSandboxCapabilityOperation : f.operation]
      const before=JSON.stringify(f.state)
      const result=resolveDnd5eSandboxedPluginCapabilities(f.state,f.action,ops)
      expect(result.ok).toBe(false)
      expect(result.state.combatants.actor.turn.actionAvailable).toBe(true)
      expect(result.state.combatants.a.currentHp).toBe(30)
      expect(result.events.filter(e=>e.type === 'damage-roll-bonus-applied')).toHaveLength(0)
      expect(JSON.stringify(f.state)).toBe(before)
    } finally {f.dispose()}
  })
  it('preserves the old fixed/final-number interface without inferred roll bonuses', () => {
    const f=fixture('own')
    try {
      const result=resolveDnd5eSandboxedPluginCapabilities(f.state,f.action,[{kind:'deal-damage',targetId:'a',amount:5,damageType:'fire'}])
      expect(result.ok).toBe(true)
      expect(result.state.combatants.a.currentHp).toBe(25)
      expect(result.events.filter(e=>e.type === 'damage-roll-bonus-applied')).toHaveLength(0)
    } finally {f.dispose()}
  })
  it('executes the real Worker method and settles its serialized operation on Host', async () => {
    const messages: Array<Record<string,unknown>>=[]
    let receive: ((event:{data:unknown})=>void) | undefined
    const worker=ts.transpileModule(readFileSync('src/rulesets/dnd5e/pluginSandbox.worker.ts','utf8'),
      {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
    const vmContext={self:{postMessage:(m:Record<string,unknown>)=>messages.push(JSON.parse(JSON.stringify(m))),
      addEventListener:(_type:string,fn:typeof receive)=>{receive=fn}}}
    runInNewContext(worker,vmContext,{timeout:5000})
    const decode=runInNewContext('(text)=>JSON.parse(text)',vmContext) as (text:string)=>unknown
    receive!({data:{type:'init',source:`const plugin = {manifest:${JSON.stringify(manifest)},setup(api){
      api.registerHeadlessAction({id:'blast',rolls:[{id:'damage',label:'Damage',count:1,sides:6,damageType:'fire'}],
      resolve(ctx){ctx.dealRolledDamage('a','damage',0.5);return ctx.succeed()}})
    }}; export default plugin;`}})
    expect(messages[0],JSON.stringify(messages)).toMatchObject({type:'initialized'})
    const f=fixture('own')
    try {
      receive!({data:decode(JSON.stringify({type:'resolve',requestId:'test',action:f.action,actor:f.state.combatants.actor,
        targets:[f.state.combatants.a,f.state.combatants.b]}))})
      await new Promise(resolve=>setTimeout(resolve,0))
      const response=messages.find(m=>m.type === 'resolved')
      expect(response,JSON.stringify(messages)).toMatchObject({ok:true,operations:[{kind:'deal-rolled-damage',targetId:'a',rollId:'damage',multiplier:0.5}]})
      const result=resolveDnd5eSandboxedPluginCapabilities(f.state,f.action,response!.operations as Dnd5eSandboxCapabilityOperation[])
      expect(result.ok).toBe(true)
      expect(result.state.combatants.a.currentHp).toBe(26)
    } finally {f.dispose()}
  })
})


it.each(['own','fixed','half','resistant','decline'])('pauses Worker damage before defenses without changing roll provenance: %s', async mode => {
  const f=fixture(mode)
  const packageId='test.worker-ward'
  const reaction=registerDnd5eActivityPackage({packageId,packageVersion:'1.0.0',activities:[{
    schemaVersion:1,id:'ward',name:'Synthetic ward',legacySource:{kind:'feature',id:'ward'},
    automation:automationCapabilityFromLegacyStatus('full'),activation:{kind:'reaction'},target:{kind:'self'},
    invocation:{kind:'triggered',event:'before-damage',confirmation:'actor-choice'},
    requirements:[{kind:'damage-type',damageTypes:['fire']}],
    consumption:[{kind:'action-economy',economy:'reaction',amount:1,consumeOn:'resolve'}],
    effects:[{schemaVersion:1,id:'resistance',name:'Resistance',stacking:'replace',duration:{kind:'rounds',rounds:1,expiresAt:'source-turn-start'},
      modifiers:[{kind:'damage-resistance',damageType:'fire'}]}],
    outcomes:[{id:'ward',when:{kind:'always'},operations:[{id:'resistance',kind:'apply-effect',target:'actor',effectId:'resistance'}]}],
  }]})
  try {
    f.state.combatants.a.pluginFeatureIds.push(packageId+':ward')
    f.state.combatants.a.concentrating=true
    const original=structuredClone(f.state)
    let confirmations=0
    const operation: Dnd5eSandboxCapabilityOperation=mode==='fixed'?{kind:'deal-damage',targetId:'a',amount:5,damageType:'fire'}:f.operation
    const resolved=await resolveDnd5ePreparedWithDamageReactions({combatRevision:1,authorityUnchanged:()=>true,
      confirm:async()=>{confirmations++;return {accepted:mode!=='decline'}},roll:async()=>{throw Error('No reaction dice')}},
      {prepared:{state:f.state}},({prepared})=>({result:resolveDnd5eSandboxedPluginCapabilities(prepared.state,f.action,[operation])}))
    const result=resolved.result
    expect(result.ok,JSON.stringify(result)).toBe(true)
    expect(confirmations).toBe(1)
    const damage=mode==='decline'?8:mode==='fixed'||mode==='half'||mode==='resistant'?2:4
    expect(result.state.combatants.a.currentHp).toBe(30-damage)
    expect(result.state.combatants.a.turn.reactionAvailable).toBe(mode==='decline')
    expect(result.state.combatants.actor.turn.actionAvailable).toBe(false)
    expect(result.events.filter(event=>event.type==='concentration-check-required')).toHaveLength(1)
    expect(result.events.filter(event=>event.type==='damage-applied')).toHaveLength(1)
    expect(f.state).toEqual(original)
  } finally {reaction.dispose();f.dispose()}
})
