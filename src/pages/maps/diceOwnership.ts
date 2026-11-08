import { secondChanceCanonicalControllerMemberId } from '../../../shared/second-chance-controller.mjs'
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

/** Canonical unassigned characters belong to this room Host; explicit player,
 * foreign-room and account ownership still prohibit a local DM roll. */
export function isDiceCharacterOwnedByCurrentDm(
  character: { roomId?: string; roomMemberId?: string; ownerAccountId?: string } | undefined,
  session: { roomId: string; memberId: string; role: string; accountId?: string } | null | undefined,
): boolean {
  return !!character && !!session && session.role === 'dm' &&
    secondChanceCanonicalControllerMemberId(character,{roomId:session.roomId,hostMemberId:session.memberId}) === session.memberId &&
    (!character.ownerAccountId || character.ownerAccountId === session.accountId)
}

/** Use the authenticated room controller, independently of a token's faction. */
export function isDiceCharacterControlledByRemotePlayer(
 character:{roomId?:string;roomMemberId?:string;ownerAccountId?:string}|undefined,
 session:{roomId:string;memberId:string;role:string;accountId?:string}|null|undefined,
):boolean{
 if(!character||!session||session.role!=='dm')return false
 const controller=secondChanceCanonicalControllerMemberId(character,{roomId:session.roomId,hostMemberId:session.memberId})
 return !!controller&&controller!==session.memberId
}
