import { describe, expect, it } from 'vitest'
import {
  buildDnd5eCustomMonster,
  createDnd5eCustomMonsterDraft,
  type Dnd5eCustomMonsterActionDraft,
  type Dnd5eCustomMonsterDraft,
} from './customMonsterWorkshop'
import {
  listDnd5eMonsterWorkshopSandboxActions,
  runDnd5eMonsterWorkshopSandbox,
} from './monsterWorkshopSandbox'

function weaponDraft(): Dnd5eCustomMonsterDraft {
  const draft = createDnd5eCustomMonsterDraft()
  return {
    ...draft,
    name: '沙盒卫兵',
    actions: [{
      ...draft.actions[0],
      id: 'staff-strike',
      name: '法杖敲击',
      toHit: 6,
      damageDice: '1d6+4',
      damageType: 'bludgeoning',
    }],
  }
}

function areaDraft(): Dnd5eCustomMonsterDraft {
  const draft = weaponDraft()
  const area: Dnd5eCustomMonsterActionDraft = {
    ...draft.actions[0],
    id: 'breath-weapon',
    name: '吐息武器',
    description: '15 尺锥形，敏捷 DC 14，失败受到 2d6 火焰伤害，成功减半。',
    kind: 'area-saving-throw',
    areaShape: 'cone',
    areaSizeFeet: 15,
    areaSaveAbility: 'dex',
    areaSaveDc: 14,
    areaDamageDice: '2d6',
    areaDamageType: 'fire',
    areaDamageOnSuccessfulSave: 'half',
    areaTarget: 'hostile',
  }
  return { ...draft, actions: [area] }
}

function summonDraft(): Dnd5eCustomMonsterDraft {
  const draft = weaponDraft()
  return {
    ...draft,
    actions: [{
      ...draft.actions[0],
      id: 'call-wolves',
      name: '呼唤狼群',
      description: '召唤 1d3 只狼。',
      kind: 'summon',
      summonMonsterId: 'srd-5.1:wolf',
      summonCountMode: 'dice',
      summonCountDice: '1d3',
      summonDurationRounds: 10,
      summonTiming: 'source-next-turn-start',
      summonConcentration: true,
      summonConcentrationEndsOnAppearance: true,
    }],
  }
}

