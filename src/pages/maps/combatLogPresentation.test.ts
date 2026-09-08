import { describe, expect, it } from 'vitest'
import type { CombatLogEntry } from '../../lib/sharedCombatTypes'
import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  combatLogEntryIsInitiativeResult,
  dnd5eCounterspelledSpellOutcome,
  dnd5eDamageDiceAuditPresentation,
  dnd5eDelayedSpellDamageLogMessages,
  dnd5eSpellDamageTypeLabel,
  dnd5ePersistentAreaNotificationLogSuffix,
  dnd5eCharacterPresentationColors,
  dnd5eSpellAttackAuditPresentation,
  dnd5eStabilizationSpellOutcome,
  inferCombatLogActorTokenId,
  resolveCombatLogSubject,
  resolveHeadlessCombatLogActorTokenId,
} from './combatLogPresentation'

function token(patch: Partial<Token> & Pick<Token, 'id' | 'label' | 'type'>): Token {
  return {
    x: 0,
    y: 0,
    color: '#94a3b8',
    emoji: '',
    size: 1,
    ...patch,
  }
}

function entry(patch: Partial<CombatLogEntry> = {}): CombatLogEntry {
  return {
    id: 1,
    round: 1,
    text: '哥布林攻击法师',
    kind: 'attack',
    time: '10:00',
    ...patch,
  }
}

const wizard = {
  id: 'wizard-character',
  name: '法师',
  avatar: '🧙',
  charClass: 'wizard',
  dnd5eClassLevels: { wizard: 5 },
  tokenPortrait: '/wizard-token.png',
} as Character

const wizardToken = token({
  id: 'wizard-token',
  label: '法师',
  type: 'player',
  characterId: wizard.id,
})
const goblinToken = token({
  id: 'goblin-token',
  label: '哥布林',
  type: 'enemy',
  poolId: 'srd-5.1:goblin',
  portraitImageId: 'uploaded-goblin',
})

