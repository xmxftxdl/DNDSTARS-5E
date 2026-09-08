import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
  dnd5eTurnStartGazeRequirements,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
  type Dnd5eTurnStartGazeResolution,
} from './headlessCombatEngine'
import { validateDnd5eMonsterSchema } from './monsterSchema'
import { getDnd5eSrdMonster } from './monsters'

const abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } as const

function combatant(
  id: string,
  controller: 'dm' | 'player',
  initiative: number,
  patch: Partial<Dnd5eCombatant> = {},
): Dnd5eCombatant {
  return createDnd5eCombatant({
    id,
    name: id,
    controller,
    initiative,
    abilities,
    proficiencyBonus: 2,
    armorClass: 12,
    currentHp: 30,
    maxHp: 30,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}

function hezrouFixture(targetController: 'dm' | 'player' = 'player') {
  const source = combatant('hezrou', 'dm', 20, {
    statBlockId: 'srd-5.1:hezrou',
    creatureType: 'fiend',
  })
  const target = combatant('target', targetController, 10)
  const state = startDnd5eHeadlessCombat('hezrou-stench', [source, target])
  state.distanceFeetByCombatantPair = {
    [dnd5eCombatantPairKey(source.id, target.id)]: 10,
  }
  return { source, target, state }
}

function stenchSave(
  sourceId: string,
  targetId: string,
  d20: number,
): Dnd5eTurnStartGazeResolution {
  return {
    sourceId,
    targetId,
    ruleId: 'stench',
    sourceUsesGaze: true,
    choice: 'face-gaze',
    save: { d20 },
  }
}

describe('monster turn-start saving throw auras', () => {
  it.each([
    ['srd-5.1:ghast', 'stench', 5, 'any', 'con', 10, 'poisoned'],
    ['srd-5.1:hezrou', 'stench', 10, 'any', 'con', 14, 'poisoned'],
    ['srd-5.1:pit-fiend', 'fear-aura', 20, 'enemy', 'wis', 21, 'frightened'],
  ] as const)(
    'exposes %s as a validated Headless aura',
    (monsterId, ruleId, rangeFeet, relation, ability, dc, condition) => {
      const monster = getDnd5eSrdMonster(monsterId)
      expect(monster).toBeDefined()
      if (!monster) return

      expect(validateDnd5eMonsterSchema(monster)).toEqual([])
      expect(monster.traits).toContainEqual(expect.objectContaining({
        automation: 'headless',
        rule: {
          kind: 'turn-start-saving-throw-aura',
          ruleId,
          rangeFeet,
          relation,
          ability,
          dc,
          magical: false,
          condition,
          duration: 'until-target-next-turn-start',
          successfulSaveImmunityRounds: 14_400,
        },
      }))
    },
  )

  it('requires the Hezrou save even when both tokens share the DM controller', () => {
    const { state, target } = hezrouFixture('dm')

    expect(dnd5eTurnStartGazeRequirements(state, target.id)).toEqual([
      expect.objectContaining({
        ruleId: 'stench',
        featureName: '恶臭',
        ability: 'con',
        dc: 14,
        canAvertEyes: false,
        mandatory: true,
      }),
    ])
  })

  it('poisons on a failed save until the target next turn starts', () => {
    const { state, source, target } = hezrouFixture()
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'end-turn',
      actorId: source.id,
      turnStartGazeResolutions: [stenchSave(source.id, target.id, 1)],
    })

    expect(result.ok ? 'ok' : result.reason).toBe('ok')
    if (!result.ok) return
    expect(result.state.combatants[target.id].conditions).toContain('poisoned')
    expect(result.state.combatants[target.id].classState.activeEffects).toContainEqual(
      expect.objectContaining({
        standardCondition: 'poisoned',
        source: expect.objectContaining({ actorId: source.id, kind: 'monster' }),
        duration: expect.objectContaining({
          type: 'until-turn-boundary',
          boundary: 'target-turn-start',
        }),
      }),
    )
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'monster-turn-start-gaze-save-resolved',
      effectKind: 'aura',
      featureName: '恶臭',
      condition: 'poisoned',
      ability: 'con',
      dc: 14,
      success: false,
    }))
  })

  it('grants 24-hour source-bound immunity after a successful save', () => {
    const { state, source, target } = hezrouFixture()
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'end-turn',
      actorId: source.id,
      turnStartGazeResolutions: [stenchSave(source.id, target.id, 20)],
    })

    expect(result.ok ? 'ok' : result.reason).toBe('ok')
    if (!result.ok) return
    expect(result.state.combatants[target.id].conditions).not.toContain('poisoned')
    expect(result.state.combatants[target.id].classState.activeEffects).toContainEqual(
      expect.objectContaining({
        definitionId: expect.stringContaining('monster-aura-immunity:'),
        source: expect.objectContaining({ actorId: source.id, kind: 'monster' }),
        duration: { type: 'rounds', remainingRounds: 14_400, tickOn: 'target-turn-start' },
      }),
    )
    expect(dnd5eTurnStartGazeRequirements(result.state, target.id)).toEqual([])
  })
})
