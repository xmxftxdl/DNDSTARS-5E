import { describe, expect, it } from 'vitest'
import type { HeadlessCombatEvent } from './headlessDmCombatEngine'
import {
  aoeTargetResolvedEvents,
  apSpentEvent,
  attackResolvedEvent,
  attackResolvedEvents,
  enemyAttackResolvedEvent,
  opportunityResolvedEvent,
  targetDodgeResolvedEvent,
} from './headlessCombatEvents'

const events: HeadlessCombatEvent[] = [
  { type: 'ap-spent', tokenId: 'goblin', amount: 1, before: 2, after: 1 },
  { type: 'ap-spent', tokenId: 'hero-token', characterId: 'hero', amount: 1, before: 2, after: 1 },
  {
    type: 'target-dodge-resolved',
    actorTokenId: 'hero-token',
    targetTokenId: 'goblin',
    d20Value: 12,
    attackBonus: 5,
    total: 17,
    targetAc: 14,
    dodged: false,
    reason: 'attempt',
    successChance: 0.35,
  },
  {
    type: 'attack-resolved',
    actorTokenId: 'hero-token',
    characterId: 'hero',
    targetTokenId: 'goblin',
    skillId: 'basic-shot',
    skillName: '基础射击',
    damageValues: [4],
    diceTotal: 4,
    baseDamage: 4,
    damageBeforeDefense: 4,
    modifier: 0,
    diff: 0,
    total: 4,
    isCrit: false,
    hit: true,
    targetDodged: false,
    waivedAp: false,
    apCost: 1,
  },
  {
    type: 'attack-resolved',
    actorTokenId: 'hero-token',
    characterId: 'hero',
    targetTokenId: 'goblin',
    skillId: 'multi-shot',
    skillName: '多重射击',
    damageValues: [2],
    diceTotal: 2,
    baseDamage: 2,
    damageBeforeDefense: 2,
    modifier: 0,
    diff: 0,
    total: 2,
    isCrit: false,
    hit: true,
    targetDodged: false,
    waivedAp: false,
    apCost: 1,
  },
  {
    type: 'enemy-attack-resolved',
    actorTokenId: 'goblin',
    targetTokenId: 'hero-token',
    actionName: '短弓',
    damageValues: [3],
    diceTotal: 3,
    damageBonus: 1,
    rawDamage: 4,
    damageBeforeDefense: 4,
    modifier: 0,
    diff: 0,
    total: 4,
    targetDodged: false,
  },
  {
    type: 'aoe-target-resolved',
    actorTokenId: 'hero-token',
    characterId: 'hero',
    targetTokenId: 'goblin',
    skillId: 'whirlwind',
    skillName: '旋风飞腿',
    damageValues: [3],
    diceTotal: 3,
    baseDamage: 3,
    damageBeforeSave: 3,
    modifier: 0,
    diff: 0,
    total: 3,
    waivedAp: false,
    apCost: 1,
  },
  {
    type: 'opportunity-resolved',
    attackerTokenId: 'goblin',
    targetTokenId: 'hero-token',
    d20Value: 15,
    attackBonus: 4,
    targetAc: 14,
    hit: true,
    isCrit: false,
    damageValues: [2],
    rawDamage: 2,
    damageBeforeDefense: 2,
    modifier: 0,
    diff: 0,
    total: 2,
  },
]

describe('headless combat event selectors', () => {
  it('finds typed resolved events', () => {
    expect(attackResolvedEvent(events)?.skillId).toBe('basic-shot')
    expect(attackResolvedEvents(events)).toHaveLength(2)
    expect(enemyAttackResolvedEvent(events)?.actorTokenId).toBe('goblin')
    expect(targetDodgeResolvedEvent(events)?.d20Value).toBe(12)
    expect(aoeTargetResolvedEvents(events)).toHaveLength(1)
    expect(opportunityResolvedEvent(events)?.hit).toBe(true)
  })

  it('filters AP events by token and character ownership', () => {
    const enemyAp = apSpentEvent(events, { tokenId: 'goblin', characterId: null })
    expect(enemyAp).toMatchObject({ after: 1 })
    expect(enemyAp).not.toHaveProperty('characterId')
    expect(apSpentEvent(events, { tokenId: 'hero-token', characterId: 'hero' })).toMatchObject({
      tokenId: 'hero-token',
      characterId: 'hero',
    })
    expect(apSpentEvent(events, { tokenId: 'hero-token', characterId: null })).toBeUndefined()
  })
})
