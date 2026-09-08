import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import SavingThrowResultOverlay from './SavingThrowResultOverlay'

describe('SavingThrowResultOverlay', () => {
  it('shows the authoritative save and final persistent-area damage together', () => {
    const html = renderToStaticMarkup(<SavingThrowResultOverlay savingThrow={{
      id: 'wall-save',
      targetTokenId: 'goblin',
      targetName: '地精',
      ability: 'dex',
      phase: 'result',
      dc: 15,
      total: 9,
      success: false,
      damage: 23,
      damageType: 'fire',
      createdAt: 1,
      expiresAt: 2,
    }} />)

    expect(html).toContain('data-testid="saving-throw-result"')
    expect(html).toContain('敏捷豁免')
    expect(html).toContain('9 vs DC 15')
    expect(html).toContain('豁免失败')
    expect(html).toContain('最终受到 23 点火焰伤害')
  })

  it('does not render while the roll is still pending', () => {
    const html = renderToStaticMarkup(<SavingThrowResultOverlay savingThrow={{
      id: 'pending-save',
      targetTokenId: 'goblin',
      targetName: '地精',
      ability: 'dex',
      phase: 'rolling',
      dc: 15,
      createdAt: 1,
      expiresAt: 2,
    }} />)
    expect(html).toBe('')
  })
})
