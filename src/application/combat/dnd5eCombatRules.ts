/**
 * Application-facing D&D 5e combat facade.
 *
 * Presentation imports this boundary instead of reaching into individual
 * resolver modules. The facade intentionally contains no mutable state; the
 * RulesetAdapter and Headless engine remain the authoritative implementation.
 */
export * from '../../rulesets/dnd5e'
export * from '../../rulesets/dnd5e/mapMovementHazards'
export * from '../../rulesets/dnd5e/monsterStrategyLearning'
export * from '../../rulesets/dnd5e/monsterDynamicMultiattack'
export * from '../../rulesets/dnd5e/monsterMultiattackConstraints'
export * from '../../rulesets/dnd5e/legendaryActionWindow'
export * from '../../rulesets/dnd5e/webAreaRules'
export * from '../../rulesets/dnd5e/pluginSpellTargeting'
export * from '../../rulesets/dnd5e/activities/dnd5eActivityRollRecipe'
export * from '../../rulesets/dnd5e/activities/dnd5eActivityAutomaticRolls'
export * from '../../rulesets/dnd5e/activities/dnd5eActivityScaling'
export * from '../../rulesets/dnd5e/activities/dnd5eActivityHeadlessCompiler'
export * from '../../rulesets/dnd5e/activities/dnd5eActivityPerTargetRolls'
export * from '../../rulesets/dnd5e/activities/dnd5eSrdAuditedSpellActivities'
export * from '../../rulesets/dnd5e/spellMaterials'
export * from '../../rulesets/dnd5e/monsterTurnPlan'
export * from '../../rulesets/dnd5e/encounterBuilder'
export * from '../../rulesets/dnd5e/activities/dnd5eActivityChoices'
export * from '../../rulesets/dnd5e/magicMouth'
export * from '../../rulesets/dnd5e/sending'
export * from '../../rulesets/dnd5e/animalMessenger'
export * from '../../rulesets/dnd5e/mapObjectState'
export * from '../../rulesets/dnd5e/sequester'
