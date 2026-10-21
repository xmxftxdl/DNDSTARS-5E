export const TEMPLE_HOSTILE_TYPES = ['celestial','elemental','fey','fiend','undead']
/** Host-captured policy, not a request to bypass an entry save. */
export function normalizeTempleWard(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['hostileCreatureTypes','saveDc','healingBonus','lighting'].includes(k)))return undefined
 const {hostileCreatureTypes,saveDc,healingBonus,lighting}=value
 if(!Array.isArray(hostileCreatureTypes)||hostileCreatureTypes.length<1||hostileCreatureTypes.length>5||
  new Set(hostileCreatureTypes).size!==hostileCreatureTypes.length||hostileCreatureTypes.some(t=>!TEMPLE_HOSTILE_TYPES.includes(t))||
  !Number.isSafeInteger(saveDc)||saveDc<1||saveDc>40||!Number.isSafeInteger(healingBonus)||healingBonus<1||healingBonus>1000||
  !['none','dim','bright'].includes(lighting))return undefined
 return {hostileCreatureTypes:[...hostileCreatureTypes],saveDc,healingBonus,lighting}
}
