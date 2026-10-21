import { describe, expect, it, vi } from 'vitest'
import {
  createDnd5eCombatant,
  startDnd5eHeadlessCombat,
} from '../../rulesets/dnd5e'
import {
  resolveDnd5eAbilityCheckInterrupts,
  resolveDnd5eSavingThrowInterrupts,
} from './dnd5eRollInterruptPipeline'

const abilities = { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 } as const

it('passes explicit saving and grapple sources to optional-die selection without inferring one for ordinary checks', async () => {
  const hero = createDnd5eCombatant({ id: 'hero', name: 'Hero', controller: 'player', initiative: 20, abilities,
    proficiencyBonus: 2, armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30,
    position: { x: 0, y: 0 }, concentrating: false })
  const requestOptionalBonusDie = vi.fn(async () => undefined)
  const common = { combatant: hero, targetName: 'Hero', dc: 15, mode: 'normal' as const, label: 'Check',
    rollD20: async () => 10, requestOptionalBonusDie }
  await resolveDnd5eSavingThrowInterrupts({ ...common, state: startDnd5eHeadlessCombat('source', [hero]),
    ability: 'str', rollD4: async () => 1, sourceActorId: 'prey' })
  expect(requestOptionalBonusDie).toHaveBeenLastCalledWith(expect.objectContaining({
    source: { actorId: 'prey', kind: 'saving-throw' },
  }))
  await resolveDnd5eAbilityCheckInterrupts({ ...common, previewTotal: d20 => d20, grappleSourceId: 'prey' })
  expect(requestOptionalBonusDie).toHaveBeenLastCalledWith(expect.objectContaining({
    source: { actorId: 'prey', kind: 'grapple-escape' },
  }))
  await resolveDnd5eAbilityCheckInterrupts({ ...common, previewTotal: d20 => d20 })
  expect(requestOptionalBonusDie).toHaveBeenLastCalledWith(expect.objectContaining({ source: undefined }))
})

it('preserves the selected reroll resource alongside replacement dice', async () => {
  const hero=createDnd5eCombatant({id:'hero',name:'Hero',controller:'player',initiative:20,abilities,proficiencyBonus:4,armorClass:12,currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false,classId:'fighter',level:9,classResources:{fighterIndomitable:{current:1,max:1}}})
  const target={id:'hero',name:'Hero'} as import('../../types/character').Character
  const requestSavingThrowReroll=vi.fn(async()=>({d20:20,resourceKey:'fighterIndomitable'}))
  const resolved=await resolveDnd5eSavingThrowInterrupts({state:startDnd5eHeadlessCombat('selected-reroll',[hero]),combatant:hero,target,targetName:'Hero',ability:'con',dc:30,mode:'normal',label:'Save',rollD20:async()=>1,rollD4:async()=>1,requestSavingThrowReroll})
  expect(requestSavingThrowReroll).toHaveBeenCalledOnce()
  expect(resolved).toMatchObject({rerollD20:20,rerollResourceKey:'fighterIndomitable'})
  expect(hero.classResources.fighterIndomitable.current).toBe(1)
})

