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
export * from '../../rulesets/dnd5e/companionMovementAction'
export * from '../../rulesets/dnd5e/companionOrderExecution'
export * from '../../rulesets/dnd5e/encounterBuilder'
export * from '../../rulesets/dnd5e/activities/dnd5eActivityChoices'
export * from '../../rulesets/dnd5e/magicMouth'
export * from '../../rulesets/dnd5e/sending'
export * from '../../rulesets/dnd5e/animalMessenger'
export * from '../../rulesets/dnd5e/mapObjectState'
export * from '../../rulesets/dnd5e/sequester'

export * from '../../rulesets/dnd5e/activities/dnd5eActivityRolledChoices'
export * from '../../rulesets/dnd5e/activities/dnd5eActivityDmChoices'

// Preserve direct canonical bindings across the broad ruleset barrel cycle.
export {dnd5eHasBountifulOriginalReadySource} from '../../rulesets/dnd5e/headlessCombatEngine'
export {dnd5eHeldBardicInspirationDie} from '../../rulesets/dnd5e/headlessCombatEngine'
export {dnd5eDarkOnesOwnLuckAvailable} from '../../rulesets/dnd5e/headlessCombatEngine'
export {dnd5eSavingThrowRerollFeature} from '../../rulesets/dnd5e/headlessCombatEngine'
export {resolveDnd5eHeadlessAction} from '../../rulesets/dnd5e/headlessCombatEngine'
export {dnd5eCombatantCoverRedirectFeatureIds} from '../../rulesets/dnd5e/headlessCombatEngine'
export {dnd5eCoverAttackRedirectEligible} from '../../rulesets/dnd5e/headlessCombatEngine'
export {dnd5eAttackAttemptWardRequirements} from '../../rulesets/dnd5e/headlessCombatEngine'
export {dnd5eHeadlessTurnKey} from '../../rulesets/dnd5e/headlessCombatEngine'

export{readDnd5eActualBeginTurnResult}from'../../rulesets/dnd5e/beginTurnAction'
export * from '../../rulesets/dnd5e/bountifulNativeLuckyRoomChoice'
export{prepareDnd5eInitiativeOriginal,prepareDnd5eInitiativeOriginalContinuation,resolvePreparedDnd5eInitiativeOriginal,type PreparedDnd5eInitiativeOriginal}from'../../rulesets/dnd5e/initiativeOriginal'

export{prepareDnd5eInitiativeCombatStart,readPreparedDnd5eInitiativeCombatStart}from'../../rulesets/dnd5e/initiativeOriginal'

export{withDnd5eInitiativeCombatStartForBegin}from'../../rulesets/dnd5e/initiativeOriginal'

export * from '../../rulesets/dnd5e/activities/dnd5eActivityOpposedChecks'

export{captureDnd5eSpellWardSavingOriginal,createDnd5eSpellWardSavingProbe,resolveDnd5eSpellWardSavingProbe,disposeDnd5eSpellWardSavingOriginal,assertDnd5eSpellWardSavingHasNoPendingReaction}from'../../rulesets/dnd5e/spellWardSavingOriginal'

export{loadDnd5eOriginalD20Session,type Dnd5eOriginalD20SessionModule}from'./dnd5eOriginalD20Session'

export{completeDnd5eSpellWardSavingReplay,completeDnd5eSpellWardSavingReplayChain,type Dnd5eSpellWardSavingReplayCheckpoint,withDnd5eSpellWardSavingReplay,readDnd5eSpellWardSavingReplayState}from'../../rulesets/dnd5e/spellWardSavingReplayPort'

export * from '../../rulesets/dnd5e/bountifulDeathRepeatDiceRoute'
export * from '../../rulesets/dnd5e/bountifulDeathRepeatPageCollector'
export * from '../../rulesets/dnd5e/bountifulDeathRepeatPageScope'
export {resolveBountifulDeathRepeatForNormalAck} from '../../rulesets/dnd5e/bountifulLuckNormalAck'

export * from '../../rulesets/dnd5e/bountifulDeathFirstRepeatDiceRoute'
export * from '../../rulesets/dnd5e/bountifulDeathFirstRepeatPageCollector'
export {resolveBountifulDeathFirstRepeatForNormalAck} from '../../rulesets/dnd5e/bountifulLuckNormalAck'

export{prepareDnd5eSpellWardOriginalTargetRetarget,withDnd5eSpellWardOriginalTargetRetarget,readDnd5eSpellWardOriginalTargetRetargetState,assertDnd5eSpellWardOriginalTargetRetargetCurrent}from'../../rulesets/dnd5e/spellWardOriginalTargetRetarget'

export { prepareDnd5eSpellWardRetarget, withDnd5eSpellWardRetargetChain, readDnd5eSpellWardRetargetState, readDnd5eSpellWardRetargetInput } from '../../rulesets/dnd5e/spellWardRetargetChain'

export{prepareDnd5eSpellWardRetargetOwner,withDnd5eSpellWardRetargetOwners,readDnd5eSpellWardRetargetOwnerState,readDnd5eSpellWardRetargetOwnerInput}from'../../rulesets/dnd5e/spellWardRetargetChain'
export {dnd5eAvailableTempestuousSpellFlight} from '../../rulesets/dnd5e/headlessCombatEngine'

// Explicit native engine contracts used by presentation controllers.
export { type Dnd5eActionResult, dnd5eEffectiveMovementPoolSpeed, type Dnd5eCombatant, type Dnd5eHeadlessCombatState, dnd5eCombatantCanSee, dnd5eCombatantPairKey, dnd5eIncomingAttackArmorClassOptions, dnd5eIncomingAttackRerollOptions, type Dnd5eAction, resolveDnd5eCoverAttackRedirectPrefix, type Dnd5eSpellcastingSavingThrowRoll, type Dnd5eCombatEvent, type Dnd5eCoverAttackRedirectUse, dnd5eCombatantHasConcentrationEffect, type Dnd5eSpellTargetAttackRoll, type Dnd5eSpellTargetAttackInput, dnd5eAbilityCheckRollMode, dnd5eCombatantSoulOfDeceitFeatureId, dnd5eCanActAtZeroHitPoints, previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange, resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange, observeCommittedDnd5ePersistentAreaTrigger, dnd5eSpellcastingSaveRequirements, previewDnd5eSpellcastingSaves, dnd5eHellishRebukeReactionOption, dnd5ePendingMonsterMechanicResolutions, dnd5ePendingMonsterDeathAreaEffects, dnd5ePostSpellRandomTablePlan, previewDnd5eUnsupportedAirborneFalls, grantedDamageSource } from "../../rulesets/dnd5e/headlessCombatEngine"
