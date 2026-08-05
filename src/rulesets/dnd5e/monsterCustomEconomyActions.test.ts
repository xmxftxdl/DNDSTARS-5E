import { afterEach, describe, expect, it } from 'vitest'
import {
  buildDnd5eCustomMonster,
  createDnd5eCustomMonsterDraft,
} from './customMonsterWorkshop'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'
import { registerDnd5ePluginMonsterCatalogEntry } from './roomMonsterCatalog'

const disposers: Array<() => void> = []

afterEach(() => {
  while (disposers.length > 0) disposers.pop()?.()
})

function setup() {
  const draft = createDnd5eCustomMonsterDraft()
  const trigger = {
    ...draft.actions[0],
    id: 'trigger-strike',
    name: '触发攻击',
    toHit: 6,
    damageDice: '1d6+4',
    damageType: 'bludgeoning' as const,
  }
  const bonus = {
    ...trigger,
    id: 'quick-strike',
    name: '迅捷攻击',
    category: 'bonus-action' as const,
  }
  const reaction = {
    ...trigger,
    id: 'follow-up-reaction',
    name: '追击反应',
    category: 'reaction' as const,
    reactionTriggerActionId: trigger.id,
  }
  draft.actions = [trigger, bonus, reaction]
  const built = buildDnd5eCustomMonster(draft)
  const monster = {
    ...built,
    id: 'room-monster:custom-economy-test',
    slug: 'custom-economy-test',
  }
  disposers.push(registerDnd5ePluginMonsterCatalogEntry(monster))
  const actor = createDnd5eCombatant({
    id: 'monster', name: monster.name, controller: 'dm', initiative: 20,
    abilities: monster.abilities, proficiencyBonus: 2, armorClass: 12,
    currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30,
    position: { x: 0, y: 0 }, concentrating: false, statBlockId: monster.id,
  })
  const target = createDnd5eCombatant({
    id: 'target', name: '目标', controller: 'player', initiative: 10,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2, armorClass: 14, currentHp: 50, maxHp: 50,
    temporaryHp: 0, speed: 30, position: { x: 5, y: 0 }, concentrating: false,
  })
  return startDnd5eHeadlessCombat('custom-economy-actions', [actor, target])
}

const attackRoll = {
  targetId: 'target',
  d20: 10,
  damageRolls: [[4]],
} as const

describe('自定义怪物附赠动作与绑定反应', () => {
  it('通过怪物目录事务消耗附赠动作而保留普通动作', () => {
    const result = resolveDnd5eHeadlessAction(setup(), {
      type: 'monster-bonus-action',
      actorId: 'monster',
      actionId: 'quick-strike',
      rolls: [attackRoll],
    })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.monster.turn).toMatchObject({
      actionAvailable: true,
      bonusActionAvailable: false,
    })
    expect(result.state.combatants.target.currentHp).toBe(42)
    expect(result.events).toContainEqual({
      type: 'turn-resource-spent', actorId: 'monster', resource: 'bonusAction',
    })
  })

  it('只允许在绑定动作完成后使用一次反应', () => {
    const initial = setup()
    const rejected = resolveDnd5eHeadlessAction(initial, {
      type: 'monster-reaction-action',
      actorId: 'monster',
      actionId: 'follow-up-reaction',
      rolls: [attackRoll],
    })
    expect(rejected).toMatchObject({ ok: false, reason: 'invalid-monster-action' })

    const trigger = resolveDnd5eHeadlessAction(initial, {
      type: 'monster-action',
      actorId: 'monster',
      actionId: 'trigger-strike',
      rolls: [attackRoll],
    })
    expect(trigger.ok, trigger.ok ? undefined : trigger.reason).toBe(true)
    if (!trigger.ok) return
    expect(trigger.state.combatants.monster.classState.monsterReactionTriggerPending)
      .toMatchObject({
        sourceActionId: 'trigger-strike',
        reactionActionIds: ['follow-up-reaction'],
      })

    const reaction = resolveDnd5eHeadlessAction(trigger.state, {
      type: 'monster-reaction-action',
      actorId: 'monster',
      actionId: 'follow-up-reaction',
      rolls: [attackRoll],
    })
    expect(reaction.ok, reaction.ok ? undefined : reaction.reason).toBe(true)
    if (!reaction.ok) return
    expect(reaction.state.combatants.monster.turn.reactionAvailable).toBe(false)
    expect(reaction.state.combatants.monster.classState.monsterReactionTriggerPending).toBeUndefined()
    expect(reaction.state.combatants.target.currentHp).toBe(34)

    expect(resolveDnd5eHeadlessAction(reaction.state, {
      type: 'monster-reaction-action',
      actorId: 'monster',
      actionId: 'follow-up-reaction',
      rolls: [attackRoll],
    })).toMatchObject({ ok: false, reason: 'invalid-monster-action' })
  })
})
