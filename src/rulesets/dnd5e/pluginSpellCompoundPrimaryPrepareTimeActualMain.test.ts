import{it,expect,vi}from'vitest'
import fs from'node:fs'
import{createHash}from'node:crypto'
import ts from'typescript'
import{readLegacyDnd5eStarMod}from'./starModAdapter'
import{dnd5eRoomRuntimeProjectionV2,encodeDnd5eContentPackageV2,dnd5eRulesPluginFromContentPackageV2}from'./contentPackageV2'
import{registerDnd5eRulesPlugin,dnd5ePluginSpellDefinition}from'./pluginApi'
import{restoreDnd5eEffectiveRulesContextForCombat}from'./effectiveRulesContext'
import{prepareDnd5eRandomTargetPluginSpellCast}from'./randomPluginSpellTargets'
import{decodeSecondChanceParentWire,encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import*as sessions from'../../lib/roomSession'
import{getRoomRulesSnapshot,setRoomRulesSnapshot}from'../../lib/roomRulesState'
import{setMapGeometryRuntime}from'../../lib/mapGeometry'
import{readBountifulPluginSpellCompoundPrimaryPrepareTime}from'../../pages/maps/bountifulPluginSpellCompoundPrimaryPrepareTime'
import{createBountifulPluginSpellCompoundPrimaryRoom,BountifulPluginSpellCompoundPrimaryPending}from'../../pages/maps/bountifulPluginSpellCompoundPrimaryRoom'
import{dnd5eSpellAuthorityResolutionContext}from'../../pages/maps/spellSettlementCoordinator'
import type{resolvePreparedDnd5ePluginSpellCast}from'./pluginSpellTransaction'
import type{BountifulPluginSpellCompoundPrimaryBook}from'../../ports/dnd5ePluginSpellCompoundPrimaryTransport'
import page from'../../pages/MapsWorkspacePage?raw'

const dir='.codex-temp/xge-next-feature/bountiful-luck/bountiful-plugin-spell-compound-primary-prepare-time-r361-r1/sealed-r1',base='.codex-temp/xge-next-feature/bountiful-luck/bountiful-plugin-spell-compound-primary-prepare-time-r361-r1/sealed-r1/baseline/'
const json=(name:string)=>JSON.parse(fs.readFileSync(dir+'/evidence/'+name+'.json','utf8'))
type Source=Parameters<typeof resolvePreparedDnd5ePluginSpellCast>[0]
const signature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value))
function bind<T>(expression:string,scope:Record<string,unknown>):T{const js=ts.transpileModule('const value='+expression,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;return Function(...Object.keys(scope),js+';return value;')(...Object.values(scope))as T}
function actualPrepareNodes(text:string){
 const ast=ts.createSourceFile('ActualMain.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),inputs:ts.Node[]=[],retained:ts.Node[]=[]
 function visit(n:ts.Node){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='prepareDnd5eRandomTargetPluginSpellCast'&&n.arguments[0]?.getText(ast).includes('pluginAuthorityAction'))inputs.push(n.arguments[0]);if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='retainedPrimaryPrepareTime'&&n.initializer)retained.push(n.initializer);ts.forEachChild(n,visit)}visit(ast);expect(inputs).toHaveLength(1);expect(retained.length).toBeLessThanOrEqual(1);return{input:inputs[0].getText(ast),retained:retained[0]?.getText(ast)}
}

