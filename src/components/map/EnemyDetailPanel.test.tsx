import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'
import EnemyDetailPanel from './EnemyDetailPanel'

function monsterToken(patch: Partial<Token> = {}): Token {
  return {
    id: 'goblin-token',
    label: '哥布林',
    x: 0,
    y: 0,
    color: '#4ade80',
    emoji: '👺',
    size: 1,
    type: 'enemy',
    poolId: 'srd-5.1:goblin',
    hp: 7,
    maxHp: 7,
    ...patch,
  }
}

describe('EnemyDetailPanel monster thumbnail', () => {
  it('uses the bundled monster Token portrait instead of the legacy emoji', () => {
    const markup = renderToStaticMarkup(
      <EnemyDetailPanel token={monsterToken()} onClose={() => {}} />,
    )

    expect(markup).toContain('/assets/portraits/goblin-forest-scout-token.png')
    expect(markup).toContain('哥布林的地图缩略图')
  })

  it('prefers an explicit Token portrait over the bundled presentation', () => {
    const markup = renderToStaticMarkup(
      <EnemyDetailPanel
        token={monsterToken({ tokenPortrait: 'data:image/png;base64,custom-token' })}
        onClose={() => {}}
      />,
    )

    expect(markup).toContain('data:image/png;base64,custom-token')
    expect(markup).not.toContain('/assets/portraits/goblin-forest-scout-token.png')
  })

  it('uses the same linked authoritative hit points for the numeric label and health bar', () => {
    const linked = {
      id: 'monster-character',
      currentHp: 80,
      maxHp: 80,
      conditions: [],
    } as unknown as Character
    const markup = renderToStaticMarkup(
      <EnemyDetailPanel
        token={monsterToken({
          characterId: linked.id,
          hp: 40,
          maxHp: 80,
        })}
        characters={[linked]}
        onClose={() => {}}
      />,
    )

    expect(markup).toContain('80 / 80')
    expect(markup).toContain('width:100%')
  })
})
