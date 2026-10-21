import ts from 'typescript'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// Inventory, not an automation certificate: a roll may be healing or backlash,
// and damage may be supplied through an imported resolver rather than rolled here.
const file = 'src/rulesets/dnd5e/headlessCombatEngine.ts'
const text = await readFile(file, 'utf8')
const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
const names = new Set(['rules.resolveDamage', 'damageOrHealing', 'applyDamage',
  'resolveDnd5eSavingThrowSpellDamage', 'dnd5eTargetDamageRollBonus'])
const entries = []
function owner(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isFunctionDeclaration(parent) && parent.name) return parent.name.text
    if (ts.isVariableDeclaration(parent) && parent.initializer &&
      (ts.isArrowFunction(parent.initializer) || ts.isFunctionExpression(parent.initializer))) return parent.name.getText(source)
  }
  return '<module>'
}
function visit(node) {
  if (ts.isCallExpression(node) && names.has(node.expression.getText(source))) {
    const argument = node.arguments[0]
    const bonus = argument && ts.isObjectLiteralExpression(argument)
      ? argument.properties.find(property => ts.isPropertyAssignment(property) && property.name.getText(source) === 'bonus')
      : undefined
    entries.push({ function: owner(node), line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      call: node.expression.getText(source), ...(bonus ? { bonus: bonus.initializer.getText(source) } : {}) })
  }
  ts.forEachChild(node, visit)
}
visit(source)
const report = { schemaVersion: 1, file, behaviorVerified: false, apiCalls: 0,
  limitations: ['Single-file syntactic inventory, not a call graph.',
    'No helper call does not prove a missing bonus; a helper call does not prove correct timing or ownership.',
    'Does not identify every manually summed damage roll or imported damage path.'],
  counts: Object.fromEntries([...names].map(name => [name, entries.filter(entry => entry.call === name).length])), entries }
const outputIndex = process.argv.indexOf('--output')
if (outputIndex >= 0) {
  if (!process.argv[outputIndex + 1]) throw Error('Missing --output path')
  await writeFile(resolve(process.argv[outputIndex + 1]), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' })
}
console.log(JSON.stringify({ counts: report.counts, behaviorVerified: false }))
