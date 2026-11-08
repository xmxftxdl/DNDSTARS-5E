import ts from 'typescript'

/** This unit substitutes runPluginOriginal and executes only Main's outer tail.
 * Its rooms retain Main's real uninitialized declarations: neither producer runs.
 * A real worker/Native test must instead bind its own same-cast live rooms. */
export function actualPluginSpellDispatchLifetime(page: string): string {
  const tree = ts.createSourceFile('ActualMain.tsx', page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const names = ['pluginSpellCompoundPrimary', 'pluginSpellCompoundBurst'] as const
  const declarations = new Map<string, ts.VariableDeclaration[]>()
  const assignments = new Map<string, ts.BinaryExpression[]>()
  const workers: ts.VariableDeclaration[] = []
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node)) {
      const name = node.name.getText(tree)
      if (names.some(value => value === name)) declarations.set(name, [...declarations.get(name) ?? [], node])
      if (name === 'runPluginOriginal') workers.push(node)
    }
    if (ts.isBinaryExpression(node) && names.some(value => value === node.left.getText(tree)) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) assignments.set(node.left.getText(tree), [...assignments.get(node.left.getText(tree)) ?? [], node])
    if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) && (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken) && names.some(value => value === node.operand.getText(tree))) throw Error('actual-dispatch:unexpected-room-mutation')
    ts.forEachChild(node, visit)
  }
  visit(tree)
  if (workers.length !== 1 || !workers[0].initializer || !ts.isArrowFunction(workers[0].initializer) || !ts.isBlock(workers[0].initializer.body)) throw Error('actual-dispatch:unique-real-worker-required')
  const worker = workers[0], body = (worker.initializer as ts.ArrowFunction).body
  const within = (node: ts.Node, ancestor: ts.Node) => { for (let current: ts.Node | undefined = node; current; current = current.parent) if (current === ancestor) return true; return false }
  const statements = names.map(name => {
    const list = declarations.get(name), writes = assignments.get(name)
    if (list?.length !== 1 || writes?.length !== 1) throw Error('actual-dispatch:unique-real-room-lifetime-required:' + name)
    const declaration = list[0], statement = declaration.parent.parent, assignment = writes[0]
    if (declaration.initializer || !ts.isVariableStatement(statement) || !(statement.declarationList.flags & ts.NodeFlags.Let) || statement.declarationList.declarations.length !== 1 || statement.parent !== worker.parent.parent.parent || statement.pos >= worker.pos) throw Error('actual-dispatch:real-outer-uninitialized-let-required:' + name)
    if (!within(assignment, body) || assignment.operatorToken.kind !== ts.SyntaxKind.EqualsToken || !ts.isCallExpression(assignment.right)) throw Error('actual-dispatch:worker-only-room-producer-required:' + name)
    const factory = name === 'pluginSpellCompoundPrimary' ? 'createBountifulPluginSpellCompoundPrimaryRoom' : 'createBountifulPluginSpellCompoundBurstRoom'
    if (assignment.right.expression.getText(tree) !== factory) throw Error('actual-dispatch:real-room-factory-required:' + name)
    const guard = assignment.parent.parent
    if (name === 'pluginSpellCompoundPrimary') {
      if (!ts.isIfStatement(guard) || guard.expression.getText(tree) !== '!spellAuthority.exploration&&!castingPrevented&&thoughtNativeResolver===resolvePreparedDnd5ePluginSpellCast&&canObserveBountifulPluginSpellCompoundPrimary(pluginCast)' || guard.thenStatement !== assignment.parent) throw Error('actual-dispatch:real-primary-eligibility-gate-required')
    } else {
      if (!ts.isBlock(guard) || !ts.isIfStatement(guard.parent) || guard.parent.expression.getText(tree) !== 'pluginSpellCompoundPrimary' || guard.parent.thenStatement !== guard) throw Error('actual-dispatch:burst-requires-real-primary-required')
    }
    return statement
  })
  return statements.sort((a, b) => a.pos - b.pos).map(statement => statement.getText(tree)).join('\n')
}
