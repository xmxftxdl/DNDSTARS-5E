import { describe, expect, it, vi } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import type { Dnd5eActiveEffectInstance } from './activeEffects'
import type { MonsterDecisionCandidate } from './monsterDecisionContracts'
import {
  createMonsterEscapeDecisionCandidates,
  createMonsterReleaseDecisionCandidates,
} from './monsterControlCandidateGenerators'
import type { Dnd5eMonsterStatBlock } from './monsters'
import type { Dnd5eMonsterTurnPlan } from './monsterTurnPlan'

function token(id: string): Token {
  return { id, label: id, type: 'enemy', x: 0, y: 0 } as Token
}

const monster = { id: 'test:monster' } as Dnd5eMonsterStatBlock

describe('monster control candidate generators', () => {
  it('creates an action escape candidate from a live source-linked effect', () => {
    const enemy = token('enemy')
    const source = token('source')
    const effect = {
      id: 'effect:restrained',
      source: { actorId: source.id, rulesId: 'test:snare' },
      escapeCheck: { economy: 'action', dc: 14, ability: 'str' },
    } as Dnd5eActiveEffectInstance
    const restrainedEffect = {
      id: 'effect:restrained:condition',
      source: { actorId: source.id, rulesId: 'test:snare' },
      standardCondition: 'restrained',
      dependsOnEffectId: effect.id,
    } as Dnd5eActiveEffectInstance
    const candidates = createMonsterEscapeDecisionCandidates({
      map: { tokens: [enemy, source] } as BattleMap,
      enemy,
      monster,
      characters: [],
      canUseAction: true,
      reconciledActiveEffects: { revision: 1 },
    }, {
      activeEffects: () => [effect, restrainedEffect],
      hitPoints: (target) => ({ current: target.id === source.id ? 5 : 10, maximum: 10 }),
      linkedRootEffects: () => [effect],
      successProbability: () => 0.5,
    })

    expect(candidates).toHaveLength(1)
    expect(candidates[0]?.payload.escapeActiveEffect).toEqual({ effectId: effect.id, dc: 14 })
    expect(candidates[0]?.metrics.controlValue).toBe(60)
  })

  it('wraps only newly unlocked tactical candidates after releasing a grapple', () => {
    const enemy = token('enemy')
    const held = token('held')
    const nextTarget = token('next')
    const effect = {
      id: 'effect:grapple',
      source: { actorId: enemy.id, rulesId: 'basic-action:grapple' },
      relation: { sourceActorId: enemy.id },
    } as Dnd5eActiveEffectInstance
    const unlocked = {
      id: 'attack:next',
      kind: 'attack',
      payload: { moved: false, attacked: true, message: '攻击下一目标。' },
      metrics: {
        expectedDamage: 4,
        targetCurrentHp: 8,
        targetMaximumHp: 8,
        hitProbability: 0.5,
        targetDistanceFeet: 5,
        preferredDistanceFeet: 5,
        movementFeet: 0,
        distanceImprovementFeet: 0,
        defensiveCoverBonus: 0,
        opportunityAttackRisk: 0,
        attacksThisTurn: true,
        consumesAction: true,
        dodges: false,
        dashes: false,
        usesNimbleEscape: false,
        usesPreciseCoverRoute: false,
      },
    } satisfies MonsterDecisionCandidate<Dnd5eMonsterTurnPlan>
    const tacticalCandidates = vi.fn(() => [unlocked])
    const candidates = createMonsterReleaseDecisionCandidates({
      map: { tokens: [enemy, held, nextTarget] } as BattleMap,
      enemy,
      monster,
      targets: [nextTarget],
      characters: [],
      canUseBonusAction: false,
      canUseAction: true,
      reconciledActiveEffects: { revision: 1 },
      currentTacticalCandidates: [],
    }, {
      linkedRootEffects: (target) => target.id === held.id ? [effect] : [],
      activeEffectsAfterRelease: () => ({ revision: 2 }),
      tacticalCandidates,
    })

    expect(tacticalCandidates).toHaveBeenCalledOnce()
    expect(candidates).toHaveLength(1)
    expect(candidates[0]?.payload.releaseGrapple).toEqual({ targetId: held.id, effectId: effect.id })
    expect(candidates[0]?.payload.message).toContain('释放对 held 的控制')
  })
})
