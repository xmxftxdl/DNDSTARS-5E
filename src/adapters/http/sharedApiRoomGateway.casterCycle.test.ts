import{it,expect}from'vitest';import ts from'typescript';import path from'node:path';import{spawnSync}from'node:child_process';
import raw0 from"../../lib/sharedApi.ts?raw";
import raw1 from"../../lib/sharedResourceValidation.ts?raw";
import raw2 from"../../rulesets/dnd5e/shops.ts?raw";
import raw3 from"../../rulesets/dnd5e/items.ts?raw";
import raw4 from"../../rulesets/dnd5e/inventoryHealing.ts?raw";
import raw5 from"../../rulesets/dnd5e/headlessCombatEngine.ts?raw";
import raw6 from"../../rulesets/dnd5e/allyNaturalOneCheckpoint.ts?raw";
import raw7 from"../../rulesets/dnd5e/bountifulHostOperation.ts?raw";
import raw8 from"../../rulesets/dnd5e/opportunityMoveAction.ts?raw";
import raw9 from"../../rulesets/dnd5e/opportunityMovePrefix.ts?raw";
import raw10 from"../../pages/maps/combatApplicationStoreProjection.ts?raw";
import raw11 from"../../store/maps.ts?raw";
import raw12 from"../../composition/browserSharedRoomResources.ts?raw";
import raw13 from"../../composition/browserSharedRoomService.ts?raw";
import raw14 from"./sharedApiRoomGateway.ts?raw";
const ids=["src/lib/sharedApi.ts","src/lib/sharedResourceValidation.ts","src/rulesets/dnd5e/shops.ts","src/rulesets/dnd5e/items.ts","src/rulesets/dnd5e/inventoryHealing.ts","src/rulesets/dnd5e/headlessCombatEngine.ts","src/rulesets/dnd5e/allyNaturalOneCheckpoint.ts","src/rulesets/dnd5e/bountifulHostOperation.ts","src/rulesets/dnd5e/opportunityMoveAction.ts","src/rulesets/dnd5e/opportunityMovePrefix.ts","src/pages/maps/combatApplicationStoreProjection.ts","src/store/maps.ts","src/composition/browserSharedRoomResources.ts","src/composition/browserSharedRoomService.ts","src/adapters/http/sharedApiRoomGateway.ts"],sources=[raw0,raw1,raw2,raw3,raw4,raw5,raw6,raw7,raw8,raw9,raw10,raw11,raw12,raw13,raw14];
it('actual caster gateway properties load across the current synchronous source cycle using native ESM deferred access',()=>{
 const names=['loadSpellcastingOriginalPreparation','requestSharedSpellcastingOriginalSaving'],api=ids.indexOf('src/lib/sharedApi.ts'),adapter=ids.indexOf('src/adapters/http/sharedApiRoomGateway.ts'),tree=ts.createSourceFile('api.ts',sources[api],ts.ScriptTarget.Latest,true),declarations:string[]=[];
 for(let i=0;i<ids.length;i++){const t=ts.createSourceFile(ids[i],sources[i],ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),next=ids[(i+1)%ids.length];expect(t.statements.some(n=>ts.isImportDeclaration(n)&&n.importClause?.isTypeOnly!==true&&ts.isStringLiteral(n.moduleSpecifier)&&path.posix.normalize(path.posix.join(path.posix.dirname(ids[i]),n.moduleSpecifier.text)).replace(/\.tsx?$/,'')===next.replace(/\.tsx?$/,'')),ids[i]+' -> '+next).toBe(true)}
 for(const n of tree.statements){if(ts.isFunctionDeclaration(n)&&n.name&&[...names,'readSpellcastingOriginalPreparationBook'].includes(n.name.text))declarations.push(n.getText(tree));if(ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>names.includes(d.name.getText(tree))))declarations.push(n.getText(tree))}expect(declarations).toHaveLength(3);
 const at=ts.createSourceFile('adapter.ts',sources[adapter],ts.ScriptTarget.Latest,true),properties:string[]=[];for(const n of at.statements)if(ts.isVariableStatement(n))for(const d of n.declarationList.declarations)if(d.name.getText(at)==='sharedApiRoomGateway'&&d.initializer&&ts.isObjectLiteralExpression(d.initializer))for(const p of d.initializer.properties)if(names.includes(p.name?.getText(at)??'')){expect(ts.isPropertyAssignment(p)&&ts.isArrowFunction(p.initializer)).toBe(true);properties.push(p.getText(at))}expect(properties).toHaveLength(2);
 const code=ids.map((_id,i)=>{let c='import '+JSON.stringify(ids[(i+1)%ids.length])+';';if(i===api)c+=declarations.join('\n');if(i===adapter)c='import{'+names.join(',')+'}from'+JSON.stringify(ids[api])+';export const sharedApiRoomGateway={'+properties.join(',')+'}';return ts.transpileModule(c,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText});
 // Actual critical declarations and static cycle edges; unrelated bodies are
 // projected away. This is module initialization, never an authorization mock.
 const script='import vm from "node:vm";const ids='+JSON.stringify(ids)+',code='+JSON.stringify(code)+',names='+JSON.stringify(names)+';const context=vm.createContext({}),modules=new Map(ids.map((id,i)=>[id,new vm.SourceTextModule(code[i],{context,identifier:id})]));const root=modules.get(ids[0]);await root.link(n=>modules.get(n));await root.evaluate();console.log(JSON.stringify(names.map(n=>({name:n,type:typeof modules.get('+JSON.stringify(ids[adapter])+').namespace.sharedApiRoomGateway[n]}))));';const result=spawnSync(process.execPath,['--experimental-vm-modules','--input-type=module'],{input:script,encoding:'utf8',timeout:15000});expect(result.status,result.stderr).toBe(0);expect(JSON.parse(result.stdout.trim())).toEqual(names.map(name=>({name,type:'function'})));
});
