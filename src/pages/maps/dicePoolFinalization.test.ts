import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { expect, it } from 'vitest'

it('routes checkpoint, delegated and animated dice pools through the same reroll finalizer', () => {
  const source = ts.createSourceFile('MapsWorkspacePage.tsx', readFileSync('src/pages/MapsWorkspacePage.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let pool: ts.ArrowFunction | undefined
  function find(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'rollDiceBoxValuesInCombat' && node.initializer && ts.isArrowFunction(node.initializer)) pool = node.initializer
    ts.forEachChild(node, find)
  }
  find(source)
  expect(pool).toBeDefined()
  const returns: string[] = []
  function collect(node: ts.Node) {
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)) return
    if (ts.isReturnStatement(node)) returns.push(node.expression?.getText(source) ?? '')
    ts.forEachChild(node, collect)
  }
  collect(pool!.body)
  // The single-d20 path delegates to its own confirmation pipeline; all pool
  // paths must finalize, including an already confirmed durable checkpoint.
  expect(returns.filter(value => value === 'delegated')).toHaveLength(1)
  expect(returns.filter(value => value.startsWith('finalizeDicePool('))).toHaveLength(3)
  expect(returns).toHaveLength(4)
})