describe('combat log subject presentation', () => {
  it('makes mental and audible persistent-area alert delivery explicit', () => {
    expect(dnd5ePersistentAreaNotificationLogSuffix({ delivery: 'mental-to-source' }))
      .toBe('；向施法者发出心灵警报')
    expect(dnd5ePersistentAreaNotificationLogSuffix({ delivery: 'audible', audibleRadiusFeet: 60 }))
      .toBe('；发出声音警报（60 尺内可听）')
    expect(dnd5ePersistentAreaNotificationLogSuffix({
      delivery: 'audible', audibleRadiusFeet: 30, message: '前方有危险',
    })).toBe('；发出声音（30 尺内可听）：“前方有危险”')
  })

  it('surfaces delayed spell damage committed at the target turn end', () => {
    expect(dnd5eDelayedSpellDamageLogMessages([{
      type: 'delayed-spell-damage-triggered', sourceId: wizardToken.id,
      targetId: goblinToken.id, spellId: 'acid-arrow', amount: 5,
    }], [wizardToken, goblinToken])).toEqual([
      '法师 的强酸箭在 哥布林 的回合结束时触发，造成 5 点强酸伤害。',
    ])
  })

  it('reports a successful counterspell before any spell-specific fallback effect', () => {
    expect(dnd5eCounterspelledSpellOutcome([
      { type: 'counterspell-resolved', success: true },
    ], '虔诚护盾')).toBe('虔诚护盾被法术反制，未产生效果')
    expect(dnd5eCounterspelledSpellOutcome([
      { type: 'counterspell-resolved', success: false },
    ], '虔诚护盾')).toBeUndefined()
  })

  it('reports stabilization instead of hiding it behind a zero-HP-change fallback', () => {
    expect(dnd5eStabilizationSpellOutcome(
      { effect: 'stabilize' },
      '倒地法师',
    )).toBe('倒地法师 伤势稳定；死亡豁免成功与失败均重置为 0')
    expect(dnd5eStabilizationSpellOutcome(
      { effect: 'automatic-damage' },
      '倒地法师',
    )).toBeUndefined()
  })

  it('preserves every rolled damage die in the authority audit text', () => {
    expect(dnd5eDamageDiceAuditPresentation({ rolls: [8, 5, 3, 1], sides: 8 }))
      .toBe('伤害掷骰：4d8 [8, 5, 3, 1] = 17')
    expect(dnd5eDamageDiceAuditPresentation({ rolls: [4, 2], sides: 6, bonus: 3 }))
      .toBe('伤害掷骰：2d6 [4, 2] = 6 + 3 = 9')
    expect(dnd5eDamageDiceAuditPresentation({ rolls: [], sides: 8 })).toBeUndefined()
  })

  it('uses Headless damage types in a spell summary instead of a generic label', () => {
    expect(dnd5eSpellDamageTypeLabel([
      { type: 'damage-applied', damageTypes: ['necrotic'] },
      { type: 'damage-applied', damageTypes: ['necrotic', 'fire'] },
      { type: 'damage-applied', damageTypes: ['unknown'] },
    ])).toBe('黯蚀、火焰')
  })

  it('uses a sustained spell attack own delivery and range in the audit log', () => {
    expect(dnd5eSpellAttackAuditPresentation({
      id: 'produce-flame',
      name: '燃火术',
      englishName: 'Produce Flame',
      level: 0,
      school: '咒法',
      classes: ['druid'],
      castingTime: 'action',
      rangeFeet: 0,
      target: 'ally',
      effect: 'active-effect',
      dice: { count: 0, sides: 8, bonus: 0 },
      damageType: 'fire',
      sustainedAttack: {
        id: 'produce-flame',
        economy: 'action',
        origin: 'caster',
        resolution: 'spell-attack',
        spellAttackMode: 'ranged',
        rangeFeet: 30,
        endsAfterUse: true,
        cantripScaling: true,
        dice: { count: 1, sides: 8 },
        damageType: 'fire',
      },
      description: '测试',
    }, true)).toEqual({ deliveryLabel: '远程', rangeFeet: 30 })
  })

  it('keeps the solid combat border, light status frame and glow as separate class colors', () => {
    expect(dnd5eCharacterPresentationColors(wizard)).toMatchObject({
      accentColor: '#3B82F6',
      statusBorderColor: '#DBEAFE',
      glowColor: '#60A5FA',
      classId: 'wizard',
    })
  })

  it('uses stable actorTokenId before target names and applies the player class border', () => {
    const subject = resolveCombatLogSubject({
      entry: entry({ actorTokenId: wizardToken.id }),
      tokens: [goblinToken, wizardToken],
      characters: [wizard],
    })

    expect(subject).toMatchObject({
      token: wizardToken,
      resolution: 'actor-token-id',
      side: 'player',
      classId: 'wizard',
      borderColor: '#3B82F6',
      portrait: '/wizard-token.png',
    })
  })

  it('uses monster template art while preserving an uploaded portraitImageId', () => {
    const subject = resolveCombatLogSubject({
      entry: entry({ actorTokenId: goblinToken.id }),
      tokens: [goblinToken],
      characters: [],
    })

    expect(subject).toMatchObject({
      resolution: 'actor-token-id',
      side: 'monster',
      borderColor: '#EF4444',
      portraitImageId: 'uploaded-goblin',
      portrait: '/assets/portraits/goblin-forest-scout-token.png',
    })
  })

  it('keeps legacy text fallback and resolves Headless actor/source entity ids', () => {
    expect(resolveCombatLogSubject({
      entry: entry({ actorTokenId: undefined }),
      tokens: [wizardToken, goblinToken],
      characters: [wizard],
    }).token?.id).toBe(goblinToken.id)

    expect(resolveHeadlessCombatLogActorTokenId(
      [{ actorId: wizard.id, sourceId: goblinToken.id }],
      [wizardToken, goblinToken],
    )).toBe(wizardToken.id)
  })

  it('keeps round-boundary rows actorless instead of borrowing the first token of the new round', () => {
    const roundEntry = entry({
      round: 2,
      text: '进入第 2 回合',
      kind: 'turn',
      actorTokenId: goblinToken.id,
    })

    expect(inferCombatLogActorTokenId({
      text: roundEntry.text,
      kind: roundEntry.kind,
      tokens: [goblinToken, wizardToken],
      characters: [wizard],
      currentTurnTokenId: goblinToken.id,
    })).toBeUndefined()
    const subject = resolveCombatLogSubject({
      entry: roundEntry,
      tokens: [goblinToken, wizardToken],
      characters: [wizard],
      currentTurnTokenId: goblinToken.id,
    })
    expect(subject).toMatchObject({
      side: 'neutral',
      resolution: 'neutral',
    })
    expect(subject.token).toBeUndefined()
  })

  it('keeps the shared initiative result neutral even when its details name combatants', () => {
    const initiativeEntry = entry({
      text: '先攻结果（由高到低）',
      kind: 'system',
      details: ['1. 哥布林：先攻 18', '2. 法师：先攻 12'],
    })

    expect(combatLogEntryIsInitiativeResult(initiativeEntry)).toBe(true)
    const subject = resolveCombatLogSubject({
      entry: initiativeEntry,
      tokens: [goblinToken, wizardToken],
      characters: [wizard],
      currentTurnTokenId: goblinToken.id,
    })
    expect(subject).toMatchObject({
      label: '先攻结果',
      side: 'neutral',
      resolution: 'neutral',
    })
    expect(subject.token).toBeUndefined()
  })
})
