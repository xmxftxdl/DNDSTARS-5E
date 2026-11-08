/** Call only for a canonical character loaded from the authenticated current
 * room authority. Player upload merging cannot create or clear this Host-managed
 * unassigned state. Display names, NPC flags and incoming commands are ignored. */
export function secondChanceCanonicalControllerMemberId(character,host){
 if(!character||typeof character!=='object'||!host?.roomId||!host.hostMemberId)return undefined
 const room=typeof character.roomId==='string'&&character.roomId.trim()?character.roomId:undefined
 const member=typeof character.roomMemberId==='string'&&character.roomMemberId.trim()?character.roomMemberId:undefined
 if(room&&room!==host.roomId)return undefined
 return member??host.hostMemberId
}
