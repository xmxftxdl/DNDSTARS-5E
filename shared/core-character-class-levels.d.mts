export const coreClassIdentities:readonly(readonly[string,string])[]
export function normalizeCoreCharacterClassLevels(character:{charClass?:unknown;level?:unknown;dnd5eClassLevels?:unknown}):Record<string,number>
/** undefined means unsupported custom/unknown identity, not a class level. */
export function readSupportedCoreCharacterClassLevel(character:unknown,classId:unknown):number|undefined
