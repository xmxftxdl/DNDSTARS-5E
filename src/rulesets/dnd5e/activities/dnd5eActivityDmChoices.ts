import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import type { Dnd5eFormulaRollResult } from './dnd5eFormula'
import { dnd5eActivityLanguageChoicesV1 } from './dnd5eActivityChoices'
import { registerDnd5eHostReceipt, registerDnd5eHostReceiptSlot } from '../hostTransactionClone'

type Action = { actorId: string; pluginId: string; actionId: string; transactionId?: string; payload?: unknown }
type Rolls = Readonly<Record<string, Dnd5eFormulaRollResult>>
const authority = Symbol('host-activity-dm-choices')
registerDnd5eHostReceiptSlot(authority)
interface Receipt { identity: string; activityId: string; dice: string }

function identity(action: Action): string {
  const payload = action.payload && typeof action.payload === 'object' && !Array.isArray(action.payload)
    ? action.payload as Record<string, unknown> : undefined
  const choices = payload?.activityChoices
  return JSON.stringify([action.actorId, action.pluginId, action.actionId, action.transactionId,
    choices && typeof choices === 'object' && !Array.isArray(choices)
      ? Object.entries(choices).sort(([a], [b]) => a.localeCompare(b)) : []])
}

/** Reconstruct the eligible catalogue from the Host's installed definitions and actual die. */
export function dnd5eActivityDmChoicesV1(activity: Dnd5eActivityDefinitionV1, rolls: Rolls) {
  return (activity.choices ?? []).filter(choice => choice.dmSelection).map(choice => {
    const selection = choice.dmSelection!
    const check = activity.checks?.find(check => check.id === selection.afterCheckId)
    if (!check || check.kind !== 'random-roll' || check.scope !== 'shared' || check.count !== 1) throw Error('Invalid DM choice check')
    const values = rolls[check.rollId]?.values
    if (!values || values.length !== 1 || !Number.isSafeInteger(values[0]) || values[0] < 1 || values[0] > check.sides) throw Error('Missing authoritative DM choice die')
    const total = values[0] + (check.modifier ?? 0)
    const bands = selection.challengeRatingByTotal.filter(band => total >= band.minimum && total <= band.maximum)
    if (bands.length !== 1) throw Error('Ambiguous DM choice roll band')
    const maximumChallengeRating = Math.min(choice.monsterFilter?.maximumChallengeRating ?? 30, bands[0].maximumChallengeRating)
    const hydrated = dnd5eActivityLanguageChoicesV1({ ...activity, choices: [{ ...choice,
      defaultOptionId: undefined, monsterFilter: { ...choice.monsterFilter, maximumChallengeRating } }] }).choices![0]
    return { ...hydrated, label: `${choice.label}（掷骰 ${total}，CR ≤ ${maximumChallengeRating}）` }
  })
}

function diceIdentity(activity: Dnd5eActivityDefinitionV1, rolls: Rolls): string {
  return JSON.stringify((activity.choices ?? []).filter(choice => choice.dmSelection).map(choice => {
    const check = activity.checks?.find(check => check.id === choice.dmSelection!.afterCheckId)
    return [choice.id, check?.kind === 'random-roll' ? rolls[check.rollId]?.values : undefined]
  }))
}

/** Only the Host installs this capability after the DM answers. JSON cannot carry it. */
export function authorizeDnd5eActivityDmChoicesV1(action: Action, activity: Dnd5eActivityDefinitionV1, rolls: Rolls): void {
  delete (action as Action & { [authority]?: Receipt })[authority]
  if (!action.transactionId) throw Error('DM choice requires a transaction')
  const payload = action.payload as { activityChoices?: Record<string, string> } | undefined
  for (const choice of dnd5eActivityDmChoicesV1(activity, rolls)) {
    if (!choice.options.some(option => option.id === payload?.activityChoices?.[choice.id])) throw Error('Invalid DM creature choice')
  }
  const receipt = registerDnd5eHostReceipt(Object.freeze({ identity: identity(action), activityId: activity.id, dice: diceIdentity(activity, rolls) }))
  Object.defineProperty(action, authority, { value: receipt, enumerable: true, configurable: true })
}

export function dnd5eActivityDmChoicesAuthorizedV1(action: Action, activity: Dnd5eActivityDefinitionV1, rolls: Rolls): boolean {
  if (!activity.choices?.some(choice => choice.dmSelection)) return true
  const receipt = (action as Action & { [authority]?: Receipt })[authority]
  if (!receipt || receipt.identity !== identity(action) || receipt.activityId !== activity.id || receipt.dice !== diceIdentity(activity, rolls)) return false
  try {
    const payload = action.payload as { activityChoices?: Record<string, string> } | undefined
    return dnd5eActivityDmChoicesV1(activity, rolls).every(choice => choice.options.some(option => option.id === payload?.activityChoices?.[choice.id]))
  } catch { return false }
}
