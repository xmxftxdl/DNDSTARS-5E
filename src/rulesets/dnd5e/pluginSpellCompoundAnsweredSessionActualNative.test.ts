import{it,expect}from'vitest'
import fs from'node:fs'
import{createHash}from'node:crypto'
import{readLegacyDnd5eStarMod}from'./starModAdapter'
import{dnd5eRoomRuntimeProjectionV2,encodeDnd5eContentPackageV2,dnd5eRulesPluginFromContentPackageV2}from'./contentPackageV2'
import{registerDnd5eRulesPlugin}from'./pluginApi'
import{restoreDnd5eEffectiveRulesContextForCombat}from'./effectiveRulesContext'
import{decodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone'
import{createDnd5ePluginSpellCompoundPrimaryAnsweredCollector}from'./pluginSpellCompoundPrimaryAnswered'
import{captureDnd5ePluginSpellCompoundPrimaryAnsweredQualification}from'./pluginSpellCompoundPrimaryAnsweredQualification'
import{captureDnd5ePluginSpellCompoundAnsweredPrimaryQualification,createDnd5ePluginSpellCompoundQualifiedSource,dnd5ePluginSpellCompoundQualifiedResolver,projectDnd5ePluginSpellCompoundQualifiedReplay}from'./pluginSpellCompoundQualification'
import{createDnd5ePluginSpellSavingOriginalCollector}from'./pluginSpellSavingOriginalOperation'
import{createDnd5eAllyOriginalCollectionSession,createDnd5ePreparedDamageCommitSession}from'./damageCommitSession'
import{withActivitySavingOriginalMissing,readActivitySavingOriginalMissing}from'./activities/activitySavingOriginalMissing'
import{decisionFromBountifulOriginalDieReceipt,type BountifulOriginalDieReceipt}from'./bountifulLuckReceipt'
import{originalD20ReplaySourceKey}from'./allyNaturalOneCheckpoint'
import*as Native from'./pluginSpellCompoundNative'
import type{BountifulPluginSpellCompoundPrimaryBook}from'../../ports/dnd5ePluginSpellCompoundPrimaryTransport'
import type{resolvePreparedDnd5ePluginSpellCast}from'./pluginSpellTransaction'
type Source=Parameters<typeof resolvePreparedDnd5ePluginSpellCast>[0]
const dir='.codex-temp/xge-next-feature/bountiful-luck/bountiful-plugin-spell-compound-answered-combined-source-r362-r1/sealed-r2'
const json=(side:string,file:string)=>JSON.parse(fs.readFileSync(dir+'/evidence/'+side+'/'+file+'.json','utf8'))
it('actual mounted answered issuer preserves complete source graph in both real replay sessions and reaches the first Saving original while refusing foreign authority',async()=>{
 const bytes=fs.readFileSync('.codex-temp/xge-next-feature/bountiful-luck/bountiful-plugin-spell-compound-answered-combined-source-r362-r1/sealed-r2/auxiliary/single557.starmod'),legacy=await readLegacyDnd5eStarMod(new Uint8Array(bytes).buffer);if(!legacy)throw Error('Same genuine single557 required')
 const projected=dnd5eRoomRuntimeProjectionV2(legacy.package),integrity='sha256-'+createHash('sha256').update(new Uint8Array(encodeDnd5eContentPackageV2(projected))).digest('base64'),dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(projected),{integrity}),workers:ReturnType<typeof createDnd5ePluginSpellCompoundPrimaryAnsweredCollector>[]=[]
 try{
  const genuine=(side:string)=>{
   const book=json(side,'actual-primary-book')as BountifulPluginSpellCompoundPrimaryBook,receipt=json(side,'actual-primary-b-parent')as BountifulOriginalDieReceipt,combat=json(side,'actual-combat'),raw=json(side,'actual-d10-event-34'),adopted=json(side,'actual-d10-event-35')
   expect(combat.effectiveRules.requiredPlugins[0].integrity).toBe(integrity);restoreDnd5eEffectiveRulesContextForCombat(combat.combatId,combat.effectiveRules)
   expect(receipt.identity.parentId).toBe(book.parentId);expect(raw.status).toBe(200);expect(adopted.status).toBe(200);expect(adopted.payload).toMatchObject({count:1,sides:10,delivery:'broadcast-result',rollerTokenId:book.rows[0].actorId});expect(raw.payload.requestId).toContain('1d10')
   const original=decodeSecondChanceParentWire(book.source)as Source,row=book.rows[0],source:Source={...original,now:book.effectTimestamp,rolls:{activityRolls:{[row.rollId]:{values:[...row.confirmed!.values],modifier:0,total:row.confirmed!.values.reduce((a,b)=>a+b,0)}}}},worker=createDnd5ePluginSpellCompoundPrimaryAnsweredCollector(source);workers.push(worker)
   let stage=worker.run();expect(stage.status).toBe('pending-ally-natural-one');if(stage.status!=='pending-ally-natural-one')throw Error('Real B0 required');expect(stage.occurrence).toBe(0);expect(stage.request).toEqual(receipt.request)
   const decision=decisionFromBountifulOriginalDieReceipt(receipt,stage.request);if(!decision)throw Error('Real mounted B-use receipt required');const option=stage.request.options.find(o=>o.ownerId===decision.ownerId&&o.featureId===decision.featureId);expect(option).toBeDefined();stage=worker.answer(stage,option,decision.replacement)
   expect(stage.status).toBe('missing-primary-effect-original');if(stage.status!=='missing-primary-effect-original')throw Error('True main D10 required');expect(stage.request.rolls).toHaveLength(1);expect(stage.request.rolls[0]).toMatchObject({count:1,sides:10});stage=worker.supplyEffect(stage,stage.request.rolls[0].rollId,adopted.payload.values)
   expect(stage.status).toBe('original-d20-ready');if(stage.status!=='original-d20-ready')throw Error('Genuine answered Ready required')
   const answered=captureDnd5ePluginSpellCompoundPrimaryAnsweredQualification(worker.ready(stage),book,[receipt]),primary=captureDnd5ePluginSpellCompoundAnsweredPrimaryQualification(answered),qualified=createDnd5ePluginSpellCompoundQualifiedSource(primary,1),resolve=dnd5ePluginSpellCompoundQualifiedResolver(qualified.qualification),p=qualified.source.prepared
   const native=projectDnd5ePluginSpellCompoundQualifiedReplay(qualified.qualification,{...qualified.source,hostOriginalD20Replay:{parentId:p.action.id,sourceKey:originalD20ReplaySourceKey(p.action.id,p.state,p.action,book.effectTimestamp),effectTimestamp:book.effectTimestamp,facts:[]}})
   return{book,worker,qualified,resolve,native}
  }
  const actual=genuine('mounted')
  // This is the exact real collector used by the mounted Burst Room. An old
  // product fails at unchanged-combined-non-dice-source-required here.
  const saving=createDnd5ePluginSpellSavingOriginalCollector(actual.qualified.source)
  try{const stage=saving.run();expect(stage.status).toBe('missing-activity-saving-original');if(stage.status!=='missing-activity-saving-original')throw Error('First real Saving original required');expect(stage.request.actorId).toBe(actual.qualified.source.compound.descriptor.command.targetIds[0]);expect(stage.request.activityId).toBe(actual.qualified.source.compound.activity.id);expect(()=>saving.operation(stage)).not.toThrow()}finally{saving.cancel()}
  const damage=createDnd5ePreparedDamageCommitSession(actual.native,actual.resolve,()=>false)
  try{let error:unknown;try{withActivitySavingOriginalMissing(()=>damage.run(actual.native.prepared.state))}catch(value){error=value}const missing=readActivitySavingOriginalMissing(error);expect(missing).toBeDefined();expect(missing!.actorId).toBe(actual.qualified.source.compound.descriptor.command.targetIds[0])}finally{damage.cancel()}
  const wrapper=(input:typeof actual.native)=>actual.resolve(input),ordinary=createDnd5eAllyOriginalCollectionSession(actual.native,wrapper)
  try{expect(()=>withActivitySavingOriginalMissing(()=>ordinary.run(actual.native.prepared.state))).toThrow('ice-knife-primary-answered-q:unchanged-combined-non-dice-source-required')}finally{ordinary.cancel()}
  expect(typeof Native.dnd5ePluginSpellCompoundAnsweredReplaySessionInput).toBe('function')
  const changed=cloneDnd5eHostTransactionInput(actual.native.prepared.state);changed.round++
  expect(()=>Native.dnd5ePluginSpellCompoundAnsweredReplaySessionInput(actual.resolve,actual.native,changed)).toThrow('exact-answered-session-baseline-required')
  expect(Native.dnd5ePluginSpellCompoundAnsweredReplaySessionInput(wrapper,actual.native,changed)).toBeUndefined()
  expect(Native.dnd5ePluginSpellCompoundAnsweredReplaySessionInput(actual.resolve.bind(null),actual.native,actual.native.prepared.state)).toBeUndefined()
  const changedSource=cloneDnd5eHostTransactionInput(actual.native);changedSource.prepared.actor.abilities.int++
  expect(()=>Native.dnd5ePluginSpellCompoundAnsweredReplaySessionInput(actual.resolve,changedSource,changedSource.prepared.state)).toThrow('unchanged-combined-non-dice-source-required')
  const changedPrefix=cloneDnd5eHostTransactionInput(actual.native);changedPrefix.hostOriginalD20Replay.facts=[]
  expect(()=>Native.dnd5ePluginSpellCompoundAnsweredReplaySessionInput(actual.resolve,changedPrefix,changedPrefix.prepared.state)).toThrow('actual-session-attack-prefix-required')
  expect(()=>Native.dnd5ePluginSpellCompoundAnsweredResolver({}as never)).toThrow()
  const foreign=genuine('observer');expect(foreign.book.parentId).not.toBe(actual.book.parentId)
  expect(()=>Native.dnd5ePluginSpellCompoundAnsweredReplaySessionInput(foreign.resolve,actual.native,actual.native.prepared.state)).toThrow('unchanged-combined-non-dice-source-required')
  expect(()=>Native.dnd5ePluginSpellCompoundAnsweredReplaySessionInput(actual.resolve,foreign.native,foreign.native.prepared.state)).toThrow('unchanged-combined-non-dice-source-required')
  actual.worker.close();expect(()=>Native.dnd5ePluginSpellCompoundAnsweredReplaySessionInput(actual.resolve,actual.native,actual.native.prepared.state)).toThrow('current-source-required')
  fs.writeFileSync(dir+'/evidence/actual-issuer-proof-r1.json',JSON.stringify({realMountedPrimaryBook:true,actualB17Receipt:true,actualD10RawAndHostPreserved:true,twoRealReplaySessionsFirstSaving:true,plainWrapperStillOriginalGuardRefused:true,fullStateAndSourceAndPrefixRefused:true,secondGenuineForeignQRefused:true,closedSourceRefused:true,noWorldPublication:true},null,2))
 }finally{for(const worker of workers)worker.close();dispose()}
},180000)
