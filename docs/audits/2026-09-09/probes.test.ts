// These characterize audit findings, not desired production behavior.
import { expect, it, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { createDiceCheckCueLedger } from '../../../src/presentation/maps/diceCheckCueLedger'
import { readDicePoolCheckpoint, writeDicePoolCheckpoint } from '../../../src/presentation/maps/dicePoolCheckpoint'
import { publishSpellBannerPresentation } from '../../../src/lib/combatPresentation'
import { publishSharedEvent } from '../../../src/lib/sharedApi'
vi.mock('../../../src/lib/sharedApi', () => ({
  publishSharedEvent: vi.fn(async () => undefined),
  sampleSharedServerClock: vi.fn(async () => ({ offsetMs: 0, roundTripMs: 1, sampledAt: Date.now() })),
}))
afterEach(() => vi.unstubAllGlobals())

it('AUDIT-01: retry after transport failure is swallowed as already published', async () => {
  const transport = vi.mocked(publishSharedEvent)
  transport.mockClear()
  transport.mockRejectedValueOnce(new Error('offline'))
  const event = { id: 'audit-offline', mapId: 'audit-map', transactionId: 'audit-tx', sourceTokenId: 'caster', spellId: 'fire-bolt', casterName: '法师', spellName: '火焰箭', castingClassId: 'wizard' }
  await expect(publishSpellBannerPresentation(event)).rejects.toThrow('offline')
  await publishSpellBannerPresentation(event)
  expect(transport).toHaveBeenCalledTimes(1)
})

it('AUDIT-02: a preview from another roll suppresses an unrelated final with the same names', () => {
  const accept = createDiceCheckCueLedger()
  const common = { kind: 'attack' as const, actorName: '法师', targetName: '怪物', success: true }
  expect(accept({ ...common, id: 'preview-A', rollId: 'roll-A', values: [15], provisional: true })).toBe(true)
  expect(accept({ ...common, id: 'final-B', rollId: 'roll-B', values: [18] })).toBe(false)
})

it('AUDIT-03: malformed persisted dice pool throws instead of falling back', () => {
  vi.stubGlobal('window', { sessionStorage: { getItem: () => JSON.stringify({ bad: { sides: 20, confirmed: false } }) } })
  expect(() => readDicePoolCheckpoint('bad', 1, 20)).toThrow(TypeError)
})

it('AUDIT-04: updated pool is evicted from storage because updates do not refresh insertion order', () => {
  let data = '{}'
  vi.stubGlobal('window', { sessionStorage: { getItem: () => data, setItem: (_key: string, value: string) => { data = value } } })
  writeDicePoolCheckpoint('active-old', 20, [15])
  for (let i = 0; i < 499; i++) writeDicePoolCheckpoint(`other-${i}`, 20, [1])
  writeDicePoolCheckpoint('active-old', 20, [15], true)
  writeDicePoolCheckpoint('new', 20, [2])
  expect(JSON.parse(data)['active-old']).toBeUndefined()
})

it('CONTROL-01: inspect ownership arguments without the obsolete call-count threshold', () => {
  const file = 'src/pages/MapsWorkspacePage.tsx'
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let count = 0
  const missing: number[] = []
  function walk(node: ts.Node) {
    if (ts.isCallExpression(node) && ['rollDiceBoxValues', 'rollDiceBoxD20'].includes(node.expression.getText(source))) {
      count++
      const owner = node.arguments[node.expression.getText(source) === 'rollDiceBoxD20' ? 2 : 4]
      if (!owner || (ts.isObjectLiteralExpression(owner) && !/rollerTokenId|rollerCharacterId|freeRoll|\.\.\./.test(owner.getText(source)))) missing.push(source.getLineAndCharacterOfPosition(node.getStart()).line + 1)
    }
    ts.forEachChild(node, walk)
  }
  walk(source)
  expect(count).toBe(271)
  expect(missing).toEqual([])
})
