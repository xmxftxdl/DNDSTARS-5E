/** A missing owner is an error, never permission for the DM to roll on someone's behalf. */
export interface DiceOwnership {
  rollerTokenId?: string
  rollerCharacterId?: string
  freeRoll?: boolean
}
export function assertDiceOwnership(owner: DiceOwnership): void {
  if (owner.freeRoll === true) return
  if (!owner.rollerTokenId?.trim() && !owner.rollerCharacterId?.trim()) {
    throw new Error('dice-owner-missing: 非自由投掷必须指定执行角色')
  }
}
