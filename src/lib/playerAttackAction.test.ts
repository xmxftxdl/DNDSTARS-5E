import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../store/maps'
import type { Character, CombatSkill } from '../types/character'
import type { HeadlessCombatEvent } from './headlessDmCombatEngine'
import type { SharedPlayerActionState } from './sharedCombatTypes'
import {
  buildArrowSequenceTargetPackets,
  buildAoeTargetPackets,
  buildSingleAttackTargetPacket,
  canResolveSingleAttackWithHeadless,
  planAoeAttackDisplay,
  planArrowSequenceDisplay,
  planSingleAttackDisplay,
  preparePlayerAttackAction,
} from './playerAttackAction'

function makeSkill(patch: Partial<CombatSkill> = {}): CombatSkill {
  return {
    id: 'skill-1',
    name: 'Skill',
    emoji: '',
    description: '',
    apCost: 1,
    cooldown: 1,
    cdReduction: 0,
    remaining: 0,
    usedThisTurn: false,
    damageCount: 1,
    damageSides: 8,
    damageBonus: 0,
    tags: ['ranged'],
    ...patch,
  }
}

function makeCharacter(patch: Partial<Character> = {}): Character {
  return {
    id: 'hero',
    name: 'Hero',
    charClass: '弓手',
    level: 1,
    abilities: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 },
    skills: [],
    currentHp: 10,
    currentAP: 2,
    combatSkills: [makeSkill()],
    combatBuffs: {},
    traits: [],
    ...patch,
  } as Character
}

function makeToken(patch: Partial<Token> = {}): Token {
  return {
    id: 'target-token',
    label: 'Target',
    x: 100,
    y: 100,
    color: '#ef4444',
    emoji: '',
    type: 'enemy',
    size: 1,
    hp: 10,
    maxHp: 10,
    ...patch,
  }
}

function makeAttackResolved(
  patch: Partial<Extract<HeadlessCombatEvent, { type: 'attack-resolved' }>> = {},
): Extract<HeadlessCombatEvent, { type: 'attack-resolved' }> {
  return {
    type: 'attack-resolved',
    actorTokenId: 'hero-token',
    characterId: 'hero',
    targetTokenId: 'target-token',
    skillId: 'skill-1',
    skillName: 'Skill',
    damageValues: [4],
    diceTotal: 4,
    baseDamage: 4,
    damageBeforeDefense: 4,
    modifier: 2,
    diff: 10,
    total: 6,
    isCrit: false,
    hit: true,
    targetDodged: false,
    waivedAp: false,
    apCost: 1,
    ...patch,
  }
}

function makeTargetDodgeResolved(
  patch: Partial<Extract<HeadlessCombatEvent, { type: 'target-dodge-resolved' }>> = {},
): Extract<HeadlessCombatEvent, { type: 'target-dodge-resolved' }> {
  return {
    type: 'target-dodge-resolved',
    actorTokenId: 'hero-token',
    targetTokenId: 'target-token',
    d20Value: 12,
    attackBonus: 5,
    total: 17,
    targetAc: 14,
    dodged: false,
    reason: 'attempt',
    successChance: 0.45,
    ...patch,
  }
}

function makeAoeTargetResolved(
  patch: Partial<Extract<HeadlessCombatEvent, { type: 'aoe-target-resolved' }>> = {},
): Extract<HeadlessCombatEvent, { type: 'aoe-target-resolved' }> {
  return {
    type: 'aoe-target-resolved',
    actorTokenId: 'hero-token',
    characterId: 'hero',
    targetTokenId: 'target-token',
    skillId: 'skill-1',
    skillName: 'Skill',
    damageValues: [4, 5],
    diceTotal: 9,
    baseDamage: 9,
    damageBeforeSave: 11,
    modifier: 2,
    diff: 10,
    total: 6,
    saveD20: 14,
    saveMod: 2,
    saveTotal: 16,
    saveDc: 12,
    saveSuccess: true,
    saveMode: 'half',
    waivedAp: false,
    apCost: 1,
    ...patch,
  }
}

function makeMap(tokens = [makeToken()]): BattleMap {
  return {
    id: 'map-1',
    name: 'Test Map',
    width: 1000,
    height: 1000,
    gridSize: 50,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    tokens,
  }
}

function makeAction(patch: Partial<SharedPlayerActionState> = {}): SharedPlayerActionState {
  return {
    id: 'action-1',
    mapId: 'map-1',
    combatId: 'combat-1',
    sourceMode: 'player',
    status: 'pending',
    type: 'attack-token',
    actorTokenId: 'hero-token',
    characterId: 'hero',
    targetTokenId: 'target-token',
    skillId: 'skill-1',
    round: 1,
    initiativeIndex: 0,
    seq: 1,
    updatedAt: 1000,
    ...patch,
  }
}

