import{it,expect}from'vitest'
import page from'/src/pages/MapsWorkspacePage.tsx?raw'
import ts from'typescript'
it('actual Host D20 waiting policy preserves all real D20 kinds and excludes generic damage/other pools',()=>{
 const file=ts.createSourceFile('MapsWorkspacePage.tsx',page,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let request:ts.ArrowFunction|undefined,condition:ts.Expression|undefined
 function find(node:ts.Node){if(ts.isVariableDeclaration(node)&&node.name.getText(file)==='requestPlayerDiceRoll'&&node.initializer&&ts.isArrowFunction(node.initializer))request=node.initializer;ts.forEachChild(node,find)}find(file);if(!request)throw Error('Actual requestPlayerDiceRoll required')
 function scan(node:ts.Node){if(ts.isIfStatement(node)&&ts.isExpressionStatement(node.thenStatement)&&ts.isCallExpression(node.thenStatement.expression)&&node.thenStatement.expression.expression.getText(file)==='setPendingHostPlayerD20Roll')condition=node.expression;ts.forEachChild(node,scan)}scan(request);if(!condition)throw Error('Actual Host D20 wait condition required')
 const policy=new Function('input','return '+condition.getText(file))as(input:{rollKind?:string})=>boolean
 for(const rollKind of['attack','saving-throw','ability-check'])expect(policy({rollKind})).toBe(true)
 for(const rollKind of['damage','other',undefined])expect(policy({rollKind})).toBe(false)
})
