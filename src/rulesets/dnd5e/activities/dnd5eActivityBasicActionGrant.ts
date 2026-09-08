export const DND5E_ACTIVITY_BASIC_ACTION_GRANT_SCHEMA_VERSION = 1 as const

export type Dnd5eActivityBasicActionGrantActionV1 = 'dash' | 'grapple' | 'shove'

/**
 * A short-lived Host credential that lets an Activity replace the ordinary
 * action cost of a bounded basic action with a bonus action. The normal basic
 * action pipeline still owns movement, targets, contests and map validation.
 */
export interface Dnd5eActivityBasicActionGrantV1 {
  schemaVersion: typeof DND5E_ACTIVITY_BASIC_ACTION_GRANT_SCHEMA_VERSION
  grantId: string
  label: string
  sourceActivityId: string
  appliedTurnKey: string
  economy: 'bonus-action'
  actions: readonly Dnd5eActivityBasicActionGrantActionV1[]
  /** Extra distance added to the ordinary 5-foot successful shove. */
  shovePushDistanceBonusFeet?: number
}

export function dnd5eActivityBasicActionGrantMatchesV1(
  grant: Dnd5eActivityBasicActionGrantV1 | undefined,
  turnKey: string,
  action: Dnd5eActivityBasicActionGrantActionV1,
): grant is Dnd5eActivityBasicActionGrantV1 {
  return grant?.schemaVersion === DND5E_ACTIVITY_BASIC_ACTION_GRANT_SCHEMA_VERSION &&
    grant.appliedTurnKey === turnKey &&
    grant.economy === 'bonus-action' &&
    grant.actions.includes(action)
}
