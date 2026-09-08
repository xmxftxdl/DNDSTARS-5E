import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workspaceSource = readFileSync(
  new URL('../MapsWorkspacePage.tsx', import.meta.url),
  'utf8',
)

describe('committed area Sculpt Spells Token selection', () => {
  it('routes Token-layer clicks through the committed-template modifier picker', () => {
    const handlerStart = workspaceSource.indexOf('const handleSelectToken = async')
    const handlerEnd = workspaceSource.indexOf('\n  const handleMap', handlerStart)
    const handlerSource = workspaceSource.slice(
      handlerStart,
      handlerEnd > handlerStart ? handlerEnd : undefined,
    )

    expect(handlerSource).toContain('selectDnd5eAreaModifierTarget(tokenId)')
    expect(handlerSource).not.toContain(
      '!dnd5eSpellTargeting.targetTokenIds.includes(targetToken.id)',
    )
  })

  it('keeps protection selection on map Tokens instead of duplicating names in the action bar', () => {
    expect(workspaceSource).toContain('点击地图上的蓝框角色；金边表示已保护')
    expect(workspaceSource).not.toContain('或直接点击下方名字')
    expect(workspaceSource).not.toContain('aria-label="法术塑型保护目标"')
  })

  it('shows the protection picker only when Sculpt Spells was armed for this cast', () => {
    expect(workspaceSource).toContain(
      'dnd5eSpellTargeting.areaTargetSelected && dnd5eSpellTargeting.autoSculpt === true ? <button',
    )
    expect(workspaceSource).not.toContain(
      'dnd5eSpellTargeting.areaTargetSelected && dnd5eSpellTargeting.canSculpt ? <button',
    )
  })
})