it('actual pending-reload Main prepares current live inputs at protected original transaction time while preserving strict source and refusing foreign clocks',async()=>{
 const archive=fs.readFileSync('.codex-temp/xge-next-feature/bountiful-luck/bountiful-plugin-spell-compound-primary-prepare-time-r361-r1/sealed-r1/auxiliary/single557.starmod'),parsed=await readLegacyDnd5eStarMod(new Uint8Array(archive).buffer);if(!parsed)throw Error('Actual single557 import required')
 const projected=dnd5eRoomRuntimeProjectionV2(parsed.package),integrity='sha256-'+createHash('sha256').update(new Uint8Array(encodeDnd5eContentPackageV2(projected))).digest('base64')
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(projected),{integrity})
 const book=json('actual-primary-book')as BountifulPluginSpellCompoundPrimaryBook,host=json('actual-host-membership'),combat=json('actual-combat'),campaign=json('actual-campaign-time'),captures=json('actual-two-source-signatures').captures
 const current=decodeSecondChanceParentWire(JSON.parse(captures[0].text))as Source,original=decodeSecondChanceParentWire(JSON.parse(captures[1].text))as Source
 const session={roomId:host.roomId,roomName:host.roomName,rulesetId:host.rulesetId,createdAt:host.createdAt,...host.member}as ReturnType<typeof sessions.getRoomSession>
 const sessionSpy=vi.spyOn(sessions,'getRoomSession').mockReturnValue(session),previousRules=getRoomRulesSnapshot()
 setRoomRulesSnapshot(json('actual-room-rules-snapshot'));setMapGeometryRuntime(json('actual-map-geometry').maps)
 try{
  const old=actualPrepareNodes(fs.readFileSync(base+'src/pages/MapsWorkspacePage.tsx','utf8')),fixed=actualPrepareNodes(page)
  expect(old.retained).toBeUndefined();expect(fixed.retained).toBeDefined();expect(current.prepared.action.id).toBe(original.prepared.action.id)
  expect(current.now).toBe(original.now);expect(current.prepared.transaction.createdAt).not.toBe(original.prepared.transaction.createdAt)
  expect(original.prepared.transaction.createdAt).not.toBe(original.now)
  const pluginSpell=dnd5ePluginSpellDefinition(current.prepared.spell.id);if(!pluginSpell)throw Error('Actual projected spell definition required')
  expect(integrity).toBe(combat.effectiveRules.requiredPlugins.find((entry:{id:string})=>entry.id===projected.manifest.id)?.integrity);expect(signature(pluginSpell)).toBe(signature(current.prepared.spell));restoreDnd5eEffectiveRulesContextForCombat(combat.combatId,combat.effectiveRules)
  let liveMaps=current.currentRoom!.maps,liveCharacters=current.currentRoom!.characters
  const inputIdentity={action:current.prepared.action,mapId:current.prepared.map.id,spell:pluginSpell}
  const load=vi.fn(async()=>structuredClone(book))
  expect(await readBountifulPluginSpellCompoundPrimaryPrepareTime(inputIdentity,load)).toBe(original.prepared.transaction.createdAt)
  const makeScope=()=>{
   const authorityMap=liveMaps.find(map=>map.id===current.prepared.map.id);if(!authorityMap)throw Error('Actual live map required')
   const authority=dnd5eSpellAuthorityResolutionContext({combatActive:combat.active,combatId:combat.combatId,map:authorityMap,actorTokenId:current.prepared.actorToken.id,initiativeOrder:combat.initiativeOrder,turnEconomy:combat.dnd5eTurnEconomyByToken[current.prepared.actorToken.id],turnEconomyByToken:combat.dnd5eTurnEconomyByToken})
   return{castingSession:undefined,action:current.prepared.action,pluginAuthorityAction:current.prepared.action,pluginSpell,authorityMap,liveRound:combat.round,spellInitiativeOrder:authority.initiativeOrder,turnEconomy:authority.turnEconomy,turnEconomyByToken:authority.turnEconomyByToken,roomSession:session,effectiveRulesRef:{current:combat.effectiveRules},useMapStore:{getState:()=>({maps:liveMaps})},useCharacterStore:{getState:()=>({characters:liveCharacters})},readBrowserSceneWorldMinute:()=>campaign.worldMinute,runtimeNow:()=>current.prepared.transaction.createdAt,selectRandomCreatureTarget:()=>{throw Error('No original target re-selection allowed')},randomDieValue:()=>{throw Error('No caller random target dice allowed')},readBountifulPluginSpellCompoundPrimaryPrepareTime,loadBountifulPluginSpellCompoundPrimarySource:load}
  }
  const prepare=async(nodes:ReturnType<typeof actualPrepareNodes>,loader:Parameters<typeof readBountifulPluginSpellCompoundPrimaryPrepareTime>[1]=load)=>{
   const scope:Record<string,unknown>={...makeScope(),loadBountifulPluginSpellCompoundPrimarySource:loader}
   if(nodes.retained)scope.retainedPrimaryPrepareTime=await bind<()=>Promise<number|undefined>>('async()=>('+nodes.retained+')',scope)()
   const args=await bind<()=>Promise<Parameters<typeof prepareDnd5eRandomTargetPluginSpellCast>[0]>>('async()=>('+nodes.input+')',scope)()
   const result=prepareDnd5eRandomTargetPluginSpellCast(args);if(!result.ok)throw Error('Actual live prepare failed:'+result.reason)
   return{args,prepared:result.prepared}
  }
  const before=await prepare(old),after=await prepare(fixed)
  expect(before.args.now).toBe(current.prepared.transaction.createdAt);expect(before.prepared.transaction.createdAt).toBe(current.prepared.transaction.createdAt)
  expect(after.args.now).toBe(original.prepared.transaction.createdAt);expect(after.prepared.transaction.createdAt).toBe(original.prepared.transaction.createdAt);expect(after.prepared.transaction.updatedAt).toBe(original.prepared.transaction.updatedAt)
  expect(after.prepared).not.toBe(original.prepared);expect(after.prepared).not.toBe(current.prepared);expect(signature(after.prepared.transaction)).toBe(signature(original.prepared.transaction))
  const sourceFor=(prepared:Source['prepared']):Source=>({...current,prepared,currentRoom:{maps:liveMaps,characters:liveCharacters},now:book.effectTimestamp,rolls:{activityRolls:{[book.rows[0].rollId]:{values:[...book.rows[0].confirmed!.values],modifier:0,total:book.rows[0].confirmed!.values.reduce((a,b)=>a+b,0)}}}})
  const scope=sourceFor(before.prepared),room=createBountifulPluginSpellCompoundPrimaryRoom({source:scope,load:async()=>structuredClone(book),gateway:{publishEvent:async()=>{throw Error('Clock boundary cannot publish')}},roll:async()=>{throw Error('Already protected original cannot start again')}})
  try{await expect(room.qualify(sourceFor(before.prepared),0)).rejects.toThrow('changed-page-non-dice-source')}finally{room.close()}
  const baseSignature=(s:Source)=>signature({...s,rolls:undefined})
  fs.writeFileSync(dir+'/evidence/clock-live-prepare-source-diagnostic.json',JSON.stringify({actual:encodeSecondChanceParentWire({...sourceFor(after.prepared),rolls:undefined}),expected:encodeSecondChanceParentWire({...original,now:book.effectTimestamp,rolls:undefined})}))
  expect(baseSignature(sourceFor(after.prepared))).toBe(baseSignature({...original,now:book.effectTimestamp}))
  const afterSource=sourceFor(after.prepared),afterRoom=createBountifulPluginSpellCompoundPrimaryRoom({source:afterSource,load:async()=>structuredClone(book),gateway:{publishEvent:async()=>{throw Error('Clock recovery boundary may not publish')}},roll:async()=>{throw Error('Protected original may not start again')}})
  try{let pending:unknown;try{await afterRoom.qualify(afterSource,0)}catch(error){pending=error}expect(pending).toBeInstanceOf(BountifulPluginSpellCompoundPrimaryPending);if(!(pending instanceof BountifulPluginSpellCompoundPrimaryPending))throw Error('Actual restored Native B0 pending required');expect(pending.stage.status).toBe('pending-ally-natural-one');expect(pending.stage.occurrence).toBe(0);expect(pending.stage.request).toMatchObject({kind:'attack',actorId:after.prepared.actorToken.id,originalRolls:[1]});expect(pending.stage.request.nativeLucky).toBeUndefined()}finally{afterRoom.close()}

  const loadingMutation=async()=>{liveCharacters=liveCharacters.map(character=>character.id===current.prepared.actor.id?{...character,abilities:{...character.abilities,int:character.abilities.int+2}}:character);return structuredClone(book)}
  const changed=await prepare(fixed,loadingMutation)
  expect(changed.prepared.actor.abilities.int).toBe(current.prepared.actor.abilities.int+2)
  const changedSource=sourceFor(changed.prepared),changedRoom=createBountifulPluginSpellCompoundPrimaryRoom({source:changedSource,load:async()=>structuredClone(book),gateway:{publishEvent:async()=>{throw Error('Changed live source cannot publish')}},roll:async()=>{throw Error('No new original')}})
  try{await expect(changedRoom.qualify(changedSource,0)).rejects.toThrow('changed-page-non-dice-source')}finally{changedRoom.close()}
  liveCharacters=current.currentRoom!.characters
  const changedBooks=[(b:any)=>{b.hostMemberId+='-foreign'},(b:any)=>{b.roomId+='-foreign'},(b:any)=>{b.parentId+='-foreign'},(b:any)=>{const source=decodeSecondChanceParentWire(b.source)as Source;source.prepared.transaction.updatedAt++;b.source=encodeSecondChanceParentWire(source)},(b:any)=>{const source=decodeSecondChanceParentWire(b.source)as Source;source.prepared.transaction.actorId+='-foreign';b.source=encodeSecondChanceParentWire(source)},(b:any)=>{const source=decodeSecondChanceParentWire(b.source)as Source;source.prepared.transaction.rollLedger.entries.push({foreignClock:true}as never);b.source=encodeSecondChanceParentWire(source)}]
  for(const change of changedBooks){const altered=structuredClone(book);change(altered);await expect(readBountifulPluginSpellCompoundPrimaryPrepareTime(inputIdentity,async()=>altered)).rejects.toThrow('exact-private-prepare-transaction-required')}
  sessionSpy.mockReturnValue({...session!,role:'player'}as NonNullable<typeof session>);const forbidden=vi.fn(async()=>book);await expect(readBountifulPluginSpellCompoundPrimaryPrepareTime(inputIdentity,forbidden)).rejects.toThrow('private-prepare-host-required');expect(forbidden).not.toHaveBeenCalled();sessionSpy.mockReturnValue(session)
  const switching=async()=>{sessionSpy.mockReturnValue({...session!,memberId:session!.memberId+'-other'});return book};await expect(readBountifulPluginSpellCompoundPrimaryPrepareTime(inputIdentity,switching)).rejects.toThrow();sessionSpy.mockReturnValue(session)
  await expect(readBountifulPluginSpellCompoundPrimaryPrepareTime(inputIdentity,async()=>{throw Error('ice-knife-primary:current-private-primary-required')})).resolves.toBeUndefined()
  await expect(readBountifulPluginSpellCompoundPrimaryPrepareTime(inputIdentity,async()=>{throw Error('forbidden-private-source')})).rejects.toThrow('forbidden-private-source')
  fs.writeFileSync(dir+'/evidence/actual-main-clock-proof-r1.json',JSON.stringify({genuineMainPrepareAst:true,genuineLiveFactory:true,oldCreatedAt:before.prepared.transaction.createdAt,savedCreatedAt:after.prepared.transaction.createdAt,originalEffectTimestamp:book.effectTimestamp,oldStrictSourceRefused:true,newCompleteBaseSignatureExact:true,genuineRestoredNativeB0Pending:true,liveCharactersReadAfterPrivateAwait:true,changedLiveActorStillStrictlyRefused:true,foreignAndChangedSessionRefused:true,noWorldPublication:true},null,2))
 }finally{setRoomRulesSnapshot(previousRules);setMapGeometryRuntime([]);sessionSpy.mockRestore();dispose()}
},180000)
