import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { assertDiceOwnership } from './diceOwnership'

describe('mandatory dice ownership', () => {
  it('allows only explicitly free dice to omit their owner', () => {
    expect(() => assertDiceOwnership({})).toThrow('dice-owner-missing')
    expect(() => assertDiceOwnership({ rollerTokenId: '  ' })).toThrow('dice-owner-missing')
    expect(() => assertDiceOwnership({ freeRoll: false })).toThrow('dice-owner-missing')
    expect(() => assertDiceOwnership({ freeRoll: true })).not.toThrow()
    expect(() => assertDiceOwnership({ rollerTokenId: 'caster' })).not.toThrow()
    expect(() => assertDiceOwnership({ rollerCharacterId: 'saving-character' })).not.toThrow()
  })
  it('requires ownership at every map roll call, including rerolls and turn boundaries', () => {
    const path = 'src/pages/MapsWorkspacePage.tsx'
    const source = ts.createSourceFile(path, readFileSync(path,'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const missing: number[] = []
    let count = 0
    function walk(node: ts.Node) {
      if (ts.isCallExpression(node) && ['rollDiceBoxValues','rollDiceBoxD20'].includes(node.expression.getText(source))) {
        count++
        const owner = node.arguments[node.expression.getText(source) === 'rollDiceBoxD20' ? 2 : 4]
        if (!owner || (ts.isObjectLiteralExpression(owner) && !/rollerTokenId|rollerCharacterId|freeRoll|\.\.\./.test(owner.getText(source)))) missing.push(source.getLineAndCharacterOfPosition(node.getStart()).line+1)
      }
      ts.forEachChild(node,walk)
    }
    walk(source)
    expect(count).toBeGreaterThan(0)
    expect(missing).toEqual([])
  })
})
