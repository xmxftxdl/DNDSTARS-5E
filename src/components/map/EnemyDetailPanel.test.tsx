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
  it('offers stat-block override editing only to a DM with map write access', () => {
    const playerMarkup = renderToStaticMarkup(
      <EnemyDetailPanel token={monsterToken()} onClose={() => {}} />,
    )
    const dmMarkup = renderToStaticMarkup(
      <EnemyDetailPanel
        token={monsterToken()}
        onClose={() => {}}
        isDM
        mapId="map-1"
        updateToken={() => {}}
      />,
    )

    expect(playerMarkup).not.toContain('DM 自由编辑属性块')
    expect(dmMarkup).toContain('DM 自由编辑属性块')
    expect(dmMarkup).toContain('仅当前怪物实例')
    expect(dmMarkup).toContain('当前地图全部同类')
  })

  it('gives the DM an always-available presentation marker editor without requiring condition authority', () => {
    const playerMarkup = renderToStaticMarkup(
      <EnemyDetailPanel token={monsterToken()} onClose={() => {}} />,
    )
    const dmMarkup = renderToStaticMarkup(
      <EnemyDetailPanel
        token={monsterToken({
          dnd5eTokenStatusMarkers: [{
            schemaVersion: 1,
            id: 'dm:burning',
            statusId: 'burning',
            source: 'dm',
          }],
        })}
        onClose={() => {}}
        isDM
        mapId="map-1"
        updateToken={() => {}}
        canManageConditions={false}
      />,
    )

    expect(playerMarkup).not.toContain('dnd5e-token-status-marker-editor')
    expect(dmMarkup).toContain('dnd5e-token-status-marker-editor')
    expect(dmMarkup).toContain('仅用于地图显示')
    expect(dmMarkup).toContain('燃烧')
  })

  it('marks implemented monster traits as HEADLESS', () => {
    const markup = renderToStaticMarkup(
      <EnemyDetailPanel
        token={monsterToken({
          id: 'flesh-golem-token',
          label: '血肉魔像',
          poolId: 'srd-5.1:flesh-golem',
          hp: 93,
          maxHp: 93,
        })}
        onClose={() => {}}
      />,
    )

    expect(markup.match(/HEADLESS/g)).toHaveLength(6)
    expect(markup).not.toContain('DM 裁定')
  })

  it('separates declared monster runtime states from presentation-only Token markers', () => {
    const fleshGolemMarkup = renderToStaticMarkup(
      <EnemyDetailPanel
        token={monsterToken({
          id: 'flesh-golem-token',
          label: '血肉魔像',
          poolId: 'srd-5.1:flesh-golem',
          hp: 93,
          maxHp: 93,
        })}
        tokens={[
          monsterToken({ id: 'flesh-golem-token', poolId: 'srd-5.1:flesh-golem' }),
        ]}
        onClose={() => {}}
        isDM
        mapId="map-1"
        updateToken={() => {}}
        canManageConditions
        onConditionsChange={() => {}}
        onMonsterRuntimeStatusChange={() => {}}
      />,
    )
    const dragonMarkup = renderToStaticMarkup(
      <EnemyDetailPanel
        token={monsterToken({ id: 'dragon', poolId: 'srd-5.1:red-dragon-wyrmling' })}
        tokens={[monsterToken({ id: 'dragon', poolId: 'srd-5.1:red-dragon-wyrmling' })]}
        onClose={() => {}}
        isDM
        mapId="map-1"
        updateToken={() => {}}
        canManageConditions
        onConditionsChange={() => {}}
      />,
    )

    expect(fleshGolemMarkup).toContain('怪物专属状态')
    expect(fleshGolemMarkup).toContain('dnd5e-runtime-status-toggle-monster-berserk')
    expect(fleshGolemMarkup).toContain('dnd5e-runtime-status-toggle-monster-damage-aversion')
    expect(fleshGolemMarkup).toContain('仅用于地图显示')
    expect(dragonMarkup).not.toContain('怪物专属状态')
  })

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

  it('renders a DM-approved room-monster snapshot without the private catalogue', () => {
    const markup = renderToStaticMarkup(
      <EnemyDetailPanel
        token={monsterToken({
          label: '房间测试怪物',
          poolId: 'room-monster:player-visible-test',
          playerVisibleEnemyDetail: {
            schemaVersion: 1,
            monsterId: 'room-monster:player-visible-test',
            description: '玩家可以阅读的怪物简介。',
            tags: ['中型', '类人生物'],
            statBlock: {
              cr: '2',
              ac: 14,
              maxHp: 27,
              speed: '30 尺',
              abilities: { str: 14, dex: 12, con: 14, int: 10, wis: 11, cha: 8 },
              traits: [{ name: '公开特性', description: '玩家可见的特性说明。' }],
              actions: [{ name: '长剑', description: '近战武器攻击。', toHit: 4, damageDice: '1d8+2' }],
              source: 'DM 自定义',
            },
          },
        })}
        onClose={() => {}}
      />,
    )

    expect(markup).toContain('CR 2')
    expect(markup).toContain('玩家可以阅读的怪物简介。')
    expect(markup).toContain('公开特性')
    expect(markup).toContain('长剑')
    expect(markup).not.toContain('尚未关联怪物种类')
  })
})
