import { dnd5eCombatantPairKey } from './headlessCombatPrimitives'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import example from '../../../examples/community-sdk/ember.json'
import { parseDnd5eUnifiedContentBundleV1 } from './unifiedContent'
import { exportDnd5eStarMod, readDnd5eStarMod, projectDnd5eStarModRuntime } from './starModAdapter'
import { readStarModArchive, writeStarModArchive } from '../../domain/packages/starmodArchive'
import { activateDnd5ePluginSandbox, type Dnd5ePluginSandboxSession } from './pluginSandbox'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { getRegisteredContentDefinition } from '../../domain/content/contentDefinitionRegistry'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './activities/dnd5eActivityCombatAuthority'

function bundle() { return parseDnd5eUnifiedContentBundleV1(JSON.stringify(example))! }
async function scriptPackage() {
 const pkg = await readStarModArchive(await exportDnd5eStarMod(bundle()))
 pkg.manifest.script = {apiVersion:1,entry:'scripts/main.mjs'}
 pkg.manifest.permissions = [...pkg.manifest.permissions,'automation.script']
 pkg.script = readFileSync('examples/community-sdk/main.mjs','utf8')
 return pkg
}
function runWorker(source: string) {
 const messages: Array<Record<string, unknown>> = []
 let receive: ((event: {data: unknown}) => void) | undefined
 const worker = ts.transpileModule(readFileSync('src/rulesets/dnd5e/pluginSandbox.worker.ts','utf8'), {
  compilerOptions: {target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None},
 }).outputText
 runInNewContext(worker, {self:{postMessage:(m: Record<string, unknown>) => messages.push(JSON.parse(JSON.stringify(m))),addEventListener:(_type:string, fn:typeof receive) => {receive=fn}}}, {timeout:5000})
 receive!({data:{type:'init',source}})
 return messages
}
describe('community module SDK', () => {
 it('round-trips standalone conditions and resolves same-package condition references', async () => {
  const pkg = await readStarModArchive(await exportDnd5eStarMod(bundle()))
  const spell = pkg.entries.find(e => e.type === 'Spell')!
  const activity = spell.automationData!.activities![0] as {effects?: unknown[]}
  delete activity.effects
  spell.automationData!.conditionRefs = [{activityId:'ember-touch',conditionId:'ember-mark'}]
  const result = await readDnd5eStarMod(await writeStarModArchive(pkg))
  expect(result.bundle.definitions.find(e => e.kind === 'spell')?.activities?.[0].effects?.[0].id).toBe('ember-mark')
  spell.automationData!.conditionRefs = [{activityId:'ember-touch',conditionId:'ember-mark',packageId:'other.package'}]
  await expect(readDnd5eStarMod(await writeStarModArchive(pkg))).rejects.toThrow('condition-dependency-undeclared')
 })
 it('executes packaged code in the real Worker realm and commits a new spell without native spell dispatch', async () => {
  const pkg = await scriptPackage()
  const projected = await projectDnd5eStarModRuntime(await writeStarModArchive(pkg))
  const messages = runWorker(new TextDecoder().decode(projected))
  expect(messages[0], JSON.stringify(messages)).toMatchObject({type:'initialized'})
  const contributions = messages[0].contributions as Dnd5ePluginSandboxSession
  const session = {...contributions, terminate() {}} as Dnd5ePluginSandboxSession
  const dispose = registerDnd5eRulesPlugin(activateDnd5ePluginSandbox(session))
  try {
   expect(getRegisteredContentDefinition('community.ember','condition','ember-mark')).toBeDefined()
   const make = (id:string, initiative:number) => createDnd5eCombatant({id,name:id,controller:'player',initiative,
    abilities:{str:10,dex:10,con:10,int:16,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:20,maxHp:20,
    temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
   const actor=make('caster',20), target=make('target',10)
   target.controller='dm'
   actor.classSelections = {spells:['community.ember:ember-touch']}
   const state=startDnd5eHeadlessCombat('sdk-test',[actor,target])
   state.distanceFeetByCombatantPair = {[dnd5eCombatantPairKey(actor.id,target.id)]:5}
   const result=resolveRegisteredDnd5eActivityInCombatV1({state,combatRevision:1,command:{schemaVersion:1,commandId:'sdk-cast',actorId:'caster',packageId:'community.ember',packageVersion:'1.0.0',activityId:'ember-touch',targetIds:['target'],expectedRevision:1},authoritativeRolls:{'ember-damage':{values:[3]}},confirmedBy:'actor'})
   expect(result.phase,JSON.stringify(result)).toBe('commit')
   if(result.phase !== 'commit') return
   expect(result.result.ok,JSON.stringify(result.result)).toBe(true)
   if(!result.result.ok) return
   expect(result.result.state.combatants.target.currentHp).toBe(17)
   expect(result.result.state.combatants.target.conditions).toContain('community.ember.ember-mark')
   const endCaster=resolveDnd5eHeadlessAction(JSON.parse(JSON.stringify(result.result.state)),{type:'end-turn',actorId:'caster'})
   expect(endCaster.ok).toBe(true)
   const endTarget=resolveDnd5eHeadlessAction(endCaster.state,{type:'end-turn',actorId:'target'})
   expect(endTarget.ok).toBe(true)
   expect(endTarget.state.combatants.target.conditions).not.toContain('community.ember.ember-mark')
  } finally {dispose()}
  expect(getRegisteredContentDefinition('community.ember','condition','ember-mark')).toBeUndefined()
 })
 it('rejects missing script permission and script namespace forgery', async () => {
  const pkg = await scriptPackage()
  pkg.manifest.permissions = ['compendium.write','automation.register']
  await expect(writeStarModArchive(pkg)).rejects.toThrow()
  const messages = runWorker(`const plugin={manifest:${JSON.stringify(example.manifest)}, setup(api){api.registerContent({id:'forged',namespace:'srd-5.1'})}};export default plugin;`)
  expect(messages[0]).toMatchObject({type:'init-error'})
 })
})
