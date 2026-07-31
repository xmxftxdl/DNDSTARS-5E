import type {
  Dnd5eMonsterAction,
  Dnd5eMonsterStatBlock,
} from './monsters'

export const DND5E_HYDRA_INITIAL_HEAD_COUNT = 5
export const DND5E_HYDRA_HEAD_DAMAGE_THRESHOLD = 25
export const DND5E_HYDRA_HIT_POINTS_PER_REGROWN_HEAD = 10

/**
 * A deliberately generous safety ceiling for persisted/runtime state.
 *
 * The SRD does not put a gameplay ceiling on a hydra's heads, but an invalid
 * save must not be able to manufacture an unbounded attack payload.
 */
export const DND5E_HYDRA_MAX_RUNTIME_HEAD_COUNT = 1_000

export interface Dnd5eHydraRuntimeClassState {
  monsterHydraHeadCount?: number
  monsterHydraHeadsLostSinceLastTurn?: number
  monsterHydraDamageTurnKey?: string
  monsterHydraDamageTakenThisTurn?: number
  monsterHydraHeadSeveredTurnKey?: string
  monsterHydraFireDamageSinceLastTurn?: boolean
}

export interface Dnd5eMonsterRuntimeMultiattackActor {
  statBlockId?: string
  classState: Dnd5eHydraRuntimeClassState
}

export function dnd5eNormalizedHydraHeadCount(value: unknown): number {
  return Number.isInteger(value) && Number(value) >= 0
    ? Math.min(DND5E_HYDRA_MAX_RUNTIME_HEAD_COUNT, Number(value))
    : DND5E_HYDRA_INITIAL_HEAD_COUNT
}

export function dnd5eHydraHeadCount(
  actor: Pick<Dnd5eMonsterRuntimeMultiattackActor, 'classState'>,
): number {
  return dnd5eNormalizedHydraHeadCount(
    actor.classState.monsterHydraHeadCount,
  )
}

export function dnd5eMonsterIsHydra(
  monster: Pick<Dnd5eMonsterStatBlock, 'id' | 'slug'>,
  actor?: Pick<Dnd5eMonsterRuntimeMultiattackActor, 'statBlockId'>,
): boolean {
  return monster.slug === 'hydra' &&
    (actor?.statBlockId == null || actor.statBlockId === monster.id)
}

export interface Dnd5eMonsterMultiattackRuntimeActionIdsInput {
  monster:
    Pick<Dnd5eMonsterStatBlock, 'actions'> &
    Partial<Pick<Dnd5eMonsterStatBlock, 'id' | 'slug'>>
  action: Pick<
    Dnd5eMonsterAction,
    'id' | 'kind' | 'sequence' | 'randomRepeat'
  >
  actor?: Dnd5eMonsterRuntimeMultiattackActor
  /** The authoritative die result for a random-repeat declaration. */
  randomRepeatCount?: number
  /**
   * Planners can explicitly request a deterministic estimate when the Host
   * has not rolled a random-repeat count yet. The rules core leaves this at
   * `reject` so a missing authoritative roll remains invalid.
   */
  unresolvedRandomRepeat?: 'reject' | 'minimum' | 'maximum'
}

/**
 * Expands a catalog Multiattack against the actor's current runtime state.
 *
 * Fixed declarations keep using their catalog sequence. Hydra is the one SRD
 * declaration whose repeat count is state-derived: its current number of
 * heads is authoritative, so no extra client-authored count is accepted.
 */
export function dnd5eMonsterMultiattackRuntimeActionIds(
  input: Dnd5eMonsterMultiattackRuntimeActionIdsInput,
): readonly string[] | undefined {
  const { action, monster } = input
  if (action.kind !== 'multiattack') return undefined

  if (
    action.id === 'multiattack' &&
    input.actor &&
    monster.id != null &&
    monster.slug != null &&
    dnd5eMonsterIsHydra(
      monster as Pick<Dnd5eMonsterStatBlock, 'id' | 'slug'>,
      input.actor,
    )
  ) {
    const biteActionId =
      action.sequence?.find((actionId) =>
        monster.actions.some((candidate) =>
          candidate.id === actionId && candidate.kind === 'weapon-attack',
        ),
      ) ??
      (monster.actions.some((candidate) =>
        candidate.id === 'bite' && candidate.kind === 'weapon-attack',
      )
        ? 'bite'
        : undefined)
    if (!biteActionId) return undefined
    return Array.from(
      { length: dnd5eHydraHeadCount(input.actor) },
      () => biteActionId,
    )
  }

  if (action.randomRepeat) {
    const repeatCount = input.randomRepeatCount ??
      (input.unresolvedRandomRepeat === 'minimum'
        ? action.randomRepeat.minimum
        : input.unresolvedRandomRepeat === 'maximum'
          ? action.randomRepeat.maximum
          : undefined)
    if (
      !Number.isInteger(repeatCount) ||
      repeatCount! < action.randomRepeat.minimum ||
      repeatCount! > action.randomRepeat.maximum ||
      repeatCount! > action.randomRepeat.dieSides
    ) return undefined
    return Array.from(
      { length: repeatCount! },
      () => action.randomRepeat!.actionId,
    )
  }

  if (input.randomRepeatCount != null || !action.sequence) return undefined
  return [...action.sequence]
}
