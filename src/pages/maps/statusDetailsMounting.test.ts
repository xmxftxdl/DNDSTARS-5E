import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

describe('map status details mounting', () => {
  it('keeps the status dialog outside the conditional/portalled unit drawer', () => {
    const source = readFileSync(new URL('../MapsWorkspacePage.tsx', import.meta.url), 'utf8')
    const tree = ts.createSourceFile('MapsWorkspacePage.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    let dialogs = 0
    const visit = (node: ts.Node) => {
      if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === 'MapWorkspaceActiveEffectDetailsDialog') {
        dialogs++
        for (let parent = node.parent; parent; parent = parent.parent) {
          if (ts.isJsxElement(parent)) expect(parent.openingElement.tagName.getText(tree)).not.toBe('MapCombatUnitDrawer')
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(tree)
    expect(dialogs).toBe(1)
  })
})
