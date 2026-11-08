
type Row={frame:unknown;prefixSignature:string;choice?:Record<string,unknown>}
const data=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v),same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
/** A narrow input comparator, never a raw-pool or world permission. The server
 * separately requires the completed private saving-late ledger stamp. */
export function bountifulDamageZeroBardicChoicesAppend(before:unknown,after:unknown):boolean{
 if(!Array.isArray(before)||!Array.isArray(after)||before.length!==1||after.length!==1)return false
 const old=before[0]as Row,next=after[0]as Row;if(!data(old)||!data(next)||!same(old.frame,next.frame)||old.prefixSignature!==next.prefixSignature||!data(old.choice)||!data(next.choice))return false
 const{bardicInspirationRoll:oldRoll,...oldChoice}=old.choice,{bardicInspirationRoll:nextRoll,...nextChoice}=next.choice
 return oldRoll===undefined&&typeof nextRoll==='number'&&Number.isInteger(nextRoll)&&nextRoll>=1&&nextRoll<=12&&same({...oldChoice,legendaryResistance:oldChoice.legendaryResistance??false},{...nextChoice,legendaryResistance:nextChoice.legendaryResistance??false})&&same({...old,choice:next.choice},next)
}
