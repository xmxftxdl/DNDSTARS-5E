import{isMastermindSpellWindowNativeDispatch}from'./mastermindSpellWindowNativeDispatch'
import ts from'typescript'
import actualPage from'../MapsWorkspacePage.tsx?raw'
const source=ts.createSourceFile('MapsWorkspacePage.tsx',actualPage,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
/** Execute the actual Page entry node. No copy of its authorization or source
 * construction is substituted by this fixture. */
export async function invokeActualNativeSpellWindowEntry(scope:Record<string,unknown>,args:unknown[]){
 const declarations:ts.VariableDeclaration[]=[];function visit(node:ts.Node){if(ts.isVariableDeclaration(node)&&node.name.getText(source)==='startMastermindNativeSpellWindow')declarations.push(node);ts.forEachChild(node,visit)}visit(source)
 if(declarations.length!==1)throw Error('Unique actual Host spell-window Page entry required')
 let statement:ts.Node=declarations[0];while(!ts.isVariableStatement(statement)){if(!statement.parent)throw Error('Actual Page statement required');statement=statement.parent}
 scope={readMastermindSpellWindowNativeCompletion:async()=>false,isMastermindSpellWindowNativeDispatch,activeInterruptTransactionIdRef:{current:null},...scope};const names=Object.keys(scope),text=ts.transpileModule(statement.getText(source),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
 return new Function(...names,'actualArgs',text+';return startMastermindNativeSpellWindow(...actualArgs)')(...names.map(name=>scope[name]),args)
}
