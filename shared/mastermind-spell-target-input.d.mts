import type{Dnd5eSpellTargetAttackRoll}from'../src/rulesets/dnd5e/headlessCombatEngine'
export type MastermindSpellTargetExtras=Omit<Dnd5eSpellTargetAttackRoll,'targetId'|'d20'|'d20Second'|'effectRolls'|'coverAttackRedirect'>
/** Pure data shape only; never an authority or native capability predicate. */
export function validMastermindSpellTargetExtras(value:unknown,original:{d20:number;d20Second?:number;effectRolls:readonly number[]}):value is MastermindSpellTargetExtras
