import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
} from './headlessCombatEngine'
import { auditDnd5eMonsterHeadlessCoverage } from './monsterHeadlessCoverage'

function combatant(input: {
  id: string
  initiative: number
  controller: 'dm' | 'player'
  statBlockId?: string
  x?: number
}): Dnd5eCombatant {
  return createDnd5eCombatant({
    id: input.id,
    name: input.id,
    controller: input.controller,
    initiative: input.initiative,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2,
    armorClass: 10,
    currentHp: 200,
    maxHp: 200,
    temporaryHp: 0,
    speed: 30,
    position: { x: input.x ?? 0, y: 0 },
    concentrating: false,
    statBlockId: input.statBlockId,
  })
}

function dragonComposite(firstStep: 'use' | 'skip') {
  return {
    type: 'monster-multiattack-composite' as const,
    schemaVersion: 1 as const,
    actorId: 'dragon',
    actionId: 'multiattack',
    steps: [
      firstStep === 'skip'
        ? {
            kind: 'skip' as const,
            actionId: 'frightful-presence',
          }
        : {
            kind: 'area' as const,
            actionId: 'frightful-presence',
            resolution: {
              schemaVersion: 1 as const,
              targetIds: ['hero'],
              targetSavingThrows: [{ targetId: 'hero', d20: 1 }],
              damageRolls: [],
            },
          },
      {
        kind: 'weapon' as const,
        actionId: 'bite',
        roll: { targetId: 'hero', d20: 1, damageRolls: [] },
      },
      {
        kind: 'weapon' as const,
        actionId: 'claw',
        roll: { targetId: 'hero', d20: 1, damageRolls: [] },
      },
      {
        kind: 'weapon' as const,
        actionId: 'claw',
        roll: { targetId: 'hero', d20: 1, damageRolls: [] },
      },
    ],
  }
}

function state() {
  return startDnd5eHeadlessCombat('dragon-composite', [
    combatant({
      id: 'dragon',
      initiative: 20,
      controller: 'dm',
      statBlockId: 'srd-5.1:adult-black-dragon',
    }),
    combatant({ id: 'hero', initiative: 10, controller: 'player', x: 5 }),
  ])
}

describe('monster composite Multiattack', () => {
  it('settles Frightful Presence and three weapon attacks as one action', () => {
    const result = resolveDnd5eHeadlessAction(state(), dragonComposite('use'))

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.hero.conditions).toContain('frightened')
    expect(result.events.filter((event) =>
      event.type === 'attack-resolved')).toHaveLength(3)
    expect(result.events.filter((event) =>
      event.type === 'monster-area-action-resolved')).toHaveLength(1)
    expect(result.events.filter((event) =>
      event.type === 'turn-resource-spent' &&
      event.actorId === 'dragon' &&
      event.resource === 'action')).toHaveLength(1)
    expect(result.events).toContainEqual({
      type: 'monster-multiattack-composite-resolved',
      actorId: 'dragon',
      actionId: 'multiattack',
      resolvedActionIds: [
        'frightful-presence',
        'bite',
        'claw',
        'claw',
      ],
      skippedActionIds: [],
    })
  })

  it('supports the dragon rule’s optional Frightful Presence branch', () => {
    const result = resolveDnd5eHeadlessAction(state(), dragonComposite('skip'))

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.hero.conditions).not.toContain('frightened')
    expect(result.events.filter((event) =>
      event.type === 'attack-resolved')).toHaveLength(3)
    expect(result.events).toContainEqual({
      type: 'monster-multiattack-composite-resolved',
      actorId: 'dragon',
      actionId: 'multiattack',
      resolvedActionIds: ['bite', 'claw', 'claw'],
      skippedActionIds: ['frightful-presence'],
    })
  })

  it('does not allow a required weapon occurrence to be skipped', () => {
    const action = dragonComposite('skip')
    const result = resolveDnd5eHeadlessAction(state(), {
      ...action,
      steps: [
        action.steps[0],
        { kind: 'skip', actionId: 'bite' },
        action.steps[2],
        action.steps[3],
      ],
    })

    expect(result).toMatchObject({ ok: false, reason: 'invalid-monster-action' })
  })

  it('reports all adult and ancient dragon originals as executable Headless composites', () => {
    const rows = auditDnd5eMonsterHeadlessCoverage().actions.rows.filter((row) =>
      /^(?:adult|ancient)-.+-dragon$/.test(row.slug) &&
      row.actionId === 'multiattack')

    expect(rows).toHaveLength(20)
    expect(rows.map((row) => ({
      slug: row.slug,
      effectiveAutomation: row.effectiveAutomation,
      blockers: row.blockedChildIds,
    }))).toEqual(rows.map((row) => ({
      slug: row.slug,
      effectiveAutomation: 'headless',
      blockers: [],
    })))
  })
})
