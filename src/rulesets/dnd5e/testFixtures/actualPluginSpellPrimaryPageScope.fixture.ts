import ts from 'typescript'
import { canObserveBountifulPluginSpellCompoundPrimary } from '../../../pages/maps/bountifulPluginSpellCompoundPrimaryRoom'

/** Execute Main's real inactive declaration only for an actually ineligible cast.
 * Eligible compound tests must bind their existing live Room instead. */
export function actualInactivePluginSpellPrimaryDeclaration(page: string, prepared: unknown): string {
  if (!prepared || typeof prepared !== 'object') throw Error('actual-main-primary:prepared-cast-required')
  if (canObserveBountifulPluginSpellCompoundPrimary(prepared as Parameters<typeof canObserveBountifulPluginSpellCompoundPrimary>[0])) {
    throw Error('actual-main-primary:existing-live-primary-room-required')
  }
  const tree = ts.createSourceFile('ActualMain.tsx', page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const declarations: ts.VariableDeclaration[] = []
  const producers: ts.IfStatement[] = []
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'pluginSpellCompoundPrimary') declarations.push(node)
    if (ts.isIfStatement(node) && node.expression.getText(tree) === '!spellAuthority.exploration&&!castingPrevented&&thoughtNativeResolver===resolvePreparedDnd5ePluginSpellCast&&canObserveBountifulPluginSpellCompoundPrimary(pluginCast)') producers.push(node)
    ts.forEachChild(node, visit)
  }
  visit(tree)
  if (declarations.length !== 1 || producers.length !== 1) throw Error('actual-main-primary:unique-real-declaration-and-producer-required')
  const declaration = declarations[0], statement = declaration.parent.parent, producer = producers[0]
  if (declaration.initializer || !ts.isVariableStatement(statement) || !(statement.declarationList.flags & ts.NodeFlags.Let) || statement.declarationList.declarations.length !== 1) throw Error('actual-main-primary:real-uninitialized-lifetime-required')
  let producerScope: ts.Node | undefined = producer.parent
  while (producerScope && producerScope !== statement.parent) producerScope = producerScope.parent
  if (!producerScope || statement.pos >= producer.pos || !ts.isExpressionStatement(producer.thenStatement) || !ts.isBinaryExpression(producer.thenStatement.expression)) throw Error('actual-main-primary:same-real-lifetime-required')
  const assignment = producer.thenStatement.expression
  if (assignment.left.getText(tree) !== 'pluginSpellCompoundPrimary' || assignment.operatorToken.kind !== ts.SyntaxKind.EqualsToken || !ts.isCallExpression(assignment.right) || assignment.right.expression.getText(tree) !== 'createBountifulPluginSpellCompoundPrimaryRoom') throw Error('actual-main-primary:real-room-producer-required')
  return statement.getText(tree)
}
