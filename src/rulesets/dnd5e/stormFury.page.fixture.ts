import*as targetOriginalDice from'./spellTargetOriginalSavingDiceRoute'
import ts from'typescript'
import vm from'node:vm'
import mapsSource from'../../pages/MapsWorkspacePage.tsx?raw'
import*as fury from'./stormFurySavingDiceRoute'
import*as damageZero from'./bountifulDamageZeroDiceDispatch'
import*as sequence from'./bountifulOpportunitySequenceSource'
import*as settlement from'./bountifulOpportunitySettlementDice'
import{readBountifulNativeDiceRoute}from'./bountifulHostOperation'
import*as thought from'../../pages/maps/mastermindThoughtDiceTransport'
import*as spellWindow from'../../pages/maps/mastermindSpellWindowDiceTransport'
import*as sc from'../../pages/maps/scBasePrefixDiceTransport'
import*as arcane from'../../pages/maps/arcaneMovementDiceTransport'
import*as arcaneBase from'../../pages/maps/arcaneBasePrefixDiceTransport'
import*as initiative from'../../pages/maps/activityDeathInitiative'
import*as armor from'../../pages/maps/armorNativeRoomUI'
import*as activityOriginal from'../../pages/maps/bountifulActivityOriginalRaw'
import{lockSecondChanceRawForHostConfirmation}from'../../lib/secondChanceClientCommands'
import{submitSharedArmorNativeRaw}from'../../lib/sharedApi'
import{createDmDiceModeSelection,dmAdoptedDie,dmConfirmedFaces,dmDiceModes}from'../../presentation/maps/dmDiceMode'
import{assertDiceOwnership,isDiceCharacterOwnedByCurrentDm,isDiceCharacterControlledByRemotePlayer}from'../../pages/maps/diceOwnership'
export function actualFuryPageDice(bindings:Record<string,unknown>){
 const sandbox:any={...targetOriginalDice,...fury,...damageZero,...sequence,...settlement,readBountifulNativeDiceRoute,...thought,...spellWindow,...sc,...arcane,...arcaneBase,...initiative,...armor,...activityOriginal,lockSecondChanceRawForHostConfirmation,submitSharedArmorNativeRaw,createDmDiceModeSelection,dmAdoptedDie,dmConfirmedFaces,dmDiceModes,assertDiceOwnership,isDiceCharacterOwnedByCurrentDm,isDiceCharacterControlledByRemotePlayer,...bindings}
 const parsed=ts.createSourceFile('MapsWorkspacePage.tsx',mapsSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
 for(const[name,property]of[['confirmDmDice','confirm'],['rollDiceBoxValuesInCombat','pool']]){let value:ts.Expression|undefined;const visit=(n:ts.Node)=>{if(!value&&ts.isVariableDeclaration(n)&&n.name.getText(parsed)===name&&n.initializer)value=n.initializer;ts.forEachChild(n,visit)};visit(parsed);if(!value)throw Error('actual Page dice function missing:'+name);vm.runInNewContext(ts.transpileModule('globalThis.'+property+'='+value.getText(parsed),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,sandbox)}
 sandbox.confirmDmDice=sandbox.confirm
 return{pool:sandbox.pool as(count:number,sides:number,label:string,targetName:string,options:unknown)=>Promise<number[]>,confirm:sandbox.confirm,sandbox}
}
