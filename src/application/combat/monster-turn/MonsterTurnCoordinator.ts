import {
  MonsterTurnPlanningCoordinator,
  type MonsterTurnPlanner,
  type MonsterTurnPlanningControl,
} from './MonsterTurnPlanningCoordinator'

/**
 * Owns the identity and expensive planning phase of one automated monster turn.
 * Actual movement/attack commits remain in Host authority transactions.
 */
export class MonsterTurnCoordinator<TInput, TPlan> {
  private activeTurnKey: string | undefined
  private readonly planning: MonsterTurnPlanningCoordinator<TInput, TPlan>

  constructor(planner: MonsterTurnPlanner<TInput, TPlan>) {
    this.planning = new MonsterTurnPlanningCoordinator(planner)
  }

  get activePlanning(): boolean {
    return this.planning.active
  }

  begin(turnKey: string): void {
    if (this.activeTurnKey === turnKey) return
    this.planning.cancel('Monster turn identity changed.')
    this.activeTurnKey = turnKey
  }

  isCurrent(turnKey: string): boolean {
    return this.activeTurnKey === turnKey
  }

  async plan(
    input: TInput,
    options: Pick<MonsterTurnPlanningControl, 'onSynchronousFallback'> = {},
  ): Promise<TPlan> {
    return this.planning.plan(input, options)
  }

  complete(turnKey: string): boolean {
    if (this.activeTurnKey !== turnKey) return false
    this.activeTurnKey = undefined
    this.planning.cancel('Monster turn completed.')
    return true
  }

  cancel(reason = 'Monster turn was cancelled.'): void {
    this.activeTurnKey = undefined
    this.planning.cancel(reason)
  }
}
