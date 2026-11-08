import*as areaBoundary from'../../../pages/maps/persistentAreaTurnBoundary'
import fs from'node:fs'
import ts from'typescript'
import*as engine from'../headlessCombatEngine'
import*as begin from'../beginTurnAction'
import*as equipment from'../equipmentAttackAction'
import*as spell from'../spellAction'
import*as monster from'../monsterAttackAction'
import*as settlement from'../../../pages/maps/settleDnd5eCombatResult'
import{getRoomSession}from'../../../lib/roomSession'
import{readBrowserSceneWorldMinute}from'../../../composition/browserSceneClock'
import{collectBountifulDeathAreaOriginalForPage}from'../../../pages/maps/bountifulDeathAreaOriginalCollector'
export function actualDeathAreaPageContext(bindings:Record<string,unknown>){
 const file=process.env.XGE_ARCANE_PAGE_SOURCE;if(!file)throw Error('Exact actual Page source required');const source=ts.createSourceFile('ActualPage.tsx',fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),variables=new Map<string,ts.VariableDeclaration>();const visit=(n:ts.Node)=>{if(ts.isVariableDeclaration(n)&&n.initializer)variables.set(n.name.getText(source),n);ts.forEachChild(n,visit)};visit(source)
 const scope:Record<string,any>={...engine,...begin,...equipment,...spell,...monster,...settlement,...areaBoundary,getRoomSession,readBrowserSceneWorldMinute,collectBountifulDeathAreaOriginalForPage,...bindings}
 const evaluate=(text:string)=>{const code=ts.transpileModule('const actual='+text+';',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;return new Function(...Object.keys(scope),code+'return actual')(...Object.values(scope))}
 const initializer=(name:string)=>{const n=variables.get(name);if(!n?.initializer)throw Error('Actual Page declaration missing:'+name);return n.initializer.getText(source)}
 for(const name of ['createDnd5eBoundaryCounterCollector','rollDnd5eTurnStartGazes','rollDnd5eTurnStartPeriodicDamage','rollDnd5eMonsterMechanics','rollPreparedDnd5eBeginTurn','resolveDnd5eFacadeWithAirborneFalls','settleDnd5eBeginTurn'])scope[name]=evaluate(initializer(name))
 const finisher=variables.get('finishBountifulDeathOriginal')?.initializer;if(!finisher||!ts.isArrowFunction(finisher)||!ts.isBlock(finisher.body))throw Error('Actual Death finisher required');const attempt=finisher.body.statements.find(ts.isTryStatement),advanced=attempt?.tryBlock.statements.find(ts.isIfStatement);if(!advanced||advanced.expression.getText(source)!=='advanced')throw Error('Actual advanced Death branch required')
 const apply=finisher.body.statements.filter(ts.isVariableStatement).flatMap(n=>[...n.declarationList.declarations]).find(n=>n.name.getText(source)==='apply')?.initializer;if(!apply)throw Error('Actual Death apply closure required')
 return{sourceText:source.text,scope,gateway:()=>evaluate(initializer('deathGateway')),run:()=>{scope.apply=evaluate(apply.getText(source));return evaluate('async()=>{let transition;'+attempt!.getText(source)+';return transition}')()as Promise<unknown>}}
}
