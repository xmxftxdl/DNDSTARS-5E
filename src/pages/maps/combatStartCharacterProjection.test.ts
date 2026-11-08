import { it, expect } from 'vitest'
import ts from 'typescript'
import vm from 'node:vm'
import page from '../MapsWorkspacePage?raw'
import { sameDnd5eCombatStartCharacterProjection } from './combatStartCharacterProjection'
import { capturedGlamourProjection, actualStoreResourceOrder } from './testFixtures/combatStartGlamourProjection.fixture'

function pair() {
  const projected = [structuredClone(capturedGlamourProjection)]
  const current = structuredClone(projected)
  current[0].classResources = Object.fromEntries(actualStoreResourceOrder.map(key => [key, current[0].classResources[key]]))
  return { projected, current }
}
let actualGuardCode: string | undefined
function actualGuard(projected: readonly unknown[], current: readonly unknown[]) {
  if (!actualGuardCode) {
  const file = ts.createSourceFile('Maps.tsx', page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let guard: string | undefined
  function visit(node: ts.Node) {
    if (ts.isIfStatement(node) && ts.isThrowStatement(node.thenStatement) && node.thenStatement.getText(file).includes('initiative-page:unsupported-initial-resource-projection')) guard = node.getText(file)
    ts.forEachChild(node, visit)
  }
  visit(file)
  if (!guard) throw Error('The actual production resource guard is required')
  actualGuardCode = ts.transpileModule(guard, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  }
  // Data-only guard isolation. This invokes no initiative/Native/Room issuer.
  vm.runInNewContext(actualGuardCode, { sameDnd5eCombatStartCharacterProjection, combatStartCharactersFor: () => projected, currentCharacters: current, combatMap: {}, nextCombatId: '', surprisedSet: new Set() })
}
it('actual Page accepts the captured Glamour key-order permutation with every value unchanged', () => {
  const { projected, current } = pair(), before = JSON.stringify({ projected, current })
  expect(JSON.stringify(projected)).not.toBe(JSON.stringify(current))
  expect(sameDnd5eCombatStartCharacterProjection(projected, current)).toBe(true)
  expect(() => actualGuard(projected, current)).not.toThrow()
  expect(JSON.stringify({ projected, current })).toBe(before)
})
it('actual Page still rejects every captured resource current or max change and unlisted fields', () => {
  for (const key of Object.keys(capturedGlamourProjection.classResources)) for (const field of ['current', 'max'] as const) {
    const { projected, current } = pair()
    projected[0].classResources[key][field] += field === 'current' ? -1 : 1
    expect(sameDnd5eCombatStartCharacterProjection(projected, current), key + '.' + field).toBe(false)
    expect(() => actualGuard(projected, current), key + '.' + field).toThrow('initiative-page:unsupported-initial-resource-projection')
  }
  const { projected, current } = pair()
  projected[0].currentHp -= 1
  expect(() => actualGuard(projected, current)).toThrow('initiative-page:unsupported-initial-resource-projection')
  const unknownBefore = [{ futureField: { nested: { flag: true } }, value: 1 }]
  const unknownAfter = [{ value: 1, futureField: { nested: { flag: false } } }]
  expect(sameDnd5eCombatStartCharacterProjection(unknownAfter, unknownBefore)).toBe(false)
  expect(sameDnd5eCombatStartCharacterProjection([{ value: 1, added: 0 }], [{ value: 1 }])).toBe(false)
})
it('keeps character and nested array order exact instead of treating arrays as sets', () => {
  expect(sameDnd5eCombatStartCharacterProjection([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'a' }])).toBe(false)
  expect(sameDnd5eCombatStartCharacterProjection([{ ordered: ['a', 'b'] }], [{ ordered: ['b', 'a'] }])).toBe(false)
  expect(sameDnd5eCombatStartCharacterProjection([{ nested: [[1, 2]] }], [{ nested: [[2, 1]] }])).toBe(false)
})
it('takes only one JSON snapshot of each input and does not reread live getters while ordering', () => {
  let projectedReads = 0, currentReads = 0
  const projected = [{ get resource() { projectedReads++; return { max: 5, current: 4 } }, id: 'a' }]
  const current = [{ id: 'a', get resource() { currentReads++; return { current: 4, max: 5 } } }]
  expect(sameDnd5eCombatStartCharacterProjection(projected, current)).toBe(true)
  expect(projectedReads).toBe(1)
  expect(currentReads).toBe(1)
})
