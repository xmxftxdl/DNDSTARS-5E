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

/** Only explicit ownership in this room permits local DM rolls for a character. */
export function isDiceCharacterOwnedByCurrentDm(
  character: { roomId?: string; roomMemberId?: string; ownerAccountId?: string } | undefined,
  session: { roomId: string; memberId: string; role: string; accountId?: string } | null | undefined,
): boolean {
  return !!character && !!session && session.role === 'dm' &&
    character.roomId === session.roomId && !!character.roomMemberId &&
    character.roomMemberId === session.memberId &&
    (!character.ownerAccountId || character.ownerAccountId === session.accountId)
}
