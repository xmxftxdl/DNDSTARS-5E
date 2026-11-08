import { actualPluginSpellDispatchLifetime } from './actualPluginSpellDispatchLifetime.fixture'
import source from '../MapsWorkspacePage.tsx?raw'
import vm from'node:vm'
import ts from'typescript'
import{expect,it,vi}from'vitest'
const ast=ts.createSourceFile('actual-page.tsx',source,99,true,4)
function actualTail(){let tail:string|undefined;const isProtected=(statement:ts.Statement)=>ts.isIfStatement(statement)&&statement.expression.getText(ast)==='thoughtOriginal'||ts.isTryStatement(statement)&&statement.tryBlock.statements.some(child=>ts.isIfStatement(child)&&child.expression.getText(ast)==='thoughtOriginal');function visit(node:ts.Node){if(ts.isBlock(node)&&node.statements.some(s=>ts.isVariableStatement(s)&&s.declarationList.declarations.some(d=>d.name.getText(ast)==='thoughtOriginal'))){const branch=node.statements.findIndex(isProtected);if(branch<0)throw Error('Actual protected dispatch not found');if(tail!==undefined)throw Error('Multiple actual protected plugin branches');tail=node.statements.slice(branch).map(s=>s.getText(ast)).join('\n')}ts.forEachChild(node,visit)}visit(ast);if(!tail)throw Error('Actual plugin branch tail not found');return actualPluginSpellDispatchLifetime(source)+'\n'+tail}
it.each(['deny','allow','ordinary']as const)('actual Page %s plugin completion exits its outer spell dispatcher and cannot overwrite the accepted original ACK',async mode=>{
 const dispose=vi.fn(async()=>{});let ack='pending';const worker=vi.fn(async()=>{ack='accepted';return{kind:'actual-original-worker-completed'}}),coreFallback=vi.fn(()=>{ack='rejected:spell-definition-unavailable';throw Error('Unexpected core spell fallback after plugin completed')}),token=mode==='ordinary'?undefined:Object.freeze({}),body='(async()=>{'+actualTail()+';coreFallback()})()'
 const js=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
 await vm.runInNewContext(js,{initialPluginSpellEntry:{dispose},pluginSpellSavingCollector:undefined,thoughtOriginal:token,thoughtGateway:{},runPluginOriginal:worker,coreFallback,waitMastermindThoughtOwnerAnswer:async()=>({row:{answer:{choice:mode==='deny'?'deny':'allow-real-thoughts'}}}),withMastermindThoughtProduction:async(original:object,prefix:undefined,gateway:object,run:()=>Promise<unknown>)=>{expect(original).toBe(token);expect(prefix).toBeUndefined();expect(gateway).toEqual({});return run()},Promise})
 expect(worker).toHaveBeenCalledTimes(1);expect(coreFallback).not.toHaveBeenCalled();expect(ack).toBe('accepted');expect(dispose).toHaveBeenCalledTimes(1)
})
