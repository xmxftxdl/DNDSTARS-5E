import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { createDnd5eMechanicalEffect } from '../../rulesets/dnd5e'
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
  it('shows a monster speed after active spell effects, not only the stat-block base speed', () => {
    const markup = renderToStaticMarkup(
      <EnemyDetailPanel
        token={monsterToken({
          dnd5eCombatState: {
            activeEffects: [createDnd5eMechanicalEffect({
              id: 'longstrider', definitionId: 'srd-5.1:spell:longstrider',
              label: '大步奔行', kind: 'buff', targetId: 'goblin-token',
              source: { kind: 'spell', actorId: 'wizard', rulesId: 'longstrider', spellLevel: 2 },
              duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' },
              modifiers: { speedBonusFeet: 10 },
            })],
          },
        })}
        onClose={() => {}}
      />,
    )
    expect(markup).toContain('>40 尺<')
  })

  it('shows the authoritative map elevation', () => {
    const markup = renderToStaticMarkup(
      <EnemyDetailPanel token={monsterToken({ elevationFeet: 20 })} onClose={() => {}} />,
    )
    expect(markup).toContain('data-testid="enemy-detail-elevation"')
    expect(markup).toContain('>20 尺<')
  })

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

  it('lets a DM add and remove campaign-specific creature types', () => {
    const markup = renderToStaticMarkup(
      <EnemyDetailPanel
        token={monsterToken({ creatureTypes: ['类人生物', '星界寄生体'] })}
        onClose={() => {}}
        isDM
        mapId="map-1"
        updateToken={() => {}}
      />,
    )

    expect(markup).toContain('data-testid="enemy-custom-creature-type-input"')
    expect(markup).toContain('data-testid="enemy-add-custom-creature-type"')
    expect(markup).toContain('星界寄生体')
    expect(markup).toContain('移除自定义生物类型')
  })

  it('shows only the active True Polymorph form tags while retaining the original alignment and personality', () => {
    const markup = renderToStaticMarkup(
      <EnemyDetailPanel
        token={monsterToken({
          label: '棕熊',
          poolId: 'srd-5.1:brown-bear',
          creatureTypes: ['类人生物'],
          creatureSize: '中型',
          hp: 34,
          maxHp: 34,
          dnd5eCombatState: {
            schemaVersion: 2,
            wildShapeFormId: 'srd-5.1:brown-bear',
            wildShapeMode: 'true-polymorph',
            wildShapeOriginalStatBlockId: 'srd-5.1:goblin',
            wildShapePermanent: true,
          },
        })}
        onClose={() => {}}
      />,
    )

    expect(markup).toContain('永久形态')
    expect(markup).toContain('野兽')
    expect(markup).toContain('大型')
    expect(markup).not.toContain('类人生物')
    expect(markup).not.toContain('中型')
    expect(markup).toContain('中立邪恶（保留自本体；人格保留）')
  })

  it('distinguishes a friendly permanent True Polymorph creature from player control', () => {
    const markup = renderToStaticMarkup(
      <EnemyDetailPanel
        token={monsterToken({
          label: '棕熊', poolId: 'srd-5.1:brown-bear', hp: 34, maxHp: 34,
          dnd5eSummon: {
            schemaVersion: 1, pluginId: 'srd-5.1', featureId: 'spell:true-polymorph',
            sourceCharacterId: 'wizard', sourceTokenId: 'wizard-token',
            createdRound: 1, expiresAfterRound: 600, side: 'player',
            persistent: true, controlEnded: true,
          },
        })}
        onClose={() => {}}
      />,
    )

    expect(markup).toContain('玩家友方')
    expect(markup).toContain('永久生物 · DM 控制')
  })

  it('projects a True Polymorph object form instead of leaking the original monster stat block', () => {
    const objectEffect = createDnd5eMechanicalEffect({
      definitionId: 'true-polymorph-creature-object-srd-5.1:true-polymorph-object:stone-statue',
      label: '完全变形术·石制雕像', targetId: 'goblin-token',
      tags: [
        'transformation', 'object-form', 'equipment-merged',
        'true-polymorph-object-form:srd-5.1:true-polymorph-object:stone-statue',
      ],
      source: { kind: 'spell', actorId: 'wizard', rulesId: 'true-polymorph', spellLevel: 9 },
      duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' },
    })
    const markup = renderToStaticMarkup(
      <EnemyDetailPanel token={monsterToken({
        hp: 18, maxHp: 18,
        dnd5eCombatState: {
          schemaVersion: 2,
          wildShapeFormId: 'srd-5.1:true-polymorph-object:stone-statue',
          wildShapeMode: 'true-polymorph', wildShapeCurrentHp: 18,
          wildShapeOriginalStatBlockId: 'srd-5.1:goblin',
          activeEffects: [objectEffect],
        },
      })} onClose={() => {}} />,
    )
    expect(markup).toContain('当前形态：石制雕像（完全变形术）')
    expect(markup).toContain('物体')
    expect(markup).toContain('中型')
    expect(markup).toContain('>17<')
    expect(markup).toContain('>0 尺<')
    expect(markup).toContain('物体没有生物属性、豁免、技能、感官或语言')
    expect(markup).not.toContain('保留自本体')
    expect(markup).not.toContain('弯刀')
    expect(markup).not.toContain('短弓')
  })

  it('puts authoritative temporary HP next to the DM monster HP controls', () => {
    const markup = renderToStaticMarkup(
      <EnemyDetailPanel
        token={monsterToken({ dnd5eCombatState: { temporaryHp: 4 } })}
        onClose={() => {}}
        isDM
        mapId="map-1"
        updateToken={() => {}}
        onSetHitPoints={() => undefined}
        onAdjustHitPoints={() => undefined}
      />,
    )

    expect(markup).toContain('data-testid="dm-hit-point-adjustment-controls"')
    expect(markup).toContain('data-testid="dm-temp-hp-decrease"')
    expect(markup).toContain('data-testid="dm-temp-hp-increase"')
    expect(markup).toContain('临时 4')
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

  it('lets the DM select a staged Headless area action from the monster detail panel', () => {
    const markup = renderToStaticMarkup(
      <EnemyDetailPanel
        token={monsterToken({
          id: 'androsphinx-token',
          label: '雄性斯芬克斯',
          poolId: 'srd-5.1:androsphinx',
          hp: 199,
          maxHp: 199,
        })}
        onClose={() => {}}
        canUseMonsterActions
        monsterActionUsed={false}
        onSelectMonsterAction={() => {}}
      />,
    )

    expect(markup).toContain('选择范围 · 咆哮')
    const roarButton = markup.match(
      /<button[^>]*data-testid="enemy-detail-monster-action-roar"[^>]*>/,
    )?.[0]
    expect(roarButton).toBeDefined()
    expect(roarButton).not.toMatch(/\sdisabled(?:=|\s|>)/)
  })

  it('keeps an exploration trait DM-adjudicated while exposing the independent Headless attack', () => {
    const markup = renderToStaticMarkup(
      <EnemyDetailPanel
        token={monsterToken({
          id: 'homunculus-token',
          label: '魔宠人偶',
          poolId: 'srd-5.1:homunculus',
          hp: 5,
          maxHp: 5,
        })}
        onClose={() => {}}
        canUseMonsterActions
        monsterActionUsed={false}
        onSelectMonsterAction={() => {}}
      />,
    )

    expect(markup).toContain('DM 裁定')
    expect(markup).toContain('感官或探索特性仍依赖情境判断')
    expect(markup).toContain('data-testid="enemy-detail-monster-action-bite"')
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
