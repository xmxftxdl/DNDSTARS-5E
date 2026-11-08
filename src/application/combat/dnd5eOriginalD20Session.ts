/** Preserve the existing deferred ruleset import and the original module instance. */
export type Dnd5eOriginalD20SessionModule=typeof import('../../rulesets/dnd5e/damageCommitSession')
export function loadDnd5eOriginalD20Session():Promise<Dnd5eOriginalD20SessionModule>{return import('../../rulesets/dnd5e/damageCommitSession')}
