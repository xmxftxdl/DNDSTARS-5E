import{it,expect}from'vitest'
import fs from'node:fs'
import ts from'typescript'
import{readLegacyDnd5eStarMod}from'./starModAdapter'
import{dnd5eRoomRuntimeProjectionV2,dnd5eRulesPluginFromContentPackageV2}from'./contentPackageV2'
import{registerDnd5eRulesPlugin}from'./pluginApi'
import{decodeSecondChanceParentWire,encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone'
import{createBountifulPluginSpellCompoundPrimaryRoom}from'../../pages/maps/bountifulPluginSpellCompoundPrimaryRoom'
import{verifyBountifulPluginSpellCompoundPageSource}from'../../pages/maps/bountifulPluginSpellSavingInitialEntry'
import type{resolvePreparedDnd5ePluginSpellCast}from'./pluginSpellTransaction'
import type{BountifulPluginSpellCompoundPrimaryBook}from'../../ports/dnd5ePluginSpellCompoundPrimaryTransport'
import page from'../../pages/MapsWorkspacePage?raw'
type Source=Parameters<typeof resolvePreparedDnd5ePluginSpellCast>[0]
const dir='.codex-temp/xge-next-feature/bountiful-luck/bountiful-plugin-spell-compound-answered-page-preview-source-r363-r1/sealed-r1',signature=(v:unknown)=>JSON.stringify(encodeSecondChanceParentWire(v))
function actualLateField(text:string){const ast=ts.createSourceFile('ActualMain.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),found:ts.ObjectLiteralExpression[]=[];function visit(n:ts.Node){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='preparedPluginSpellRolls'&&n.initializer&&ts.isObjectLiteralExpression(n.initializer))found.push(n.initializer);ts.forEachChild(n,visit)}visit(ast);expect(found).toHaveLength(1);const fields=found[0].properties.filter(n=>(ts.isShorthandPropertyAssignment(n)||ts.isPropertyAssignment(n))&&n.name.getText(ast)==='spellcastingSavingThrows');expect(fields).toHaveLength(1);const code=ts.transpileModule('const actual={'+fields[0].getText(ast)+'}',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;return(raw:unknown,primary:unknown)=>Function('spellcastingSavingThrows','pluginSpellCompoundPrimary',code+';return actual.spellcastingSavingThrows;')(raw,primary)as unknown}
it('actual late Main casting carrier projects only a compound-owned genuine plain empty list and preserves the exact completed Page source guard',async()=>{
 const packageBytes=fs.readFileSync('.codex-temp/xge-next-feature/bountiful-luck/bountiful-plugin-spell-compound-answered-page-preview-source-r363-r1/sealed-r1/auxiliary/single557.starmod'),legacy=await readLegacyDnd5eStarMod(new Uint8Array(packageBytes).buffer);if(!legacy)throw Error('Actual same single557 required');const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(dnd5eRoomRuntimeProjectionV2(legacy.package)))
 const book=JSON.parse(fs.readFileSync(dir+'/evidence/actual-preview-primary-book.json','utf8'))as BountifulPluginSpellCompoundPrimaryBook,bookSource=decodeSecondChanceParentWire(book.source)as Source,primary=createBountifulPluginSpellCompoundPrimaryRoom({source:bookSource,load:async()=>structuredClone(book),gateway:{publishEvent:async()=>{throw Error('No new original publication')}},roll:async()=>{throw Error('No new physical original')}})
 try{
  expect(primary.preserveEmptyIntent(bookSource.prepared)).toBe(true)
  const pair=JSON.parse(fs.readFileSync(dir+'/evidence/actual-preview-pair-r1.json','utf8'))as{actual:string;protected:string},actual=decodeSecondChanceParentWire(JSON.parse(pair.actual))as Source,original=decodeSecondChanceParentWire(JSON.parse(pair.protected))as Source
  expect(signature(actual)).toBe(pair.actual);expect(signature(original)).toBe(pair.protected);expect(actual.prepared.action.id).toBe(book.parentId);expect(Object.hasOwn(original.rolls!,'spellcastingSavingThrows')).toBe(true);expect(original.rolls!.spellcastingSavingThrows).toBeUndefined()
  const raw=actual.rolls!.spellcastingSavingThrows;expect(Array.isArray(raw)).toBe(true);expect(Object.getPrototypeOf(raw)).toBe(Array.prototype);expect(Reflect.ownKeys(raw as object)).toEqual(['length']);expect(raw).toEqual([])
  const before=actualLateField(fs.readFileSync(dir+'/evidence/before-Main.tsx','utf8')),after=actualLateField(page)
  const candidate=(field:ReturnType<typeof actualLateField>,value:unknown,scope:unknown)=>{const source=cloneDnd5eHostTransactionInput(actual);source.rolls!.spellcastingSavingThrows=field(value,scope)as NonNullable<Source['rolls']>['spellcastingSavingThrows'];return source}
  const old=candidate(before,raw,primary);expect(signature(old)).toBe(pair.actual);expect(()=>verifyBountifulPluginSpellCompoundPageSource(old,original)).toThrow('plugin-spell-saving-entry:changed-page-operation')
  const fixed=candidate(after,raw,primary)
  // An old product reaches exactly the actual Page guard here. No replacement
  // verifier, synthetic success, or diagnostic-only source edit is accepted.
  const accepted=verifyBountifulPluginSpellCompoundPageSource(fixed,original)
  expect(signature(fixed)).toBe(pair.protected);expect(signature(accepted)).toBe(pair.protected)
  const unscoped=candidate(after,raw,undefined);expect(unscoped.rolls!.spellcastingSavingThrows).toBe(raw);expect(()=>verifyBountifulPluginSpellCompoundPageSource(unscoped,original)).toThrow('plugin-spell-saving-entry:changed-page-operation')
  const decorated:unknown[]=[];Object.defineProperty(decorated,'unissued',{value:1,enumerable:true});const symbol:unknown[]=[];Object.defineProperty(symbol,Symbol('unissued'),{value:1});const subclass:unknown[]=[];Object.setPrototypeOf(subclass,Object.create(Array.prototype))
  for(const value of[[1],{unissued:true},null,decorated,symbol,subclass]){const refused=candidate(after,value,primary);expect(refused.rolls!.spellcastingSavingThrows).toBe(value);expect(()=>verifyBountifulPluginSpellCompoundPageSource(refused,original)).toThrow('plugin-spell-saving-entry:changed-page-operation')}
  const absent=candidate(after,undefined,primary);expect(absent.rolls!.spellcastingSavingThrows).toBeUndefined();expect(signature(verifyBountifulPluginSpellCompoundPageSource(absent,original))).toBe(pair.protected)
  fs.writeFileSync(dir+'/evidence/actual-late-main-proof-r1.json',JSON.stringify({genuineMainLateInitializerFieldAst:true,genuinePrimaryRoom:true,actualPairIndices:[126,127],oldActualGuardRefused:true,newCompleteWireByteExact:true,actualExportVerifierPassed:true,ordinaryScopeFalseRefused:true,nonemptyUnknownDecoratedSymbolSubclassPreservedAndRefused:true,noNewRollOrWorld:true},null,2))
 }finally{primary.close();dispose()}
},180000)
