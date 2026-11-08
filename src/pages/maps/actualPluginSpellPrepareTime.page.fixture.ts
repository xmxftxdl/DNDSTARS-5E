import ts from 'typescript'
import vm from 'node:vm'
import type { BattleMap } from '../../store/maps'
import { readBountifulPluginSpellCompoundPrimaryPrepareTime } from './bountifulPluginSpellCompoundPrimaryPrepareTime'

type ClockInput = Parameters<typeof readBountifulPluginSpellCompoundPrimaryPrepareTime>[0]
type Loader = Parameters<typeof readBountifulPluginSpellCompoundPrimaryPrepareTime>[1]

/** Execute the actual Main predecessor with the same canonical cast and real
 * transport. Eligibility and any retained clock come only from the real helper. */
export async function readActualPluginSpellPrimaryPrepareTime(page: string, input: {
  action: ClockInput['action']; map: BattleMap; spell: ClockInput['spell']; castingSession?: unknown
}, load: Loader): Promise<number | undefined> {
  const tree = ts.createSourceFile('ActualMain.tsx', page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const clocks: ts.VariableDeclaration[] = [], preparations: ts.VariableDeclaration[] = []
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'retainedPrimaryPrepareTime') clocks.push(node)
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'preparedPluginSpell') preparations.push(node)
    ts.forEachChild(node, visit)
  }
  visit(tree)
  if (clocks.length !== 1 || preparations.length !== 1) throw Error('actual-main-prepare-time:unique-real-predecessor-required')
  const clock = clocks[0], prepared = preparations[0]
  if (!clock.initializer || !prepared.initializer || clock.parent.parent.parent !== prepared.parent.parent.parent || clock.pos >= prepared.pos || !prepared.initializer.getText(tree).includes('retainedPrimaryPrepareTime??runtimeNow()')) throw Error('actual-main-prepare-time:same-real-preparation-lifetime-required')
  const code = ts.transpileModule('(async()=>(' + clock.initializer.getText(tree) + '))()', { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  return await vm.runInNewContext(code, {
    castingSession: input.castingSession, pluginAuthorityAction: input.action,
    authorityMap: input.map, pluginSpell: input.spell,
    readBountifulPluginSpellCompoundPrimaryPrepareTime,
    loadBountifulPluginSpellCompoundPrimarySource: load,
  })
}