describe('怪物工坊 Headless 隔离沙盒', () => {
  it('pre-rolls and validates a catalog-backed summon count', () => {
    expect(listDnd5eMonsterWorkshopSandboxActions(summonDraft())).toContainEqual({
      id: 'call-wolves',
      name: '呼唤狼群',
      kind: 'summon',
    })
    const result = runDnd5eMonsterWorkshopSandbox({
      draft: summonDraft(),
      actionId: 'call-wolves',
      targetArmorClass: 14,
      targetHitPoints: 35,
      randomDie: () => 2,
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result).toMatchObject({
      kind: 'summon',
      summon: {
        monsterId: 'srd-5.1:wolf',
        count: 2,
        timing: 'source-next-turn-start',
        durationRounds: 10,
        concentration: true,
        concentrationEndsOnAppearance: true,
      },
      rolls: { summonCountRolls: [2] },
    })
  })

  it('registers the current workshop catalog before validating a room-monster summon', () => {
    const minionDraft = weaponDraft()
    minionDraft.id = 'room-monster:ilifa-ruler-ghostform'
    minionDraft.name = '伊利法统领虚体'
    minionDraft.englishName = 'Ilifa Ruler Ghostform'
    const minion = buildDnd5eCustomMonster(minionDraft)
    const draft = summonDraft()
    draft.actions[0].summonMonsterId = minion.id
    draft.actions[0].summonCountMode = 'fixed'
    draft.actions[0].summonCount = 3
    draft.actions[0].summonDurationRounds = 20
    draft.actions[0].usageKind = 'recharge'
    draft.actions[0].rechargeMinimum = 6
    draft.actions[0].rechargeDieSides = 6

    const result = runDnd5eMonsterWorkshopSandbox({
      draft,
      monsterCatalog: [minion],
      actionId: 'call-wolves',
      targetArmorClass: 14,
      targetHitPoints: 35,
      randomDie: () => 2,
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result).toMatchObject({
      kind: 'summon',
      summon: {
        monsterId: 'room-monster:ilifa-ruler-ghostform',
        count: 3,
        durationRounds: 20,
      },
      rolls: { summonCountRolls: [] },
    })
  })
  it('通过权威怪物攻击事务结算命中和伤害', () => {
    const result = runDnd5eMonsterWorkshopSandbox({
      draft: weaponDraft(),
      actionId: 'staff-strike',
      targetArmorClass: 14,
      targetHitPoints: 35,
      d20: 10,
      randomDie: () => 4,
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result).toMatchObject({
      kind: 'weapon-attack',
      damageApplied: 8,
      targetHitPointsBefore: 35,
      targetHitPointsAfter: 27,
      attack: { total: 16, armorClass: 14, hit: true, critical: false },
    })
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      targetId: 'monster-workshop-sandbox-target',
      hit: true,
    }))
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'damage-applied',
      amount: 8,
      hpAfter: 27,
    }))
  })

  it('按怪物攻击的暴击阈值生成双倍基础伤害骰', () => {
    const result = runDnd5eMonsterWorkshopSandbox({
      draft: weaponDraft(),
      actionId: 'staff-strike',
      targetArmorClass: 30,
      targetHitPoints: 35,
      d20: 20,
      randomDie: () => 3,
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result).toMatchObject({
      damageApplied: 10,
      attack: { hit: true, critical: true },
      rolls: { damageRolls: [[3, 3]] },
    })
  })

  it('为命中后豁免伤害生成 Host 预掷配方并由核心校验', () => {
    const draft = weaponDraft()
    const preserved = buildDnd5eCustomMonster(draft)
    draft.preservedStatBlock = {
      ...preserved,
      actions: preserved.actions.map((action) => action.id === 'staff-strike' && action.attack
        ? {
            ...action,
            attack: {
              ...action.attack,
              onHitEffects: [{
                id: 'staff-fire-rider',
                kind: 'saving-throw-damage' as const,
                ability: 'dex' as const,
                dc: 14,
                damage: [{ average: 7, count: 2, sides: 6, bonus: 0, type: 'fire' as const }],
                damageOnSuccessfulSave: 'half' as const,
              }],
            },
          }
        : action),
    }
    const result = runDnd5eMonsterWorkshopSandbox({
      draft,
      actionId: 'staff-strike',
      targetArmorClass: 14,
      targetHitPoints: 35,
      targetSavingThrowBonus: 2,
      d20: 10,
      randomDie: () => 4,
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok || result.kind === 'area-saving-throw' || result.kind === 'summon') return
    expect(result).toMatchObject({ damageApplied: 16, targetHitPointsAfter: 19 })
    expect(result.rolls.attacks?.[0].onHitEffectRolls).toEqual([{
      effectId: 'staff-fire-rider',
      d20: 10,
      damageRolls: [[4, 4]],
    }])
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved',
      ability: 'dex',
      total: 12,
      dc: 14,
      success: false,
    }))
  })

  it('通过权威范围动作事务结算失败豁免和全额伤害', () => {
    const result = runDnd5eMonsterWorkshopSandbox({
      draft: areaDraft(),
      actionId: 'breath-weapon',
      targetArmorClass: 14,
      targetHitPoints: 30,
      targetSavingThrowBonus: 2,
      d20: 5,
      randomDie: () => 6,
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result).toMatchObject({
      kind: 'area-saving-throw',
      damageApplied: 12,
      targetHitPointsAfter: 18,
      save: { ability: 'dex', modifier: 2, total: 7, dc: 14, success: false },
    })
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'monster-area-action-resolved',
      actionId: 'breath-weapon',
      damage: 12,
    }))
  })

  it('遵守范围动作成功豁免半伤规则', () => {
    const result = runDnd5eMonsterWorkshopSandbox({
      draft: areaDraft(),
      actionId: 'breath-weapon',
      targetArmorClass: 14,
      targetHitPoints: 30,
      targetSavingThrowBonus: 2,
      d20: 15,
      randomDie: () => 6,
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result).toMatchObject({
      kind: 'area-saving-throw',
      damageApplied: 6,
      targetHitPointsAfter: 24,
      save: { total: 17, dc: 14, success: true },
    })
  })

  it('通过同一个权威事务结算固定序列多重攻击', () => {
    const draft = weaponDraft()
    draft.actions[0].attacksPerAction = 2
    const result = runDnd5eMonsterWorkshopSandbox({
      draft,
      actionId: 'multiattack',
      targetArmorClass: 14,
      targetHitPoints: 35,
      d20: 10,
      randomDie: () => 4,
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok || result.kind === 'area-saving-throw') return
    expect(result).toMatchObject({
      kind: 'multiattack',
      damageApplied: 16,
      targetHitPointsAfter: 19,
    })
    expect(result.attacks).toHaveLength(2)
    expect(result.attacks?.every((attack) => attack.hit)).toBe(true)
    expect(result.events.filter((event) => event.type === 'attack-resolved')).toHaveLength(2)
    expect(result.rolls.attacks).toEqual([
      expect.objectContaining({ actionId: 'staff-strike', d20: 10, damageRolls: [[4]] }),
      expect.objectContaining({ actionId: 'staff-strike', d20: 10, damageRolls: [[4]] }),
    ])
  })

  it('在目标回合通过权威传奇动作事务消费点数并攻击', () => {
    const draft = weaponDraft()
    draft.actions.push({
      ...draft.actions[0],
      id: 'legendary-staff',
      name: '传奇法杖',
      category: 'legendary',
      legendaryCost: 2,
    })
    const result = runDnd5eMonsterWorkshopSandbox({
      draft,
      actionId: 'legendary-staff',
      targetArmorClass: 14,
      targetHitPoints: 35,
      d20: 10,
      randomDie: () => 4,
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok || result.kind === 'area-saving-throw') return
    expect(result).toMatchObject({
      kind: 'legendary-action',
      damageApplied: 8,
      targetHitPointsAfter: 27,
      legendary: { cost: 2, remaining: 1 },
    })
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'monster-legendary-action-used',
      actionId: 'legendary-staff',
      cost: 2,
      remaining: 1,
    }))
  })

  it('通过权威目录事务分别试运行附赠攻击和绑定反应', () => {
    const draft = weaponDraft()
    draft.actions.push({
      ...draft.actions[0],
      id: 'quick-staff',
      name: '迅捷法杖',
      category: 'bonus-action',
    }, {
      ...draft.actions[0],
      id: 'staff-reaction',
      name: '追击反应',
      category: 'reaction',
      reactionTriggerActionId: 'staff-strike',
    })
    const common = {
      draft,
      targetArmorClass: 14,
      targetHitPoints: 35,
      d20: 10,
      randomDie: () => 4,
    }

    const bonus = runDnd5eMonsterWorkshopSandbox({ ...common, actionId: 'quick-staff' })
    expect(bonus.ok, bonus.ok ? undefined : bonus.reason).toBe(true)
    if (bonus.ok) {
      expect(bonus).toMatchObject({ kind: 'bonus-action', damageApplied: 8 })
      expect(bonus.events).toContainEqual({
        type: 'turn-resource-spent',
        actorId: 'monster-workshop-sandbox-actor',
        resource: 'bonusAction',
      })
    }

    const reaction = runDnd5eMonsterWorkshopSandbox({ ...common, actionId: 'staff-reaction' })
    expect(reaction.ok, reaction.ok ? undefined : reaction.reason).toBe(true)
    if (reaction.ok) {
      expect(reaction).toMatchObject({ kind: 'reaction', damageApplied: 8 })
      expect(reaction.events).toContainEqual({
        type: 'turn-resource-spent',
        actorId: 'monster-workshop-sandbox-actor',
        resource: 'reaction',
      })
    }
  })

  it('只列出可由当前沙盒权威结算的动作', () => {
    const draft = weaponDraft()
    draft.actions.push({
      ...draft.actions[0],
      id: 'manual-action',
      name: 'DM 动作',
      automation: 'dm-adjudication',
    })

    expect(listDnd5eMonsterWorkshopSandboxActions(draft)).toEqual([
      { id: 'staff-strike', name: '法杖敲击', kind: 'weapon-attack' },
    ])
  })

  it('把多重攻击和传奇攻击列为可试运行的权威动作', () => {
    const draft = weaponDraft()
    draft.actions[0].attacksPerAction = 2
    draft.actions.push({
      ...draft.actions[0],
      id: 'legendary-staff',
      name: '传奇法杖',
      category: 'legendary',
      attacksPerAction: 1,
    })

    expect(listDnd5eMonsterWorkshopSandboxActions(draft)).toEqual([
      { id: 'multiattack', name: '多重攻击', kind: 'multiattack' },
      { id: 'staff-strike', name: '法杖敲击', kind: 'weapon-attack' },
      { id: 'legendary-staff', name: '传奇法杖', kind: 'legendary-action' },
    ])
  })

  it('只把拥有绑定触发条件的 Headless 反应列入沙盒', () => {
    const draft = weaponDraft()
    draft.actions.push({
      ...draft.actions[0],
      id: 'quick-staff',
      name: '迅捷法杖',
      category: 'bonus-action',
    }, {
      ...draft.actions[0],
      id: 'bound-reaction',
      name: '绑定反应',
      category: 'reaction',
      reactionTriggerActionId: 'staff-strike',
    }, {
      ...draft.actions[0],
      id: 'unbound-reaction',
      name: '未绑定反应',
      category: 'reaction',
      reactionTriggerActionId: '',
    })

    expect(listDnd5eMonsterWorkshopSandboxActions(draft)).toEqual([
      { id: 'staff-strike', name: '法杖敲击', kind: 'weapon-attack' },
      { id: 'quick-staff', name: '迅捷法杖', kind: 'bonus-action' },
      { id: 'bound-reaction', name: '绑定反应', kind: 'reaction' },
    ])
  })
})