describe('D&D 5E d20 结算中断管线', () => {
  it('让属性检定复用幸运上下文和同一奖励骰请求', async () => {
    const hero = createDnd5eCombatant({
      id: 'hero-check',
      name: 'Hero',
      controller: 'player',
      initiative: 20,
      abilities,
      proficiencyBonus: 2,
      armorClass: 12,
      currentHp: 20,
      maxHp: 20,
      temporaryHp: 0,
      speed: 30,
      position: { x: 0, y: 0 },
      concentrating: false,
    })
    const rollD20 = vi.fn(async () => 7)
    const requestOptionalBonusDie = vi.fn(async () => ({
      effectId: 'guidance-effect',
      targetId: hero.id,
      rollKind: 'ability-check' as const,
      roll: 2,
    }))

    const resolved = await resolveDnd5eAbilityCheckInterrupts({
      combatant: hero,
      targetName: hero.name,
      dc: 11,
      mode: 'normal',
      label: '力量检定',
      previewTotal: (d20) => d20 + 2,
      rollD20,
      requestOptionalBonusDie,
    })

    expect(rollD20).toHaveBeenCalledWith(
      '力量检定',
      'Hero',
      expect.objectContaining({ rollKind: 'ability-check' }),
    )
    expect(requestOptionalBonusDie).toHaveBeenCalledWith(expect.objectContaining({
      combatant: hero,
      rollKind: 'ability-check',
      originalD20: 7,
      total: 9,
      targetNumber: 11,
    }))
    expect(resolved?.total).toBe(11)
  })

  it('无论基础检定成功或 d4 无法翻盘，都把神导术选择留给玩家', async () => {
    const hero = createDnd5eCombatant({
      id: 'guided-hero',
      name: 'Guided Hero',
      controller: 'player',
      initiative: 20,
      abilities,
      proficiencyBonus: 2,
      armorClass: 12,
      currentHp: 20,
      maxHp: 20,
      temporaryHp: 0,
      speed: 30,
      position: { x: 0, y: 0 },
      concentrating: false,
    })
    const requestOptionalBonusDie = vi.fn(async () => undefined)

    await resolveDnd5eAbilityCheckInterrupts({
      combatant: hero,
      targetName: hero.name,
      dc: 5,
      mode: 'normal',
      label: '成功检定',
      previewTotal: (d20) => d20 + 2,
      rollD20: async () => 10,
      requestOptionalBonusDie,
    })
    await resolveDnd5eAbilityCheckInterrupts({
      combatant: hero,
      targetName: hero.name,
      dc: 30,
      mode: 'normal',
      label: '无法翻盘的检定',
      previewTotal: (d20) => d20 + 2,
      rollD20: async () => 10,
      requestOptionalBonusDie,
    })

    expect(requestOptionalBonusDie).toHaveBeenCalledTimes(2)
    expect(requestOptionalBonusDie).toHaveBeenNthCalledWith(1, expect.objectContaining({
      rollKind: 'ability-check', total: 12, targetNumber: 5,
    }))
    expect(requestOptionalBonusDie).toHaveBeenNthCalledWith(2, expect.objectContaining({
      rollKind: 'ability-check', total: 12, targetNumber: 30,
    }))
  })

  it('用显式豁免上下文复用共享幸运中断，并在奖励骰成功后停止后续资源询问', async () => {
    const hero = createDnd5eCombatant({
      id: 'hero',
      name: 'Hero',
      controller: 'player',
      initiative: 20,
      abilities,
      proficiencyBonus: 2,
      armorClass: 12,
      currentHp: 20,
      maxHp: 20,
      temporaryHp: 0,
      speed: 30,
      position: { x: 0, y: 0 },
      concentrating: true,
    })
    const state = startDnd5eHeadlessCombat('pipeline', [hero])
    const rollD20 = vi.fn(async () => 7)
    const requestOptionalBonusDie = vi.fn(async () => ({
      effectId: 'resistance-effect',
      targetId: hero.id,
      rollKind: 'saving-throw' as const,
      roll: 2,
    }))
    const requestDarkOnesOwnLuck = vi.fn(async () => 10)
    const requestSavingThrowReroll = vi.fn(async () => ({ d20: 20 }))

    const resolved = await resolveDnd5eSavingThrowInterrupts({
      state,
      combatant: hero,
      targetName: hero.name,
      ability: 'con',
      dc: 11,
      mode: 'normal',
      label: '专注·体质豁免 DC 11',
      rollD20,
      rollD4: async () => 1,
      requestOptionalBonusDie,
      requestDarkOnesOwnLuck,
      requestSavingThrowReroll,
    })

    expect(rollD20).toHaveBeenCalledWith(
      '专注·体质豁免 DC 11',
      'Hero',
      expect.objectContaining({
        rollKind: 'saving-throw',
        rollerTokenId: 'hero',
      }),
    )
    expect(requestOptionalBonusDie).toHaveBeenCalledWith(expect.objectContaining({
      combatant: hero,
      rollKind: 'saving-throw',
      originalD20: 7,
      total: 9,
      targetNumber: 11,
    }))
    expect(resolved.optionalBonusDieUse?.roll).toBe(2)
    expect(resolved.success).toBe(true)
    expect(requestDarkOnesOwnLuck).not.toHaveBeenCalled()
    expect(requestSavingThrowReroll).not.toHaveBeenCalled()
  })
})
