import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { assertDiceOwnership, isDiceCharacterOwnedByCurrentDm } from './diceOwnership'

describe('explicit DM character dice ownership', () => {
  const session = { roomId: 'room', memberId: 'dm', role: 'dm', accountId: 'dm-account' }
  it('allows the current DM own character, including matching account ownership', () => {
    expect(isDiceCharacterOwnedByCurrentDm({roomId:'room',roomMemberId:'dm'},session)).toBe(true)
    expect(isDiceCharacterOwnedByCurrentDm({roomId:'room',roomMemberId:'dm',ownerAccountId:'dm-account'},session)).toBe(true)
  })
  it.each([
    undefined, {}, {roomId:'room'}, {roomId:'room',roomMemberId:'player'},
    {roomId:'other-room',roomMemberId:'dm'},
    {roomId:'room',roomMemberId:'dm',ownerAccountId:'player-account'},
  ])('does not claim unknown, other-room or player ownership (%j)', character => {
    expect(isDiceCharacterOwnedByCurrentDm(character,session)).toBe(false)
  })
  it('requires an authenticated DM session, not merely a matching member', () => {
    const character={roomId:'room',roomMemberId:'dm'}
    expect(isDiceCharacterOwnedByCurrentDm(character,null)).toBe(false)
    expect(isDiceCharacterOwnedByCurrentDm(character,{...session,role:'player'})).toBe(false)
  })
})

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