describe('player attack action helpers', () => {
  it('prepares a valid attack request with actor, skill, and target tokens', () => {
    const result = preparePlayerAttackAction({
      action: makeAction(),
      map: makeMap(),
      characters: [makeCharacter()],
    })

    expect(result).toMatchObject({
      ok: true,
      actor: { id: 'hero' },
      skill: { id: 'skill-1' },
      targets: [{ id: 'target-token' }],
      targetIds: ['target-token'],
      waiveAp: false,
      doubleArrow: false,
      isArrowSequence: false,
    })
  })

  it('builds a basic single-target attack packet from provided dice callbacks', async () => {
    const rollCalls: Array<{ count: number; sides: number; label: string; targetName: string }> = []
    const result = await buildSingleAttackTargetPacket({
      actor: makeCharacter(),
      skill: makeSkill({ skillTreeId: 'basicShot' }),
      targetToken: makeToken(),
      doubleArrow: false,
      liveRound: 1,
      actorTokenId: 'hero-token',
      firstInitiativeTokenId: 'hero-token',
      rollD20: async () => {
        throw new Error('d20 should not be rolled')
      },
      rollValues: async (count, sides, label, targetName) => {
        rollCalls.push({ count, sides, label, targetName })
        return [5]
      },
      enemyDodgePreview: () => ({ decision: { shouldDodge: false }, attackBonus: 4, targetAc: 12 }),
      chooseCooldownReductionSkillId: () => undefined,
      confirmPushTarget: async () => false,
    })

    expect(result).toMatchObject({
      skillRank: 0,
      packetIsCrit: false,
      attackRollHit: true,
      shouldRollDamage: true,
      targetPacket: {
        targetTokenId: 'target-token',
        damageDiceCount: 1,
        diceValues: [5],
        targetDodgeMode: 'skip',
      },
    })
    expect(rollCalls).toEqual([{ count: 1, sides: 8, label: 'Skill damage', targetName: 'Target' }])
  })

  it('builds double arrow and hunting mark extra damage groups without duplicating extra dice', async () => {
    const rollQueue = [[4, 3], [2], [6, 5]]
    const result = await buildSingleAttackTargetPacket({
      actor: makeCharacter({
        traits: [
          { id: 'doubleArrow', name: '双箭', level: 1, uses: 2, maxUses: 2, description: '', featureKey: 'doubleArrow' },
          { id: 'huntingMark', name: '狩猎印记', level: 2, uses: 0, maxUses: 0, description: '', featureKey: 'huntingMark' },
        ],
      }),
      skill: makeSkill({ skillTreeId: 'basicShot' }),
      targetToken: makeToken({ huntingMarkStacks: 1 }),
      doubleArrow: true,
      liveRound: 1,
      actorTokenId: 'hero-token',
      rollD20: async () => {
        throw new Error('d20 should not be rolled')
      },
      rollValues: async () => rollQueue.shift() ?? [],
      enemyDodgePreview: () => ({ decision: { shouldDodge: false }, attackBonus: 4, targetAc: 12 }),
      chooseCooldownReductionSkillId: () => undefined,
      confirmPushTarget: async () => false,
    })

    expect(result.targetPacket).toMatchObject({
      damageDiceCount: 2,
      diceValues: [4, 3],
      extraDamageGroups: [
        { values: [2], sides: 4 },
        { values: [6, 5], sides: 8 },
      ],
      clearDoubleArrowReadyOnUse: true,
      spendDoubleArrowUseOnHit: true,
      addHuntingMarkOnDamage: true,
    })
    expect(rollQueue).toEqual([])
  })

  it('builds a dodge packet without rolling damage when the target dodge succeeds', async () => {
    let damageRolled = false
    const result = await buildSingleAttackTargetPacket({
      actor: makeCharacter(),
      skill: makeSkill({ skillTreeId: 'basicShot' }),
      targetToken: makeToken(),
      doubleArrow: false,
      liveRound: 1,
      actorTokenId: 'hero-token',
      rollD20: async () => 1,
      rollValues: async () => {
        damageRolled = true
        return [8]
      },
      enemyDodgePreview: () => ({ decision: { shouldDodge: true }, attackBonus: 4, targetAc: 20 }),
      chooseCooldownReductionSkillId: () => undefined,
      confirmPushTarget: async () => false,
    })

    expect(result.shouldRollDamage).toBe(false)
    expect(damageRolled).toBe(false)
    expect(result.targetPacket).toMatchObject({
      targetDodgeD20: 1,
      targetDodgeMode: 'attempt',
      diceValues: undefined,
      extraDamageGroups: undefined,
    })
  })

  it('builds arrow sequence packets by slicing shared damage dice per non-dodged packet', async () => {
    const d20Queue = [1, 20]
    const result = await buildArrowSequenceTargetPackets({
      actor: makeCharacter(),
      skill: makeSkill({ skillTreeId: 'multiShot', damageCount: 1, damageSides: 4, arrowShots: 2 }),
      targets: [makeToken(), makeToken()],
      rollD20: async () => d20Queue.shift() ?? 1,
      rollValues: async (count, sides) => {
        expect({ count, sides }).toEqual({ count: 1, sides: 4 })
        return [3]
      },
      enemyDodgePreview: () => ({ decision: { shouldDodge: true }, attackBonus: 4, targetAc: 20 }),
    })

    expect(result).toMatchObject({
      damagePacketCount: 1,
      targetPackets: [
        { targetDodgeD20: 1, targetDodgeMode: 'attempt', diceValues: undefined },
        { targetDodgeD20: 20, targetDodgeMode: 'attempt', diceValues: [3] },
      ],
    })
  })

  it('builds encircle stun on the first non-dodged packet when all arrows hit the same target', async () => {
    const result = await buildArrowSequenceTargetPackets({
      actor: makeCharacter({ skillRanks: { encircle: 5 } }),
      skill: makeSkill({ skillTreeId: 'encircle', damageCount: 1, damageSides: 4, arrowShots: 2 }),
      targets: [makeToken(), makeToken()],
      rollD20: async () => 13,
      rollValues: async () => [2, 4],
      enemyDodgePreview: () => ({ decision: { shouldDodge: false }, attackBonus: 4, targetAc: 12 }),
    })

    expect(result.targetPackets).toMatchObject([
      {
        diceValues: [2],
        effectSave: { ability: 'con', d20: 13 },
        stunOnFailedEffectSave: true,
        noMoveOnHit: true,
      },
      {
        diceValues: [4],
        effectSave: undefined,
        stunOnFailedEffectSave: false,
        noMoveOnHit: true,
      },
    ])
  })

  it('builds aoe target packets with saves, stun saves, and takeoff extra damage', async () => {
    const d20Queue = [12, 9]
    const result = await buildAoeTargetPackets({
      actor: makeCharacter({
        traits: [{ id: 'takeoff', name: '起飞', level: 2, uses: 0, maxUses: 0, description: '', featureKey: 'takeoff' }],
      }),
      skill: makeSkill({ skillTreeId: 'whirlwindKick', damageSides: 6 }),
      targets: [makeToken()],
      saveMode: 'half',
      shouldStun: true,
      targetHasKnockbackNow: () => true,
      rollD20: async () => d20Queue.shift() ?? 1,
      rollValues: async (count, sides) => {
        expect({ count, sides }).toEqual({ count: 2, sides: 6 })
        return [5, 4]
      },
    })

    expect(result.targetPackets).toEqual([
      {
        targetTokenId: 'target-token',
        saveD20: 12,
        stunSaveD20: 9,
        extraDamageGroups: [{ values: [5, 4], sides: 6 }],
      },
    ])
  })

  it('builds aoe target packets without save rolls when save mode is absent', async () => {
    let d20Rolled = false
    const result = await buildAoeTargetPackets({
      actor: makeCharacter(),
      skill: makeSkill({ skillTreeId: 'windTraceShot' }),
      targets: [makeToken()],
      saveMode: undefined,
      shouldStun: false,
      targetHasKnockbackNow: () => false,
      rollD20: async () => {
        d20Rolled = true
        return 1
      },
      rollValues: async () => [1],
    })

    expect(d20Rolled).toBe(false)
    expect(result.targetPackets).toEqual([
      {
        targetTokenId: 'target-token',
        saveD20: undefined,
        stunSaveD20: undefined,
        extraDamageGroups: undefined,
      },
    ])
  })

  it('rejects invalid targets, aoe skills, dead targets, and insufficient AP', () => {
    expect(
      preparePlayerAttackAction({
        action: makeAction({ targetTokenId: undefined }),
        map: makeMap(),
        characters: [makeCharacter()],
      }),
    ).toEqual({ ok: false, reason: 'invalid-attack' })

    expect(
      preparePlayerAttackAction({
        action: makeAction(),
        map: makeMap([makeToken({ hp: 0 })]),
        characters: [makeCharacter()],
      }),
    ).toEqual({ ok: false, reason: 'invalid-attack' })

    expect(
      preparePlayerAttackAction({
        action: makeAction(),
        map: makeMap(),
        characters: [makeCharacter({ combatSkills: [makeSkill({ skillTreeId: 'whirlwindKick' })] })],
      }),
    ).toEqual({ ok: false, reason: 'invalid-attack' })

    expect(
      preparePlayerAttackAction({
        action: makeAction(),
        map: makeMap(),
        characters: [makeCharacter({ currentAP: 0 })],
      }),
    ).toEqual({ ok: false, reason: 'insufficient-ap' })
  })

  it('lets gale combo waive AP and expands repeated arrow sequence targets', () => {
    const skill = makeSkill({ skillTreeId: 'multiShot', arrowShots: 3 })
    const result = preparePlayerAttackAction({
      action: makeAction(),
      map: makeMap(),
      characters: [makeCharacter({ currentAP: 0, combatBuffs: { galeComboReady: true }, combatSkills: [skill] })],
    })

    expect(result).toMatchObject({
      ok: true,
      waiveAp: true,
      isArrowSequence: true,
    })
    expect(result.ok && result.targets.map((target) => target.id)).toEqual([
      'target-token',
      'target-token',
      'target-token',
    ])
  })

  it('detects double arrow readiness for single-arrow basic shots', () => {
    const skill = makeSkill({ skillTreeId: 'basicShot', arrowShots: 1 })
    const result = preparePlayerAttackAction({
      action: makeAction(),
      map: makeMap(),
      characters: [
        makeCharacter({
          combatBuffs: { doubleArrowReady: true },
          combatSkills: [skill],
          traits: [{ id: 'doubleArrow', name: '双箭', level: 1, uses: 1, maxUses: 2, description: '', featureKey: 'doubleArrow' }],
        }),
      ],
    })

    expect(result).toMatchObject({ ok: true, doubleArrow: true })
  })

  it('checks whether a single attack can use the headless single-target path', () => {
    const actor = makeCharacter()
    expect(canResolveSingleAttackWithHeadless(actor, makeSkill(), { doubleArrow: false, targetCount: 1 })).toBe(true)
    expect(canResolveSingleAttackWithHeadless(actor, makeSkill(), { doubleArrow: true, targetCount: 2 })).toBe(false)
    expect(
      canResolveSingleAttackWithHeadless(actor, makeSkill({ remaining: 1 }), {
        doubleArrow: false,
        targetCount: 1,
      }),
    ).toBe(false)
    expect(
      canResolveSingleAttackWithHeadless(actor, makeSkill({ damageCount: 0 }), {
        doubleArrow: false,
        targetCount: 1,
      }),
    ).toBe(false)
    expect(
      canResolveSingleAttackWithHeadless(actor, makeSkill({ skillTreeId: 'whirlwindKick' }), {
        doubleArrow: false,
        targetCount: 1,
      }),
    ).toBe(false)
  })

  it('keeps pending buff-specific damage on the matching single-target skill only', () => {
    expect(
      canResolveSingleAttackWithHeadless(
        makeCharacter({ combatBuffs: { burstKickExtraD6: 1 } }),
        makeSkill({ skillTreeId: 'basicShot' }),
        { doubleArrow: false, targetCount: 1 },
      ),
    ).toBe(false)
    expect(
      canResolveSingleAttackWithHeadless(
        makeCharacter({ combatBuffs: { burstKickExtraD6: 1 } }),
        makeSkill({ skillTreeId: 'burstKick' }),
        { doubleArrow: false, targetCount: 1 },
      ),
    ).toBe(true)
    expect(
      canResolveSingleAttackWithHeadless(
        makeCharacter({ combatBuffs: { windKickTreatKnockbackTargetId: 'target-token' } }),
        makeSkill({ skillTreeId: 'basicShot' }),
        { doubleArrow: false, targetCount: 1 },
      ),
    ).toBe(false)
    expect(
      canResolveSingleAttackWithHeadless(
        makeCharacter({ combatBuffs: { windKickTreatKnockbackTargetId: 'target-token' } }),
        makeSkill({ skillTreeId: 'windKickCombo' }),
        { doubleArrow: false, targetCount: 1 },
      ),
    ).toBe(true)
  })

  it('plans single attack display from headless hit events', () => {
    const result = planSingleAttackDisplay({
      actor: makeCharacter(),
      skill: makeSkill(),
      targetToken: makeToken(),
      events: [makeTargetDodgeResolved(), makeAttackResolved()],
    })

    expect(result).toMatchObject({
      ok: true,
      formula: '4 = 4，攻防修正+2（差值10），最终6',
      roll: {
        values: [4],
        sides: 8,
        bonus: 2,
        total: 6,
        label: 'Skill · headless DM',
        targetName: 'Target',
      },
      apLog: { amount: 1, action: '使用 Skill', detail: '目标 Target' },
      combatLog: { kind: 'damage' },
    })
    expect(result.ok && result.combatLog.text).toContain('Target 闪避判定 12+5=17 vs AC 14，失败')
  })

  it('plans a no-roll attack log when the target dodges', () => {
    const result = planSingleAttackDisplay({
      actor: makeCharacter(),
      skill: makeSkill(),
      targetToken: makeToken(),
      events: [
        makeTargetDodgeResolved({ dodged: true }),
        makeAttackResolved({
          damageValues: [],
          diceTotal: 0,
          baseDamage: 0,
          damageBeforeDefense: 0,
          modifier: 0,
          diff: 0,
          total: 0,
          hit: false,
          targetDodged: true,
          waivedAp: true,
        }),
      ],
    })

    expect(result).toMatchObject({
      ok: true,
      roll: undefined,
      apLog: { amount: 0 },
      combatLog: {
        kind: 'attack',
        text: expect.stringContaining('目标闪避成功，未造成伤害'),
      },
    })
  })

  it('rejects display planning when headless did not resolve an attack', () => {
    expect(
      planSingleAttackDisplay({
        actor: makeCharacter(),
        skill: makeSkill(),
        targetToken: makeToken(),
        events: [],
      }),
    ).toEqual({ ok: false, reason: 'invalid-attack' })
  })

  it('plans arrow sequence display by aggregating resolved attack packets', () => {
    const result = planArrowSequenceDisplay({
      actor: makeCharacter(),
      skill: makeSkill({ skillTreeId: 'multiShot', damageSides: 4 }),
      targets: [makeToken({ label: 'Goblin' })],
      events: [
        makeAttackResolved({
          targetTokenId: 'goblin-token',
          damageValues: [3, 2],
          diceTotal: 5,
          damageBeforeDefense: 5,
          modifier: 1,
          total: 6,
        }),
        makeAttackResolved({
          targetTokenId: 'goblin-token',
          damageValues: [],
          diceTotal: 0,
          damageBeforeDefense: 0,
          modifier: 0,
          total: 0,
          hit: false,
          targetDodged: true,
        }),
      ],
      targetLabelById: (tokenId) => (tokenId === 'goblin-token' ? 'Goblin' : tokenId),
    })

    expect(result).toMatchObject({
      resolvedEvents: [{ total: 6 }, { total: 0 }],
      roll: {
        values: [3, 2],
        sides: 4,
        bonus: 1,
        total: 6,
        label: 'Skill · 2 段',
        targetName: 'Goblin',
      },
      combatLog: {
        kind: 'damage',
        text: 'Hero 使用 Skill：第 1 段→Goblin 6 点；第 2 段被闪避。',
      },
    })
    expect(result.roll?.formula).toBe('第 1 段 3 + 2，攻防修正+1，最终 6；第 2 段被闪避')
  })

  it('plans aoe display from resolved target packets', () => {
    const result = planAoeAttackDisplay({
      actor: makeCharacter(),
      skill: makeSkill({ skillTreeId: 'arrowStorm', damageSides: 6, damageBonus: 2 }),
      diceValues: [4, 5],
      cellCount: 7,
      targetCount: 2,
      events: [
        makeAoeTargetResolved({ targetTokenId: 'goblin-token', total: 6 }),
        makeAoeTargetResolved({
          targetTokenId: 'dragon-token',
          total: 11,
          saveD20: 4,
          saveMod: 1,
          saveTotal: 5,
          saveSuccess: false,
        }),
      ],
      targetLabelById: (tokenId) =>
        tokenId === 'goblin-token' ? 'Goblin' : tokenId === 'dragon-token' ? 'Dragon' : tokenId,
    })

    expect(result).toMatchObject({
      resolvedEvents: [{ total: 6 }, { total: 11 }],
      roll: {
        values: [4, 5],
        sides: 6,
        bonus: 8,
        total: 17,
        label: 'Skill · 覆盖 7 格',
        formula: '4 + 5 + 2',
        targetName: 'Goblin 6，Dragon 11',
      },
      combatLog: {
        kind: 'damage',
        text: expect.stringContaining('Hero 结算 Skill：覆盖 7 格，2 名目标在范围内。'),
      },
    })
    expect(result.combatLog.text).toContain('Goblin 6 点，敏捷豁免 14+2 vs DC12 成功半伤')
    expect(result.combatLog.text).toContain('Dragon 11 点，敏捷豁免 4+1 vs DC12 失败全伤')
  })
})
