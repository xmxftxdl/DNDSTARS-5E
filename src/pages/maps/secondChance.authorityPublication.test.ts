import{bountifulMonsterZeroCombatRenderPending}from'../../rulesets/dnd5e/bountifulMonsterZeroCombatRender'
import{expect,it,vi}from'vitest'
import ts from'typescript'
import vm from'node:vm'
import mapsSource from'../MapsWorkspacePage.tsx?raw'
import{CombatController}from'../../application/combat/CombatController'
import{SharedRoomService}from'../../application/rooms/SharedRoomService'
import{createNativeEnvelopeApi}from'./secondChanceNativeApiTestHelper'
import{realSecondChancePublicationFixtures}from'./secondChancePublicationFixture.testHelper'
const originals=realSecondChancePublicationFixtures()
function snapshot(f:any){return Object.fromEntries(f.committed.writes.map((row:any)=>[row.name,{...row.data,_sync:{schemaVersion:1,revision:f.committedRevisions[row.name]??row.expectedRevision+1,writerId:'original-http-host',writtenAt:1}}]))}
function actualMapsFunction(name:string,sandbox:Record<string,unknown>){const parsed=ts.createSourceFile('MapsWorkspacePage.tsx',mapsSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let expression:ts.Expression|undefined;const visit=(node:ts.Node)=>{if(!expression&&ts.isVariableDeclaration(node)&&node.name.getText(parsed)===name&&node.initializer)expression=node.initializer;ts.forEachChild(node,visit)};visit(parsed);if(!expression)throw Error('Maps initializer missing:'+name);vm.runInNewContext(ts.transpileModule('globalThis.actual='+expression.getText(parsed),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,sandbox);return(sandbox as any).actual}
for(const f of originals)for(const route of['atomic','single-put']as const){
 it(`actual ${f.nativeAdapter} consumed parent survives real Maps saveAuthorityCombatState through ${route} with public fields updated and no HP/cost replay`,async()=>{
  const docs=snapshot(f),api=await createNativeEnvelopeApi(docs),plain=f.plainSave.writes.find((row:any)=>row.name==='combat').data,before=await api.read('combat'),chars=await api.read('characters'),maps=await api.read('maps'),save=vi.fn(async(name:string,data:any)=>{const current=await api.read(name),response=route==='atomic'?await api.post('transaction',{transactionId:f.plainSave.transactionId,writes:[{name,data,expectedRevision:current._sync.revision}]}):await api.post(name,{...data,_sync:current._sync},'dm','PUT');expect(response.status,JSON.stringify(response)).toBe(200)})
  const rooms=new SharedRoomService({loadResource:api.read,saveResource:save}as never),controller=new CombatController(rooms),publicNext={...plain,round:plain.round+1},sandbox:any={bountifulMonsterZeroCombatRenderPending,monsterZeroOriginalRef:{current:null},activeInterruptTransactionIdRef:{current:null},mode:'dm',activeMap:{id:plain.mapId},combatActiveRef:{current:publicNext.active},locallyEndedCombatIdRef:{current:''},combatIdRef:{current:publicNext.combatId},roundRef:{current:publicNext.round},initiativeIndexRef:{current:publicNext.initiativeIndex},initiativeOrderRef:{current:publicNext.initiativeOrder},settlementModeRef:{current:publicNext.settlementMode},monsterControlRef:{current:publicNext.monsterControl},combatFlowPauseRef:{current:publicNext.flowPause},dnd5eTurnEconomyByTokenRef:{current:publicNext.dnd5eTurnEconomyByToken},effectiveRulesRef:{current:publicNext.effectiveRules},runtimeNow:()=>publicNext.updatedAt,combatPublishSeqRef:{current:0},combatPublicationCommitRef:{current:Promise.resolve()},saveAuthorityCombatState:controller.saveAuthorityState}
  sandbox.buildSharedCombatState=actualMapsFunction('buildSharedCombatState',sandbox);const publish=actualMapsFunction('publishCombatState',sandbox);await publish()
  expect(save).toHaveBeenCalledTimes(1);const after=await api.read('combat');expect(after.secondChanceAttacks).toEqual(before.secondChanceAttacks);expect(after.round).toBe(publicNext.round);expect(after.dnd5eTurnEconomyByToken).toEqual(publicNext.dnd5eTurnEconomyByToken);expect(after.updatedAt).toBe(publicNext.updatedAt);expect(after._sync.revision).toBe(before._sync.revision+1);expect(await api.read('characters')).toEqual(chars);expect(await api.read('maps')).toEqual(maps)
 })
}
for(const route of['atomic','single-put']as const)it.each(['empty','partial','null','new-map','new-combat','explicit-progress','stale']as const)(`protected current receipt ${route}: %s remains strict`,async mode=>{
 const docs=snapshot(originals[0]),other=Object.values(snapshot(originals[1]).combat.secondChanceAttacks)[0]as any;docs.combat.secondChanceAttacks[other.attack.id]=other;const api=await createNativeEnvelopeApi(docs),before=await api.read('combat'),characters=await api.read('characters'),incoming=structuredClone(before);incoming.updatedAt++
 if(mode==='empty')incoming.secondChanceAttacks={}
 if(mode==='partial')delete incoming.secondChanceAttacks[other.attack.id]
 if(mode==='null')incoming.secondChanceAttacks=null
 if(mode==='new-map'){incoming.mapId='new-map';incoming.secondChanceAttacks={}}
 if(mode==='new-combat'){incoming.combatId='new-combat';incoming.secondChanceAttacks={}}
 if(mode==='explicit-progress'){const key=Object.keys(incoming.secondChanceAttacks)[0];incoming.secondChanceAttacks[key].processedRequestIds=[...(incoming.secondChanceAttacks[key].processedRequestIds??[]),'real-host-progress'];}
 if(mode==='stale'){delete incoming.secondChanceAttacks;incoming._sync.revision--}
 const response=route==='atomic'?await api.post('transaction',{transactionId:'retention-'+route+'-'+mode,writes:[{name:'combat',expectedRevision:incoming._sync.revision,data:incoming}]}):await api.post('combat',incoming,'dm','PUT')
 const success=['new-map','new-combat','explicit-progress'].includes(mode);expect(response.status,JSON.stringify(response)).toBe(success?200:mode==='null'?422:409);const after=await api.read('combat')
 if(!success)expect(after).toEqual(before);else{expect(after.secondChanceAttacks).toEqual(incoming.secondChanceAttacks);expect(after._sync.revision).toBe(before._sync.revision+1)}expect(await api.read('characters')).toEqual(characters)
})
it.each(['undefined','empty-string']as const)('inactive same scene keeps server-private receipts across omitted/empty combat ids (%s)',async mode=>{
 const docs=snapshot(originals[0]);docs.combat.active=false;delete docs.combat.combatId;const api=await createNativeEnvelopeApi(docs),before=await api.read('combat'),next={...before,combatId:mode==='empty-string'?'':undefined,updatedAt:2};delete next.secondChanceAttacks;const response=await api.post('transaction',{transactionId:'scene-retention-'+mode,writes:[{name:'combat',expectedRevision:before._sync.revision,data:next}]});expect(response.status,JSON.stringify(response)).toBe(200);expect((await api.read('combat')).secondChanceAttacks).toEqual(before.secondChanceAttacks)
})

it('real authenticated undo of a public-only combat publication retains the terminal original receipt',async()=>{
 const f=originals[0],docs=snapshot(f),api=await createNativeEnvelopeApi(docs),before=await api.read('combat'),next={...before,round:before.round+1,updatedAt:before.updatedAt+1};delete next.secondChanceAttacks
 const written=await api.post('transaction',{transactionId:'public-state-following-original-consumed',writes:[{name:'combat',expectedRevision:before._sync.revision,data:next}]});expect(written.status,JSON.stringify(written)).toBe(200)
 const undo=await api.post('../dm/undo',{transactionId:'public-state-following-original-consumed'});expect(undo.status,JSON.stringify(undo)).toBe(200);const after=await api.read('combat');expect(after.secondChanceAttacks).toEqual(before.secondChanceAttacks);expect(after.round).toBe(before.round);expect((await api.read('characters')).characters).toEqual(docs.characters.characters)
})
