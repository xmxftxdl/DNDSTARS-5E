import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { Token } from '../../store/maps'
import Dnd5eSpellEffectDetailPanel from './Dnd5eSpellEffectDetailPanel'

describe('Dnd5eSpellEffectDetailPanel', () => {
  it('gives the DM an explicit relation-safe removal control', () => {
    const token: Token = {
      id: 'sphere-token',
      label: '炽焰法球',
      x: 125,
      y: 125,
      color: '#f97316',
      emoji: '🔥',
      size: 1,
      type: 'obstacle',
      dnd5eSpellEffect: {
        schemaVersion: 1,
        spellId: 'flaming-sphere',
        sourceCharacterId: 'caster',
        sourceTokenId: 'caster-token',
        createdRound: 1,
        expiresAfterRound: 11,
        concentrationId: 'flaming-sphere',
      },
    }

    const markup = renderToStaticMarkup(
      <Dnd5eSpellEffectDetailPanel
        token={token}
        sourceName="法师"
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(markup).toContain('data-testid="dnd5e-spell-effect-detail-panel"')
    expect(markup).toContain('炽焰法球')
    expect(markup).toContain('施法者：法师')
    expect(markup).toContain('删除法术实体')
    expect(markup).toContain('同时移除该实体关联的范围区域')
  })
})
