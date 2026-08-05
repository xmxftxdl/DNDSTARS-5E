export interface MonsterTurnPlanningControl {
  signal: AbortSignal
  onSynchronousFallback?: (reason: string) => void
}

export type MonsterTurnPlanner<TInput, TPlan> = (
  input: TInput,
  control: MonsterTurnPlanningControl,
) => Promise<TPlan>

/**
 * Application-owned latest-wins boundary for expensive monster planning.
 *
 * The coordinator owns cancellation, while the caller owns presentation and
 * authority progress markers. A plan is only a proposal; executing movement,
 * attacks or resource costs remains a separate Host-authoritative transaction.
 */
export class MonsterTurnPlanningCoordinator<TInput, TPlan> {
  private activeController: AbortController | undefined
  private readonly planner: MonsterTurnPlanner<TInput, TPlan>

  constructor(planner: MonsterTurnPlanner<TInput, TPlan>) {
    this.planner = planner
  }

  get active(): boolean {
    return this.activeController != null
  }

  cancel(reason = 'Monster planning was cancelled.'): boolean {
    const controller = this.activeController
    if (!controller) return false
    this.activeController = undefined
    controller.abort(reason)
    return true
  }

  async plan(
    input: TInput,
    options: { onSynchronousFallback?: (reason: string) => void } = {},
  ): Promise<TPlan> {
    this.cancel('Monster planning was superseded by a newer battlefield snapshot.')
    const controller = new AbortController()
    this.activeController = controller
    try {
      return await this.planner(input, {
        signal: controller.signal,
        onSynchronousFallback: options.onSynchronousFallback,
      })
    } finally {
      if (this.activeController === controller) this.activeController = undefined
    }
  }
}
