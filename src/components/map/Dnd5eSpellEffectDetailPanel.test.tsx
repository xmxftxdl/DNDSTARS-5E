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
    expect(markup).toContain('结束该实体对应的专注效果')
    expect(markup).not.toContain('仍在专注于炽焰法球')
  })

  it('describes a non-concentration entity without claiming it ends concentration', () => {
    const token: Token = {
      id: 'servant-token',
      label: '隐形仆役',
      x: 125,
      y: 125,
      color: '#94a3b8',
      emoji: '◌',
      size: 1,
      type: 'obstacle',
      dnd5eSpellEffect: {
        schemaVersion: 1,
        spellId: 'unseen-servant',
        sourceCharacterId: 'caster',
        sourceTokenId: 'caster-token',
        createdRound: 1,
        expiresAfterRound: 601,
        hiddenBody: true,
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

    expect(markup).toContain('该法术实体不需要专注')
    expect(markup).toContain('不会影响施法者正在维持的其他法术')
    expect(markup).not.toContain('炽焰法球')
  })

  it('explains that a Mirror Image decoy is independently movable and hides area deletion', () => {
    const token: Token = {
      id: 'mirror-decoy',
      label: '镜影分身 1',
      x: 125,
      y: 125,
      color: '#60a5fa',
      emoji: '🧙',
      size: 1,
      type: 'obstacle',
      dnd5eSpellEffect: {
        schemaVersion: 1,
        spellId: 'mirror-image',
        sourceCharacterId: 'caster',
        sourceTokenId: 'caster-token',
        sourceEffectId: 'mirror-effect',
        projectionKind: 'attack-decoy',
        projectionIndex: 1,
        createdRound: 1,
        expiresAfterRound: 11,
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

    expect(markup).toContain('DM 可以单独拖动')
    expect(markup).toContain('剩余数量由攻击结算自动同步')
    expect(markup).not.toContain('删除法术实体')
  })
})
