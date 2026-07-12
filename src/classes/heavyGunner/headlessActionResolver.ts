import { classCombatActionAvailable } from '../../lib/classDefinitionRegistry'
import {
  registerHeadlessClassCombatActionResolver,
  type HeadlessClassCombatActionContext,
} from '../../lib/classCombatActionRegistry'
import {
  BULLET_CELL_COUNT,
  BULLET_TYPE_COUNT,
  createSeededBulletRandom,
  planSwapCascade,
} from '../../lib/bulletMatch'

function resolveBulletMatchSwap(context: HeadlessClassCombatActionContext) {
  const { state, action, events, services } = context
  if (action.type !== 'bullet-match-swap') return services.fail('invalid-action')
  const actorToken = state.map.tokens.find((item) => item.id === action.actorTokenId)
  const actor = services.findCharacter(action.characterId)
  if (
    !actorToken ||
    actorToken.type !== 'player' ||
    actorToken.characterId !== action.characterId ||
    !actor ||
    actor.currentHp <= 0 ||
    !classCombatActionAvailable(actor, action.type)
  ) {
    return services.fail('invalid-actor')
  }
  if (services.currentTurnTokenId() !== actorToken.id) return services.fail('stale-turn')
  const puzzle = actor.bulletPuzzle
  if (puzzle?.grid.length !== BULLET_CELL_COUNT || puzzle.ready.length !== BULLET_TYPE_COUNT) {
    return services.fail('invalid-action')
  }
  const plan = planSwapCascade(puzzle, action.from, action.to, createSeededBulletRandom(action.seed))
  if (!plan) return services.fail('invalid-action')
  if (!services.spendCharacterAp(actor.id, actorToken.id, 1)) return services.fail('insufficient-ap')
  services.updateCharacter(actor.id, (item) => ({
    ...item,
    bulletPuzzle: { grid: plan.finalGrid, ready: plan.finalReady },
  }))
  events.push({ type: 'log', text: `${actor.name} 调整弹仓并完成 ${plan.steps.length} 段连锁。` })
  return services.succeed()
}

export function registerHeavyGunnerHeadlessActionResolvers(): void {
  registerHeadlessClassCombatActionResolver('bullet-match-swap', resolveBulletMatchSwap)
}
