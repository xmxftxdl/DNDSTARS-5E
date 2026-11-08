import{readCapturedDnd5ePreparedSpellAttackWindow,resolvePreparedDnd5eSpellCast,type Dnd5ePreparedSpellAttackWindow}from'./spellAction'

/** Mechanical continuity only: this opaque clock is neither a Room source,
 * original-roll issuer, reaction answer nor a world-publication permission. */
export interface Dnd5eSpellWindowOriginalSessionClock{readonly spellWindowOriginalSessionClock:unique symbol}
type Source=Parameters<typeof resolvePreparedDnd5eSpellCast>[0]
const issued=new WeakMap<object,{window:Dnd5ePreparedSpellAttackWindow;parentId:string;effectTimestamp:number;preparedSignature:string}>()
export function captureDnd5eSpellWindowOriginalSessionClock(window:Dnd5ePreparedSpellAttackWindow):Dnd5eSpellWindowOriginalSessionClock{
 const actual=readCapturedDnd5ePreparedSpellAttackWindow(window)
 if(actual.attackIndex!==0||actual.stage!=='target'||actual.preceding.length||actual.prepared.action.sourceMode!=='dm'||actual.prepared.action.id!==actual.parentId||!Number.isSafeInteger(actual.now)||actual.now<=0)throw Error('spell-window-clock:actual-first-host-native-window-required')
 const cap=Object.freeze({})as Dnd5eSpellWindowOriginalSessionClock;issued.set(cap,{window,parentId:actual.parentId,effectTimestamp:actual.now,preparedSignature:JSON.stringify(actual.prepared)});return cap
}
export function readDnd5eSpellWindowOriginalSessionClock(cap:Dnd5eSpellWindowOriginalSessionClock,source:Source,resolve:unknown){
 const entry=issued.get(cap);if(!entry||resolve!==resolvePreparedDnd5eSpellCast)throw Error('spell-window-clock:actual-canonical-window-required')
 const current=()=>{try{const actual=readCapturedDnd5ePreparedSpellAttackWindow(entry.window);return actual.parentId===entry.parentId&&actual.now===entry.effectTimestamp&&JSON.stringify(actual.prepared)===entry.preparedSignature&&JSON.stringify(source.prepared)===entry.preparedSignature&&source.prepared.action.id===entry.parentId}catch{return false}}
 if(!current())throw Error('spell-window-clock:same-live-prepared-required')
 return{parentId:entry.parentId,effectTimestamp:entry.effectTimestamp,current}
}
