import {expect,it} from 'vitest'
import ts from 'typescript'
import vm from 'node:vm'
import sourceText from '../MapsWorkspacePage.tsx?raw'
import {createD20RollConfirmationInterrupt,findD20RollConfirmationByRollId,resolvedD20Value,durableD20RollId} from '../../lib/rollConfirmation'
import {assertDiceOwnership} from './diceOwnership'

/** Execute the real Maps function initializer up to its roll-ID observer. No
 * substitute business resolver or hand-written ID-selection function is used. */
function actualMapsDice(){
 const source=ts.createSourceFile('MapsWorkspacePage.tsx',sourceText,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
 const active={current:'original-parent' as string|null},continuation={current:null as string|null},cursor={current:new Map<string,number>()}
 const context:Record<string,unknown>={activeInterruptTransactionIdRef:active,secondChanceContinuationDiceParentRef:continuation,d20RollSequenceByTransactionRef:cursor,combatEndingRef:{current:false},activeMap:{id:'map'},mode:'dm',isDM:true,d20RequestCounterRef:{current:0},diceBoxRollRequestCounterRef:{current:0},MAX_DICE_POOL_COUNT:100,assertDiceOwnership,durableD20RollId,runtimeNow:()=>123,seededDieValue:()=>1,loadSharedResource:async()=>null,COMBAT_INTERRUPT_RESOURCE:'combat-interrupts',console}
 for(const name of['rollDiceBoxD20InCombat','rollDiceBoxValuesInCombat']){
  let found:ts.Expression|undefined
  const visit=(node:ts.Node)=>{if(ts.isVariableDeclaration(node)&&node.name.getText(source)===name)found=node.initializer;ts.forEachChild(node,visit)};visit(source)
  if(!found)throw Error('Actual Maps dice initializer missing: '+name)
  const compiled=ts.transpileModule('globalThis.__selected = '+found.getText(source),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
  vm.runInNewContext(compiled,context);context[name]=context.__selected
 }
 const stop={};const id=async(kind:'d20'|'pool',durable?:string)=>{let observed:string|undefined;const owner={rollerTokenId:'actor',durableRollRequestId:durable,onRollId:(value:string)=>{observed=value;throw stop}};const fn=context[kind==='d20'?'rollDiceBoxD20InCombat':'rollDiceBoxValuesInCombat']as(...args:unknown[])=>Promise<unknown>;try{await(kind==='d20'?fn('attack','target',owner):fn(1,6,'damage','target',owner))}catch(error){if(error!==stop)throw error}expect(observed).toBeTruthy();return observed!}
 return{active,continuation,cursor,id,context}
}

it('actual Maps D20 and damage consumers keep ordinary parent IDs unchanged',async()=>{
 const r=actualMapsDice();expect(await r.id('d20')).toBe(durableD20RollId({mapId:'map',sourceMode:'dm',transactionId:'original-parent',occurrenceIndex:0}));expect(await r.id('pool')).toBe(durableD20RollId({mapId:'map',sourceMode:'dm',transactionId:'original-parent',occurrenceIndex:1})+':pool:1d6');expect(r.active.current).toBe('original-parent')
})
it('actual Maps continuation dice never reuse original damage and reconstruct identical IDs after reload',async()=>{
 const before=actualMapsDice(),originalD20=await before.id('d20'),originalDamage=await before.id('pool');before.continuation.current='original-parent';before.cursor.current.set('original-parent:second-chance-continuation',0)
 const continuationD20=await before.id('d20'),continuationDamage=await before.id('pool');expect(new Set([originalD20,originalDamage,continuationD20,continuationDamage]).size).toBe(4)
 const reloaded=actualMapsDice();reloaded.continuation.current='original-parent';reloaded.cursor.current.set('original-parent:second-chance-continuation',0);const restoredD20=await reloaded.id('d20'),restoredDamage=await reloaded.id('pool');expect(restoredDamage).not.toBe(originalDamage);expect(restoredD20).toBe(continuationD20);expect(restoredDamage).toBe(continuationDamage);expect(reloaded.active.current).toBe('original-parent')
})
it('actual Maps explicit SC/critical request IDs are preserved and a previous continuation does not affect a new ordinary parent',async()=>{
 const r=actualMapsDice();r.continuation.current='original-parent';expect(await r.id('d20','second-chance:exact')).toBe('second-chance:exact');expect(await r.id('pool','incoming-critical:exact')).toBe('incoming-critical:exact');expect(r.cursor.current.size).toBe(0);r.active.current='next-parent';expect(await r.id('pool')).toBe(durableD20RollId({mapId:'map',sourceMode:'dm',transactionId:'next-parent',occurrenceIndex:0})+':pool:1d6')
})

for(const status of['done','waiting-for-dm']as const)it(`cacheless actual Maps concentration continuation reuses persisted ${status} raw rather than physical dice`,async()=>{
 const r=actualMapsDice();r.continuation.current='original-parent';const rollId=durableD20RollId({mapId:'map',sourceMode:'dm',transactionId:'original-parent:second-chance-continuation',occurrenceIndex:0}),record=createD20RollConfirmationInterrupt({mapId:'map',combatId:'combat',rollId,label:'专注·体质豁免 DC 10',originalValue:2,rollerCharacterId:'actor'});record.status=status;if(status==='done')record.response={decision:'continue',finalValue:2};let prompt:unknown;const pending=new Map<string,any>();Object.assign(r.context,{loadSharedResource:async()=>({mapId:'map',interrupts:[record]}),findD20RollConfirmationByRollId,resolvedD20Value,pendingD20ConfirmationsRef:{current:pending},setSharedRollConfirmationPrompt:(value:unknown)=>{prompt=value}});const roll=(r.context.rollDiceBoxD20InCombat as any)('专注·体质豁免 DC 10','Actor',{rollerTokenId:'actor'});if(status==='waiting-for-dm'){for(let i=0;i<5&&!pending.size;i++)await Promise.resolve();expect(prompt).toBe(record);expect(pending.size).toBe(1);pending.get(record.id).resolve({value:2})}expect(await roll).toBe(2);expect(r.cursor.current.get('original-parent:second-chance-continuation')).toBe(1)
})
