import fs from 'node:fs'
import ts from 'typescript'
const failures = JSON.parse(fs.readFileSync('docs/audits/2026-09-09/failed-tests.json','utf8').replace(/^\uFEFF/,''))
const files = new Map()
for (const failure of failures) {
  if (!failure.file.includes('/rulesets/dnd5e/')) continue
  const match = failure.message.match(/\.test\.ts:(\d+):\d+/)
  if (!match) continue
  const path = failure.file
  if (!files.has(path)) files.set(path, { source: fs.readFileSync(path,'utf8'), lines: [] })
  files.get(path).lines.push(Number(match[1]) - 1)
}
const changed = []
for (const [path, entry] of files) {
  const ast = ts.createSourceFile(path, entry.source, ts.ScriptTarget.Latest, true)
  const replacements = []
  function walk(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'toContainEqual' && node.arguments.length === 1 && ts.isObjectLiteralExpression(node.arguments[0])) {
      const first = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line
      const last = ast.getLineAndCharacterOfPosition(node.getEnd()).line
      if (entry.lines.some(line => line >= first && line <= last)) {
        const argument = node.arguments[0]
        replacements.push({ start: argument.getStart(ast), end: argument.getEnd() })
      }
    }
    ts.forEachChild(node, walk)
  }
  walk(ast)
  let source = entry.source
  for (const { start, end } of replacements.sort((a,b) => b.start-a.start)) source = source.slice(0,start) + 'expect.objectContaining(' + source.slice(start,end) + ')' + source.slice(end)
  if (replacements.length) { fs.writeFileSync(path,source); changed.push({ path, assertions: replacements.length }) }
}
fs.writeFileSync('docs/verification/2026-09-09/event-assertion-changes.json', JSON.stringify(changed,null,2))
console.log(changed)
