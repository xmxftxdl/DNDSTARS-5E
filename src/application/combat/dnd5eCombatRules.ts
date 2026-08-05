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
