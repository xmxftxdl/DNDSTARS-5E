import type { BattleMap, Token } from '../../store/maps'
import { dnd5eCombatTokenSide } from '../../lib/opportunityAttacks'
import {
  dnd5eMonsterAreaSavingThrowEffect,
  getDnd5eSrdMonster,
  type Dnd5eMonsterAction,
} from './monsters'
import { dnd5eMonsterActionAutomation } from './monsterSchema'

export interface Dnd5eLegendaryActionWindowAction {
  actionIndex: number
  id: string
  name: string
  description: string
  cost: number
  affordable: boolean
  automation: 'headless' | 'dm-adjudication' | 'invalid'
  /**
   * Transient presentation route derived from the registered mechanic. This is
   * deliberately not another persisted executionMode: the map only asks for
   * the missing target/placement choice before submitting the normal Headless
   * transaction.
   */
  windowExecution:
    | 'targeted-attack'
    | 'area-action'
    | 'ability-check'
    | 'wing-attack'
    | 'movement-selection'
    | 'teleport-placement'
    | 'spell-selection'
    | 'dm-adjudication'
}

export interface Dnd5eLegendaryActionWindowCandidate {
  token: Token
  currentPoints: number
  maximumPoints: number
  actions: readonly Dnd5eLegendaryActionWindowAction[]
}

function isWindowTargetedAttack(
  action: Dnd5eMonsterAction,
  monsterActions: readonly Dnd5eMonsterAction[],
): boolean {
  const resolved = action.referencedActionId
    ? monsterActions.find((candidate) => candidate.id === action.referencedActionId)
    : action
  return resolved?.kind === 'weapon-attack' && !!resolved.attack
}

function isWindowSpellSelection(
  action: Dnd5eMonsterAction,
  hasMonsterSpellcasting: boolean,
): boolean {
  // The generated SRD catalogue predates the unified Activity selection
  // operation. Keep this legacy recognition at the catalogue boundary; each
  // selected spell is still checked against its registered core handler.
  return hasMonsterSpellcasting && action.kind === 'other' &&
    (
      /(?:^|-)cast-a-spell(?:-|$)/.test(action.id) ||
      action.id === 'cantrip'
    )
}

function isSuspendedByActivityExtraTurns(token: Token): boolean {
  return token.dnd5eCombatState?.activeEffects?.some((effect) =>
    !effect.suspendedBy?.length &&
    effect.definitionId.startsWith('activity-extra-turns:suspension:'),
  ) === true
}

/**
 * Builds the DM end-of-turn legendary-action window from the live map snapshot.
 * A creature never receives its own window, and defeated or point-starved
 * legendary creatures are omitted rather than producing nuisance prompts.
 */
export function dnd5eLegendaryActionWindowCandidates(input: {
  map: BattleMap
  endingTokenId: string
}): readonly Dnd5eLegendaryActionWindowCandidate[] {
  return input.map.tokens.flatMap((token) => {
    if (
      token.id === input.endingTokenId ||
      token.type !== 'enemy' ||
      dnd5eCombatTokenSide(token) !== 'enemy' ||
      (token.hp ?? token.maxHp ?? 1) <= 0 ||
      isSuspendedByActivityExtraTurns(token) ||
      !token.poolId
    ) return []
    const monster = getDnd5eSrdMonster(token.poolId)
    if (!monster?.legendaryActions?.length) return []
    const maximumPoints = Math.max(0, monster.legendaryActionPoints ?? 3)
    const currentPoints = Math.max(
      0,
      Math.min(
        maximumPoints,
        token.dnd5eCombatState?.monsterLegendaryActionPoints ?? maximumPoints,
      ),
    )
    if (currentPoints <= 0) return []
    return [{
      token,
      currentPoints,
      maximumPoints,
      actions: monster.legendaryActions.map((action, actionIndex) => {
        const cost = Math.max(1, action.legendaryCost ?? 1)
        const automation = dnd5eMonsterActionAutomation(action)
        return {
          actionIndex,
          id: action.id,
          name: action.name,
          description: action.description,
          cost,
          affordable: currentPoints >= cost,
          automation,
          windowExecution: action.rule?.kind === 'teleport'
            ? 'teleport-placement'
            : isWindowSpellSelection(action, !!monster.spellcasting)
              ? 'spell-selection'
              : automation !== 'headless'
                ? 'dm-adjudication'
                : action.rule?.kind === 'ability-check'
                  ? 'ability-check'
                : action.rule?.kind === 'legendary-wing-attack'
                  ? 'wing-attack'
                : action.rule?.kind === 'grant-movement'
                  ? 'movement-selection'
                : isWindowTargetedAttack(action, monster.actions)
              ? 'targeted-attack'
              : dnd5eMonsterAreaSavingThrowEffect(action)
                ? 'area-action'
                : 'dm-adjudication',
        }
      }),
    }]
  })
}
