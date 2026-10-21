import ts from 'typescript'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// Read-only AST inventory. This identifies integration sites, not behavior support.
const files = [
  'src/rulesets/dnd5e/headlessCombatEngine.ts',
  'src/rulesets/dnd5e/activities/dnd5eActivityExecutor.ts',
  'src/rulesets/dnd5e/activities/dnd5eActivityRollRecipe.ts',
  'src/rulesets/dnd5e/equipmentAttackAction.ts',
  'src/rulesets/dnd5e/monsterAttackAction.ts',
  'src/rulesets/dnd5e/opportunityAttackAction.ts',
  'src/rulesets/dnd5e/hunterMultiattackAction.ts',
]
const entries = []
for (const file of files) {
  const text = await readFile(file, 'utf8')
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  function enclosingFunction(node) {
    for (let current = node.parent; current; current = current.parent) {
      if (ts.isFunctionDeclaration(current) && current.name) return current.name.text
      if (ts.isVariableDeclaration(current) && current.initializer &&
        (ts.isArrowFunction(current.initializer) || ts.isFunctionExpression(current.initializer))) return current.name.getText(source)
    }
    return '<module>'
  }
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'resolveDnd5eAttackOutcome') {
      const arg = node.arguments[0]
      const fields = arg && ts.isObjectLiteralExpression(arg) ? Object.fromEntries(arg.properties.flatMap(property => {
        if (ts.isPropertyAssignment(property)) return [[property.name.getText(source), property.initializer.getText(source)]]
        if (ts.isShorthandPropertyAssignment(property)) return [[property.name.text, property.name.text]]
        return []
      })) : { expression: arg?.getText(source) }
      entries.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        function: enclosingFunction(node), kind: 'native-outcome-call', fields })
    }
    if (ts.isPropertyAccessExpression(node) && node.name.text === 'criticalThreshold' && file.endsWith('dnd5eActivityExecutor.ts')) {
      entries.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        function: enclosingFunction(node), kind: 'activity-threshold-read', expression: node.getText(source) })
    }
    if (ts.isPropertyAccessExpression(node) && node.name.text === 'criticalThreshold' &&
      !file.endsWith('headlessCombatEngine.ts') && !file.endsWith('dnd5eActivityExecutor.ts')) {
      entries.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        function: enclosingFunction(node), kind: 'preparation-threshold-read', expression: node.getText(source) })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}
const report = { schemaVersion: 1, behaviorVerified: false, apiCalls: 0,
  note: 'AST inventory only. Each threshold consumer and its redirected/rechecked targets needs behavior verification before a target-linked modifier is certified.',
  counts: { nativeCalls: entries.filter(row => row.kind === 'native-outcome-call').length,
    activityThresholdReads: entries.filter(row => row.kind === 'activity-threshold-read').length,
    preparationThresholdReads: entries.filter(row => row.kind === 'preparation-threshold-read').length }, entries }
const outputIndex = process.argv.indexOf('--output')
if (outputIndex >= 0) {
  if (!process.argv[outputIndex + 1]) throw Error('Missing --output path')
  await writeFile(resolve(process.argv[outputIndex + 1]), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' })
}
console.log(JSON.stringify(report, null, 2))
