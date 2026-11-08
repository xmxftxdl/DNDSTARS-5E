import{it,expect,vi}from'vitest'
import ts from'typescript';import vm from'node:vm';import pageSource from'../../pages/MapsWorkspacePage.tsx?raw'
import{fixture}from'./stormFury.room.fixture'
import{createDnd5ePreparedDamageCommitSession}from'./damageCommitSession'
import{resolveDnd5ePreparedWithMaterialDamageReactions}from'./damageReactionFlow'
import{resolvePreparedDnd5eSpellCast}from'./spellAction'
import{resolvePreparedDnd5eMonsterAttack}from'./monsterAttackAction'
import{resolvePreparedDnd5eEquipmentAttack}from'./equipmentAttackAction'
import{secondChancePreparedAdapterId}from'../../pages/maps/secondChancePreparedParent'
import{previewDnd5eMountedBalance}from'./headlessCombatEngine'
vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>({roomId:'room',memberId:'host',role:'dm'})}))
it('actual Page ordinary facade dispatch preserves the true canonical Spell identity for Fury async flow',async()=>{const f=await fixture();try{
 const parsed=ts.createSourceFile('MapsWorkspacePage.tsx',pageSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let expression:ts.Expression|undefined;const visit=(node:ts.Node)=>{if(!expression&&ts.isVariableDeclaration(node)&&node.name.getText(parsed)==='resolveDnd5eFacadeWithAirborneFalls'&&node.initializer)expression=node.initializer;ts.forEachChild(node,visit)};visit(parsed);if(!expression)throw Error('actual facade bridge missing')
 let owners=0;const sandbox:any={createDnd5ePreparedDamageCommitSession,resolveDnd5ePreparedWithMaterialDamageReactions,resolvePreparedDnd5eSpellCast,resolvePreparedDnd5eMonsterAttack,resolvePreparedDnd5eEquipmentAttack,secondChancePreparedAdapterId,previewDnd5eMountedBalance,getRoomSession:()=>({roomId:'room',memberId:'host',role:'dm'}),activeInterruptTransactionIdRef:{current:f.input.transactionId},damageReactionOptionsForMap:()=>({enableStormFuryHit:true,replayEventBatchId:f.input.transactionId,combatRevision:1,authorityUnchanged:()=>true,confirm:async()=>{throw Error('unexpected Activity')},roll:async()=>{throw Error('unexpected dice')},chooseStormFuryOwner:async()=>{owners++;return undefined}})}
 vm.runInNewContext(ts.transpileModule('globalThis.facade='+expression.getText(parsed),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,sandbox)
 const result=await sandbox.facade(resolvePreparedDnd5eSpellCast,f.input,f.input.prepared.map);expect(result.result.ok).toBe(true);expect(owners).toBe(1)
 }finally{await f.close()}})
