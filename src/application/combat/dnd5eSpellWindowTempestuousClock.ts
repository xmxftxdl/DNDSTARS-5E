import type{PreparedDnd5eSpellCast}from'../../rulesets/dnd5e/spellAction'
export type{Dnd5eTempestuousLandingOriginalOperation}from'../../rulesets/dnd5e/damageCommitSession'
/** Lazy access preserves the canonical module instances. Mechanical time only;
 * this issues no Room, original-roll or world-publication authority. */
export async function captureDnd5eMastermindSpellWindowOriginalClock(original:{prepared:PreparedDnd5eSpellCast;firstHostNow:number}){
 const[{captureDnd5ePreparedSpellAttackWindow},{captureDnd5eSpellWindowOriginalSessionClock}]=await Promise.all([import('../../rulesets/dnd5e/spellAction'),import('../../rulesets/dnd5e/spellWindowOriginalSessionClock')])
 return captureDnd5eSpellWindowOriginalSessionClock(captureDnd5ePreparedSpellAttackWindow({prepared:original.prepared,attackIndex:0,preceding:[],now:original.firstHostNow}))
}
