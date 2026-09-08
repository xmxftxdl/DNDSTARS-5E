import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workspaceSource = readFileSync(
  new URL('../MapsWorkspacePage.tsx', import.meta.url),
  'utf8',
)

describe('manual monster automatic roll mode', () => {
  it('preserves an undefined mode from the automatic detail-panel control', () => {
    expect(workspaceSource).toContain(
      'onSelectMonsterAction={(actionIndex, actionName, rollMode) => {',
    )
    expect(workspaceSource).toContain(
      'onSelectMonsterContinuation={(continuation, rollMode) =>',
    )
    expect(workspaceSource).not.toContain(
      "onSelectMonsterAction={(actionIndex, actionName, rollMode = 'normal') => {",
    )
    expect(workspaceSource).not.toContain(
      "onSelectMonsterContinuation={(continuation, rollMode = 'normal') =>",
    )
  })
})
